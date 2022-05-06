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

        // Main Loop
        StartRoutine()


    } catch (err) {
        console.clear();
        console.error(`Unable to run: ${err.message}`);
    }
}

async function StartRoutine() {
    try {
        
        console.log("\nFetching all user heroes...\n");
        heroesInAuction = utils.sortNumArray(await getUserAuctions(config.wallet.address))
        heroesInWallet = utils.sortNumArray(await getUserHeroes(config.wallet.address))

        var curentUserHeroes = heroesInAuction.concat(heroesInWallet)

        var lastUpdatedUserHero = new Array
        for (key of Object.keys(config.heroes)) {lastUpdatedUserHero.push(parseInt(key))}

        var heroSold = utils.sortNumArray(lastUpdatedUserHero.filter(x => !curentUserHeroes.includes(x)));
        var heroNew = utils.sortNumArray(curentUserHeroes.filter(x => !lastUpdatedUserHero.includes(x)));

        console.log(`\nHero(s) sold : `);
        console.log(heroSold)
        console.log(`New hero(s) : `);
        console.log(heroNew)

        // check for heroes with full xp
        var fullXpHeroes = new Array

        for (heroId of curentUserHeroes) {
            heroDetails = await heroContract.getHero(heroId)
            heroLevel = heroDetails[3][3]
            heroXp = heroDetails[3][4]
            if (heroXp.toNumber() == (heroLevel+1)*1000) {
                fullXpHeroes.push(heroId)
            }
        }
        
        console.log(`Full Xp Heroes : `);
        console.log(fullXpHeroes)

        console.log("\nChecking for quests...\n");
        let activeQuestsV1 = await questContractV1.getActiveQuests(
            config.wallet.address
        );
        let activeQuestsV2 = await questContractV2.getAccountActiveQuests(
            config.wallet.address
        );

        // Display the finish time for any quests in progress
        let runningQuestsV1 = activeQuestsV1.filter(
            (quest) => quest.completeAtTime >= Math.round(Date.now() / 1000)
        );
        runningQuestsV1.forEach((quest) =>
            console.log(
                `QuestV1 led by hero ${
                    quest.heroes[0]
                } is due to complete at ${utils.displayTime(quest.completeAtTime)}`
            )
        );
        let runningQuestsV2 = activeQuestsV2.filter(
            (quest) => quest.completeAtTime >= Math.round(Date.now() / 1000)
        );
        runningQuestsV2.forEach((quest) =>
            console.log(
                `QuestV2 led by hero ${
                    quest.heroes[0]
                } is due to complete at ${utils.displayTime(quest.completeAtTime)}`
            )
        );

        // Complete any quests that need to be completed
        let doneQuestsV1 = activeQuestsV1.filter(
            (quest) => !runningQuestsV1.includes(quest)
        );
        for (const quest of doneQuestsV1) {
            await completeQuestV1(quest.heroes[0]);
        }
        let doneQuestsV2 = activeQuestsV2.filter(
            (quest) => !runningQuestsV2.includes(quest)
        );
        for (const quest of doneQuestsV2) {
            await completeQuestV2(quest.heroes[0]);
        }

        // List any non-full stamina in wallet for sale
        // After completing quest, send them to Auction
        for (heroId of heroesInWallet) {
            heroStamina = await questContractV2.getCurrentStamina(heroId);
            // console.log(heroStamina.toNumber()) // DEBUGGING
            if (heroStamina.toNumber() < 20) {await listHeroForSale(heroId)}
        }
        // Start any quests needing to start
        let allActiveQuests = activeQuestsV1.concat(activeQuestsV2)
        let questsToStart = await getQuestsToStart(allActiveQuests, heroSold, heroesInAuction);
        for (const quest of questsToStart) {
            await startQuest(quest);
        }

        setTimeout(() => StartRoutine(), config.pollingInterval);
        console.log(`\nWaiting for ${config.pollingInterval / 1000} seconds...\n`);

    } catch (err) {
        console.error(
            `An error occured. Will attempt to retry in ` +
                `${config.pollingInterval / 1000} seconds... Error:`,
            err
        );
        setTimeout(() => StartRoutine(), config.pollingInterval);
    }
}

