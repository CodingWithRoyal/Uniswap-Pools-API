## Uniswap Pools API
Idea of this repo is to provide simple API to fetch uniswap pool data.

## Getting Started:
- Clone this repo
- Install all required dependencies:
```
npm install 
```
- Fetch data like this:
```
const  getPoolData  =  require('./PoolData')
...
...
// USDC/USDT Pool Id
let poolData = await getPoolData("0x3416cf6c708da44db2624d63ea0aaef7113527c6")
```
#### OR
- Fetch historical data like this:
```
const  getPoolData  =  require('./PoolData')
...
...
// USDC/USDT Pool Id
let poolData = await getPoolData("0x3416cf6c708da44db2624d63ea0aaef7113527c6", numberOfDays)
```

## Response: USDC/USDT Pool
```
{
    date: '01/12/2022 12:21:47',
    blocks: [ '16077494', '16070336', '16034541' ],
    data: {
      pairName: 'USDC/USDT',
      pairId: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48-0xdac17f958d2ee523a2206206994597c13d831ec7',
      poolId: '0x3416cf6c708da44db2624d63ea0aaef7113527c6',
      tvlUSD: 116019689.5295181,
      tvlUSDChange: -5.559615855386549,
      feePercent: 0.0001,
      volume24USD: 284741911.24463654,
      volume24USDChange: 422.2659872482457,
      volumeUSDWeek: 589161091.8790665,
      fees24h: 28474.191124463654
    }
 }
```
---
> Leave a STAR if you like this
---