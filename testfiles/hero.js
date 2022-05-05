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

async function main() {
    // Connect to heroContract through rpc
    provider = new ethers.providers.JsonRpcProvider(utils.getRpc());
    heroContract = new ethers.Contract(
        config.heroContract,
        heroAbi,
        provider
    );

    // Connect to wallet
    // wallet = fs.existsSync(config.wallet.encryptedWalletPath)
    // ? await getEncryptedWallet()
    // : await createWallet();

    console.clear();

    // heroesInWallet = await getUserHeroes(config.wallet.address)
    getHeroStamina(124759)
}

async function getUserHeroes(userAddress) {
    var heroesInWallet = new Array()
    try {
        console.log(
            `Fetching user heroes in wallet`
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

async function getHeroStamina(heroId) {
    try {
        heroDetails = await heroContract.getHero(
            heroId
        )
        console.log('\n Getting Hero Details \n')
        console.log(heroDetails[3][0])
        

    } catch (err) {
        console.warn(
            `Error in getting ${heroId} stamina - this will be retried next polling interval`
        );
        // console.log(err) // DEBUGGING
    } 
    return heroDetails

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


async function test() {
    main();
}

test();