// QUESTING FUNCTIONS

async function getQuestsToStart(activeQuests, heroSold, heroesInAuction) {
    var questsToStart = new Array();
    var questingHeroes = new Array();

    activeQuests.forEach((q) =>
        q.heroes.forEach((h) => questingHeroes.push(Number(h)))
    );

    for (const quest of config.quests) {
        if (quest.name.includes("Gardening") || quest.name.includes("Mining")) {
            var questAttempts = 1
        } else {
            var questAttempts = config.professionMaxAttempts[quest.name]
        }

        if (quest.professionHeroes.length > 0) {
            var readyHeroes = await getHeroesWithGoodStamina(
                heroSold,
                heroesInAuction,
                questingHeroes,
                quest,
                questAttempts,
                true
            );
            questsToStart.push({
                name: quest.name,
                address: quest.contractAddress,
                professional: true,
                heroes: readyHeroes,
                attempts: questAttempts,
                questLevel: quest.questLevel,
                poolId: quest.poolId,
            });
        }

        if (quest.nonProfessionHeroes.length > 0) {
            var readyHeroes = await getHeroesWithGoodStamina(
                heroSold,
                heroesInAuction,
                questingHeroes,
                quest,
                questAttempts,
                false
            );
            questsToStart.push({
                name: quest.name,
                address: quest.contractAddress,
                professional: false,
                heroes: readyHeroes,
                attempts: questAttempts,
                questLevel: quest.questLevel,
                poolId: quest.poolId,
            });
        }
    }
    // console.log(questsToStart) // DEBUGGING
    return questsToStart;
}

async function getHeroesWithGoodStamina(
    heroSold,
    heroesInAuction,
    questingHeroes,
    quest,
    maxAttempts,
    professional
) {
    var minStamina
    if  (quest.name.includes("Gardening")) {
        minStamina = config.minStamina.gardening;
    } 
    else if (quest.name.includes("Mining")) {
        minStamina = config.minStamina.mining;
    }
    else {
        minStamina = professional ? 5 * maxAttempts : 7 * maxAttempts;
    }
    
    let heroes = professional
        ? quest.professionHeroes
        : quest.nonProfessionHeroes;
    
    heroes = heroes.filter((h) => !questingHeroes.includes(h));
    heroes = heroes.filter((h) => !heroSold.includes(h));

    const promises = heroes.map((hero) => {
        return questContractV2.getCurrentStamina(hero);
    });

    const results = await Promise.all(promises);

    const heroesWithGoodStaminaRaw = results.map((value, index) => {
        const stamina = Number(value);
        console.log(stamina, minStamina)
        if (stamina >= minStamina) {
            return heroes[index];
        }

        return null;
    });

    const heroesWithGoodStamina = heroesWithGoodStaminaRaw.filter((h) => !!h);

    if (!heroesWithGoodStamina.length) {
        console.log(
            `${professional ? "Professional" : "Non-professional"} ${
                quest.name
            } quest is not ready to start.`
        );
    } else {
        // check for heroes in auction
        for (heroId of heroesWithGoodStamina){
            if (heroesInAuction.includes(heroId)) {
                // hero is in auction, cancel the auction
                await cancelAuction(heroId)
            }
        }
    }

    return heroesWithGoodStamina;
}

async function startQuest(quest) {
    try {
        var maxQuestGroupSize
        if (quest.name.includes("Gardening")) {
            maxQuestGroupSize = 1;
        } else {
            maxQuestGroupSize = config.maxQuestGroupSize[quest.name]
        }

        // console.log(quest) // DEBUGGING
        let batch = 0;
        while (true) {
            var groupStart = batch * maxQuestGroupSize;
            let questingGroup = quest.heroes.slice(
                groupStart,
                groupStart + maxQuestGroupSize
            );
            if (questingGroup.length === 0) break;
            // console.log(questingGroup) // DEBUGGING
            await startQuestBatch(quest, questingGroup);
            batch++;
        }
    } catch (err) {
        console.warn(
            `Error determining questing group \n`, err
        );
    }
}

