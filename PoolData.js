const dayjs = require('dayjs')
const request = require('request');
let bundles = null

DEBUG = false
function debuglog(...msg) {
    if (!DEBUG) return
    console.log(...msg)
}

function getSecondsToReduce(days) {
    var date = new Date();
    var hrs = date.getHours() + (days * 24);
    var mins = date.getMinutes() + (hrs * 60);
    var secs = date.getSeconds() + (mins * 60);
    return secs;
}

function useDeltaTimestamps(addDays) {
    if (!addDays) addDays = 0
    const utcCurrentTime = dayjs()

    const t1 = utcCurrentTime.subtract(getSecondsToReduce(1 + addDays), 'seconds').startOf('minute').unix()
    const t2 = utcCurrentTime.subtract(getSecondsToReduce(2 + addDays), 'seconds').startOf('minute').unix()
    const tWeek = utcCurrentTime.subtract(getSecondsToReduce(7 + addDays), 'seconds').startOf('minute').unix()

    let currentDate = utcCurrentTime.format("YYYY-MM-DD HH:mm:ss")
    if (addDays > 0) {
        const current = utcCurrentTime.subtract(getSecondsToReduce(addDays), 'seconds').startOf('minute').unix()
        currentDate = utcCurrentTime.subtract(getSecondsToReduce(addDays), 'seconds').startOf('minute').format("YYYY-MM-DD HH:mm:ss")

        return {
            currentDate: currentDate,
            dt: [current, t1, t2, tWeek]
        }
    }
    return {
        currentDate: currentDate,
        dt: [t1, t2, tWeek]
    }
}

async function getBlocks(addDays) {
    if (!addDays) addDays = 0
    const dts = useDeltaTimestamps(addDays)
    var t = dts.dt
    var options = {
        'method': 'POST',
        'url': 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
        'headers': {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: `query blocks {
            t${t[0]}: blocks(
                first: 1
                orderBy: timestamp
                orderDirection: desc
                where: {timestamp_gt: ${t[0]}, timestamp_lt: ${t[0]+600}}
            ) {
                number
                __typename
            }
            t${t[1]}: blocks(
                first: 1
                orderBy: timestamp
                orderDirection: desc
                where: {timestamp_gt: ${t[1]}, timestamp_lt: ${t[1]+600}}
            ) {
                number
                __typename
            }
            t${t[2]}: blocks(
                first: 1
                orderBy: timestamp
                orderDirection: desc
                where: {timestamp_gt: ${t[2]}, timestamp_lt: ${t[2]+600}}
            ) {
                number
                __typename
            }
            t${t[3] ? t[3] : t[2]}: blocks(
                first: 1
                orderBy: timestamp
                orderDirection: desc
                where: {timestamp_gt: ${t[3] ? t[3] : t[2]}, timestamp_lt: ${(t[3] ? t[3] : t[2])+600}}
            ) {
                number
                __typename
            }
            }`,
            variables: {}
        })
    };

    return new Promise((resolve, reject)=>{
        request(options, (error, response)=>{
            if (error) reject(error)
            
            const data = JSON.parse(response.body).data
            let blocks = [
                data[`t${t[0]}`][0].number,
                data[`t${t[1]}`][0].number,
                data[`t${t[2]}`][0].number
            ]
            if (addDays > 0) {
                blocks.push(data[`t${t[3]}`][0].number)
            }
            debuglog("Block number for 1day, 2day and week:", blocks)
            resolve({
                currentDate: dts.currentDate,
                blocks: blocks
            })
        })
    });
}

function fetchPoolData(poolId, block) {
    let whereBlock = ""
    if (block) {
        debuglog(`Fetching Block: ${block}`)
        whereBlock = `block: {number: ${block}}`
    }

    var options = {
        'method': 'POST',
        'url': 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
        'headers': {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: `query {
                pools(where: {id_in: ["${poolId}"]}
                ${whereBlock}
                orderBy: totalValueLockedUSD
                orderDirection: desc
                subgraphError: allow)
                {
                    id
                    feeTier
                    liquidity
                    sqrtPrice
                    tick
                    token0 {
                        id
                        symbol
                        name
                        decimals
                        derivedETH
                        __typename
                    }
                    token1 {
                        id
                        symbol
                        name
                        decimals
                        derivedETH
                        __typename
                    }
                    token0Price
                    token1Price
                    volumeUSD
                    volumeToken0
                    volumeToken1
                    txCount
                    totalValueLockedToken0
                    totalValueLockedToken1
                    totalValueLockedUSD
                    __typename
                }
                    bundles(where: {id: 1}) {
                    ethPriceUSD
                    __typename
                }
            }`,
            variables: {}
        })
    }

    return new Promise((resolve, reject) => {
        request(options, function (error, response) {
            if (error) reject(error)
    
            const data = JSON.parse(response.body)
            if (bundles === null) {
                bundles = data.data.bundles
            }
            resolve(data.data.pools[0])
        })
    })

}

