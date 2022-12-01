const getPoolData = require('./PoolData')

getPoolData("0x3416cf6c708da44db2624d63ea0aaef7113527c6").then(response=>{
    console.log("Response", response)
}).catch((error)=>{
    console.log(error.message)
})