async function startQuestBatch(quest, questingGroup) {

    if (!quest.name.includes("Gardening")) {
        try {
            console.log(
                `Starting ${
                    quest.professional ? "Professional" : "Non-professional"
                } ${quest.name} quest with hero(es) ${questingGroup}.`
            );
            if (quest.name.includes("Mining")) {
                // Mining quest still uses questContractV1
                await tryTransaction(
                    () =>
                        questContractV1 
                            .connect(wallet)
                            .startQuest(
                                questingGroup,
                                quest.address,
                                quest.attempts,
                                callOptions
                            ),
                    2
                );
            } else {
                // The rest uses questContractV2
                await tryTransaction(
                    () =>
                        questContractV2 
                            .connect(wallet)
                            .startQuest(
                                questingGroup,
                                quest.address,
                                quest.attempts,
                                quest.questLevel,
                                callOptions
                            ),
                    2
                );
            }
            console.log(
                `Started ${
                    quest.professional ? "Professional" : "Non-professional"
                } ${quest.name} quest.`
            );
        } catch (err) {
            console.warn(
                `Error starting ${quest.name} quest - this will be retried next polling interval`, err
            );
            // console.log(err) // DEBUGGING
        }
    } else {
        // GARDENING use startQuestWithData contract function
        try {
            questData = [quest.poolId, 0, 0, 0, 0, 0, '', '', ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS]

            console.log(
                `Starting ${
                    quest.professional ? "Professional" : "Non-professional"
                } ${quest.name} quest with hero(es) ${questingGroup}.`
            );
            // Gardening Quest still uses questContractV1
            await tryTransaction(
                () =>
                    questContractV1 
                        .connect(wallet)
                        .startQuestWithData(
                            questingGroup,
                            quest.address,
                            quest.attempts,
                            questData,
                            callOptions
                        ),
                2
            );
            console.log(
                `Started ${
                    quest.professional ? "Professional" : "Non-professional"
                } ${quest.name} quest.`
            );
        } catch (err) {
            console.warn(
                `Error starting gardening quest - this will be retried next polling interval`, err
            );
            // console.log(err) // DEBUGGING
        }
    }
    
}

async function completeQuestV1(heroId) {
    try {
        console.log(`Completing quest led by hero ${heroId}`);

        let receipt = await tryTransaction(
            () =>
                questContractV1
                    .connect(wallet)
                    .completeQuest(heroId, callOptions),
            2
        );
        console.log(`Completed!\n`);
    } catch (err) {
        console.warn(
            `Error completing quest for heroId ${heroId} \n`, err
        );
    }
}

async function completeQuestV2(heroId) {
    try {
        console.log(`Completing quest led by hero ${heroId}`);

        let receipt = await tryTransaction(
            () =>
                questContractV2
                    .connect(wallet)
                    .completeQuest(heroId, callOptions),
            2
        );
        console.log(`\nCompleted!`);
    } catch (err) {
        console.warn(
            `Error completing quest for heroId ${heroId} \n`, err
        );
    }
}

// AUCTIONS FUNCTIONS

async function listHeroForSale(heroId) {
    // automatically follows the price in config file
    if (config.heroes[heroId]["forSale"]) {
        try {
            heroListingPrice = config.heroes[heroId]["listingPrice"]
            // console.log(heroListingPrice) // DEBUGGING
            await createAuction(
                heroId,
                heroListingPrice,
                heroListingPrice
            )
        } catch (err) {
            console.warn(
                `Error getting ${heroId} listing price \n`, err
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
            `\nListing Hero ${heroId} @ price = ${startingPriceEther} Jewels`
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
            `Listed!`
        );
    } catch (err) {
        console.warn(
            `Error during listing..\n`, err
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
            `Cancelled!`
        );
    } catch (err) {
        console.warn(
            `Error in cancalling ${heroId} auction \n`, err
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
            `Error in getting user auctions \n`, err
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
            `Error in getting user heroes \n`, err
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