function get2DayChange(valueNow, value24HoursAgo, value48HoursAgo) {
    // get volume info for both 24 hour periods
    const currentChange = parseFloat(valueNow) - parseFloat(value24HoursAgo)
    const previousChange = parseFloat(value24HoursAgo) - parseFloat(value48HoursAgo)
    const adjustedPercentChange = ((currentChange - previousChange) / previousChange) * 100
    if (isNaN(adjustedPercentChange) || !isFinite(adjustedPercentChange)) {
      return [currentChange, 0]
    }
    return [currentChange, adjustedPercentChange]
}

async function getPoolDataForBlocks(poolId, blocks) {

    // assign correct block number
    const currentBlock = blocks?.length > 3 ? blocks?.[0] : undefined
    const oneDayBlock = blocks?.length > 3 ? blocks?.[1] : blocks?.[0] 
    const twoDayBlock = blocks?.length > 3 ? blocks?.[2] : blocks?.[1] 
    const weekBlock = blocks?.length > 3 ? blocks?.[3] : blocks?.[2]

    // fetch pool data according to blocks
    const current = await fetchPoolData(poolId, currentBlock)
    const oneDay = await fetchPoolData(poolId, oneDayBlock)
    const twoDay = await fetchPoolData(poolId, twoDayBlock)
    const week = await fetchPoolData(poolId, weekBlock)

    const ethPriceUSD = bundles?.[0]?.ethPriceUSD ? parseFloat(bundles?.[0]?.ethPriceUSD) : 0
    debuglog("ethPriceUSD:", ethPriceUSD)

    const [volume24USD, volume24USDChange] =
    current && oneDay && twoDay
        ? get2DayChange(current.volumeUSD, oneDay.volumeUSD, twoDay.volumeUSD)
        : current
        ? [parseFloat(current.volumeUSD), 0]
        : [0, 0]

    const volumeUSDWeek =
    current && week
        ? parseFloat(current.volumeUSD) - parseFloat(week.volumeUSD)
        : current
        ? parseFloat(current.volumeUSD)
        : 0

    // Hotifx: Subtract fees from TVL to correct data while subgraph is fixed.
    /**
     * Note: see issue desribed here https://github.com/Uniswap/v3-subgraph/issues/74
     * During subgraph deploy switch this month we lost logic to fix this accounting.
     * Grafted sync pending fix now.
     */
    const feePercent = current ? parseFloat(current.feeTier) / 10000 / 100 : 0
    const tvlAdjust0 = current?.volumeToken0 ? (parseFloat(current.volumeToken0) * feePercent) / 2 : 0
    const tvlAdjust1 = current?.volumeToken1 ? (parseFloat(current.volumeToken1) * feePercent) / 2 : 0
    const tvlToken0 = current ? parseFloat(current.totalValueLockedToken0) - tvlAdjust0 : 0
    const tvlToken1 = current ? parseFloat(current.totalValueLockedToken1) - tvlAdjust1 : 0
    let tvlUSD = current ? parseFloat(current.totalValueLockedUSD) : 0

    const tvlUSDChange =
    current && oneDay
        ? ((parseFloat(current.totalValueLockedUSD) - parseFloat(oneDay.totalValueLockedUSD)) /
            parseFloat(oneDay.totalValueLockedUSD === '0' ? '1' : oneDay.totalValueLockedUSD)) *
        100
        : 0

    // Part of TVL fix
    const tvlUpdated = current
    ? tvlToken0 * parseFloat(current.token0.derivedETH) * ethPriceUSD +
        tvlToken1 * parseFloat(current.token1.derivedETH) * ethPriceUSD
    : undefined
    if (tvlUpdated) {
        tvlUSD = tvlUpdated
    }

    const feeTier = current ? parseInt(current.feeTier) : 0

    const fees24h = volume24USD * (feeTier / 1000000)

    const pairName = current.token0.symbol + "/" + current.token1.symbol
    const pairId = current.token0.id + "-" + current.token1.id

    // make it null at the end of iteration [*important]
    bundles = null;

    return {
        pairName,
        pairId,
        poolId,
        tvlUSD,
        tvlUSDChange,
        feePercent,
        volume24USD,
        volume24USDChange,
        volumeUSDWeek,
        fees24h
    }
}

async function getPoolData(poolId, addDays) {
    try {
        if (!addDays) addDays = 0

        let response = [];

        for (let days=addDays;days>=0;days--) {
            console.log(`Fetching for last ${days} days`);
            const blocksData = await getBlocks(days)
            const poolData = await getPoolDataForBlocks(poolId, blocksData.blocks)

            response.push({
                date: blocksData.currentDate,
                blocks: blocksData.blocks,
                data: poolData
            })
        }
        
        return response
    
    } catch (error) {
        throw new Error(error)
    }
}

module.exports = getPoolData
