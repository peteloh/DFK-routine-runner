// import node.js modules
const fs = require("fs");
const readline = require("readline");
const ethers = require("ethers");

// import json files
const config = require("./config_v2.json"); 
const questContractV1Abi = require("./abi/quest_contract_v1.json");
const questContractV2Abi = require("./abi/quest_contract_v2.json");
const auctionAbi = require("./abi/auctions.json");
const heroAbi = require("./abi/hero.json");

// import js files
const utils = require("./utils.js"); 

// setup parameters
const callOptions = { gasPrice: config.gasPrice, gasLimit: config.gasLimit };
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

async function main() {
    try {

        console.log("\nYou are about to remove all heroes from auction")

        // Connect to questContractV1 through rpc
        provider = new ethers.providers.JsonRpcProvider(utils.getRpc());
        questContractV1 = new ethers.Contract(
            config.questContractV1,
            questContractV1Abi,
            provider
        );
        // Connect to questContractV2 through rpc
        provider = new ethers.providers.JsonRpcProvider(utils.getRpc());
        questContractV2 = new ethers.Contract(
            config.questContractV2,
            questContractV2Abi,
            provider
        );
        // Connect to heroContract through rpc
        provider = new ethers.providers.JsonRpcProvider(utils.getRpc());
        heroContract = new ethers.Contract(
            config.heroContract,
            heroAbi,
            provider
        );
        // Connect to auctionContract through rpc
        provider = new ethers.providers.JsonRpcProvider(utils.getRpc());
        auctionContract = new ethers.Contract(
            config.auctionsContract,
            auctionAbi,
            provider
        );
    
        // Connect to wallet
        wallet = fs.existsSync(config.wallet.encryptedWalletPath)
            ? await getEncryptedWallet()
            : await createWallet();

        console.clear();

        // Main Function
        heroesInAuction = utils.sortNumArray(await getUserAuctions(config.wallet.address))

        for (heroId of heroesInAuction) {
            await cancelAuction(heroId)
        }

        console.log("\nCleared all heroes in auction!")

    } catch (err) {
        console.clear();
        console.error(`Unable to run: ${err.message}`);
    }
}

async function StartRoutine() {
    
    
        
}

// AUCTIONS FUNCTIONS

async function listHeroForSale(heroId) {
    // automatically follows the price in config file
    if (config.heroes[heroId]["forSale"]) {
        try {
            heroListingPrice = config.heroes[heroId]["listingPrice"]
            // console.log(heroListingPrice) // DEBUGGING
            createAuction(
                heroId,
                heroListingPrice,
                heroListingPrice
            )
        } catch (err) {
            console.warn(
                `Error getting ${heroId} listing price - this will be retried next polling interval`
            );
        }
    }
}

async function createAuction(heroId, startingPriceEther, endingPriceEther, duration=60, winner=ZERO_ADDRESS) {
    
    // if winner != 0, it is a private auction

    var startingPriceWei = BigInt(startingPriceEther * ethers.constants.WeiPerEther)
    var endingPriceWei = BigInt(endingPriceEther * ethers.constants.WeiPerEther)

    try {
        console.log(
            `Listing Hero ${heroId} @ price = ${startingPriceEther} Jewels`
        );
        await tryTransaction(
            () =>
                auctionContract
                    .connect(wallet)
                    .createAuction(
                        heroId,
                        startingPriceWei,
                        endingPriceWei,
                        duration,
                        winner,
                        callOptions
                    ),
            2
        );
        console.log(
            `Listed Hero ${heroId} @ price = ${startingPriceEther} Jewels`
        );
    } catch (err) {
        console.warn(
            `Error in auction listing - this will be retried next polling interval`
        );
        // console.log(err) // DEBUGGING
    } 

}

async function cancelAuction(heroId) {
    try {
        console.log(
            `\nCancelling Hero ${heroId} Listing`
        );
        await tryTransaction(
            () =>
                auctionContract
                    .connect(wallet)
                    .cancelAuction(
                        heroId,
                        callOptions
                    ),
            2
        );
        console.log(
            `Cancelled Hero ${heroId} Listing`
        );
    } catch (err) {
        console.warn(
            `Error in cancalling ${heroId} auction`
        );
    } 
}

async function getUserAuctions(userAddress) {
    var heroesInAuction = new Array()
    try {
        console.log(
            `Fetching user heroes in auctions`
        )

        bigNumberHeroList = await auctionContract.getUserAuctions(
            userAddress
        )
        for (heroId of bigNumberHeroList) {
            heroesInAuction.push(
                heroId.toNumber()
            )
        }
        console.log(heroesInAuction)
        
    } catch (err) {
        console.warn(
            `Error in getting user auctions - this will be retried next polling interval`
        );
        // console.log(err) // DEBUGGING
    } 
    return heroesInAuction

}

// HEROES FUNCTIONS

async function getUserHeroes(userAddress) {
    var heroesInWallet = new Array()
    try {
        console.log(
            `Fetching user heroes in wallet / questing`
        )

        bigNumberHeroList = await heroContract.getUserHeroes(
            userAddress
        )
        for (heroId of bigNumberHeroList) {
            heroesInWallet.push(
                heroId.toNumber()
            )
        }
        console.log(heroesInWallet)

    } catch (err) {
        console.warn(
            `Error in getting user auctions - this will be retried next polling interval`
        );
        // console.log(err) // DEBUGGING
    } 
    return heroesInWallet

}

// W3 TRANSACTION

async function tryTransaction(transaction, attempts) {
    for (let i = 0; i < attempts; i++) {
        try {
            var tx = await transaction();
            let receipt = await tx.wait();
            if (receipt.status !== 1)
                throw new Error(`Receipt had a status of ${receipt.status}`);
            return receipt;
        } catch (err) {
            if (i === attempts - 1) throw err;
        }
    }
}

// WALLET SETUP FUNCTIONS

async function getEncryptedWallet() {
    console.log("\nHi. You need to enter the password you chose previously.");
    let pw = await promptForInput("Enter your password: ", "password");

    try {
        let encryptedWallet = fs.readFileSync(
            config.wallet.encryptedWalletPath,
            "utf8"
        );
        let decryptedWallet = ethers.Wallet.fromEncryptedJsonSync(
            encryptedWallet,
            pw
        );
        return decryptedWallet.connect(provider);
    } catch (err) {
        throw new Error(
            'Unable to read your encrypted wallet. Try again, making sure you provide the correct password. If you have forgotten your password, delete the file "w.json" and run the application again.'
        );
    }
}

async function createWallet() {
    console.log("\nHi. You have not yet encrypted your private key.");
    let pw = await promptForInput(
        "Choose a password for encrypting your private key, and enter it here: ",
        "password"
    );
    let pk = await promptForInput(
        "Now enter your private key: ",
        "private key"
    );

    try {
        let newWallet = new ethers.Wallet(pk, provider);
        let enc = await newWallet.encrypt(pw);
        fs.writeFileSync(config.wallet.encryptedWalletPath, enc);
        return newWallet;
    } catch (err) {
        throw new Error(
            "Unable to create your wallet. Try again, making sure you provide a valid private key."
        );
    }
}

async function promptForInput(prompt, promptFor) {
    const read = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        let input = await new Promise((resolve) => {
            read.question(prompt, (answer) => resolve(answer));
        });
        if (!input)
            throw new Error(
                `No ${promptFor} provided. Try running the application again, and provide a ${promptFor}.`
            );
        return input;
    } finally {
        read.close();
    }
}

function run() {
    main();
    // test();
}

run();
