const ethers = require("ethers");

const config = require("./config.json");
const gardening_pools = require("./gardening_pools.json");
const masterGardenerAbi = require("./abi/master_gardener.json");

function getRpc() {
    return config.useBackupRpc ? config.rpc.poktRpc : config.rpc.harmonyRpc;
}

async function getPoolId(poolAddress) {
    try {
        // Connect to questContract through rpc
        provider = new ethers.providers.JsonRpcProvider(getRpc());
        masterGardenerContract = new ethers.Contract(
            config.masterGardenerContract,
            masterGardenerAbi,
            provider
        );
        
        var poolId = await Promise.resolve(masterGardenerContract.poolId1(poolAddress));

    } catch (err) {
        console.clear();
        console.error(`Unable to run: ${err.message}`);
    }
    return poolId
}

async function isGarden(pairAddress) {
    return await getPoolId(pairAddress) > 0
}

async function getPoolIds() {
    for (const [pairName, pairAddress] of Object.entries(gardening_pools.poolAddress)) {
        console.log(pairName)
        console.log(pairAddress)
        console.log(await getPoolId(pairAddress))
    }
}

getPoolIds()