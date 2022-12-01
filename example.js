const getPoolData = require('./PoolData')

getPoolData("0x6279653c28f138c8b31b8a0f6f8cd2c58e8c1705", 1).then(response=>{
    console.log("Response", JSON.stringify(response))
}).catch((error)=>{
    console.log(error.message)
})