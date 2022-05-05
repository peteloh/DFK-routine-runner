// import node.js modules
const fs = require("fs");
const readline = require("readline");
const ethers = require("ethers");

// import json files
const config = require("../config.json"); 
const questContractAbi = require("../abi/quest_contract.json");
const masterGardenerAbi = require("../abi/master_gardener.json");
const auctionAbi = require("../abi/auctions.json");
const heroAbi = require("../abi/hero.json");
// import js files
const utils = require("../utils.js"); 

// setup parameters
const callOptions = { gasPrice: config.gasPrice, gasLimit: config.gasLimit };
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'


async function getPoolId(poolAddress) {
    try {
        // Connect to questContract through rpc
        provider = new ethers.providers.JsonRpcProvider(utils.getRpc());
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