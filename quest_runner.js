const fs = require("fs");
const readline = require("readline");

const ethers = require("ethers");

const config = require("./myconfig.json"); // edit this line to your config file
const questContractAbi = require("./abi/quest_contract.json");
const masterGardenerAbi = require("./abi/master_gardener.json");
const rewardLookup = require("./rewards.json");

const callOptions = { gasPrice: config.gasPrice, gasLimit: config.gasLimit };
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

async function main() {
    try {
        // Connect to questContract through rpc
        provider = new ethers.providers.JsonRpcProvider(getRpc());
        questContract = new ethers.Contract(
            config.questContract,
            questContractAbi,
            provider
        );
        
        // Connect to wallet
        wallet = fs.existsSync(config.wallet.encryptedWalletPath)
            ? await getEncryptedWallet()
            : await createWallet();

        console.clear();

        // Main Loop
        checkForQuests()


    } catch (err) {
        console.clear();
        console.error(`Unable to run: ${err.message}`);
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

// QUESTING FUNCTIONS

async function checkForQuests() {
    try {
        console.log("\nChecking for quests...\n");
        let activeQuests = await questContract.getActiveQuests(
            config.wallet.address
        );
        // console.log(activeQuests)

        // Display the finish time for any quests in progress
        let runningQuests = activeQuests.filter(
            (quest) => quest.completeAtTime >= Math.round(Date.now() / 1000)
        );
        runningQuests.forEach((quest) =>
            console.log(
                `Quest led by hero ${
                    quest.heroes[0]
                } is due to complete at ${displayTime(quest.completeAtTime)}`
            )
        );

        // Complete any quests that need to be completed
        let doneQuests = activeQuests.filter(
            (quest) => !runningQuests.includes(quest)
        );
        for (const quest of doneQuests) {
            await completeQuest(quest.heroes[0]);
        }

        // Start any quests needing to start
        let questsToStart = await getQuestsToStart(activeQuests);
        for (const quest of questsToStart) {
            await startQuest(quest);
        }

        // Commented below so that checkForQuests() only runs once
        setTimeout(() => checkForQuests(), config.pollingInterval);
        console.log(`Waiting for ${config.pollingInterval / 1000} seconds...`);

    } catch (err) {
        console.error(
            `An error occured. Will attempt to retry in ` +
                `${config.pollingInterval / 1000} seconds... Error:`,
            err
        );
        setTimeout(() => checkForQuests(), config.pollingInterval);
    }
}

async function getQuestsToStart(activeQuests) {
    var questsToStart = new Array();
    var questingHeroes = new Array();

    activeQuests.forEach((q) =>
        q.heroes.forEach((h) => questingHeroes.push(Number(h)))
    );

    for (const quest of config.quests) {
        if (quest.name == "Foraging" || quest.name == "Fishing") {
            var questAttempts = config.professionMaxAttempts[quest.name]
        } else {
            var questAttempts = 1
        }


        if (quest.professionHeroes.length > 0) {
            var readyHeroes = await getHeroesWithGoodStamina(
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
                poolId: quest.poolId,
            });
        }

        if (quest.nonProfessionHeroes.length > 0) {
            var readyHeroes = await getHeroesWithGoodStamina(
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
            });
        }
    }
    // console.log(questsToStart) // DEBUGGING
    return questsToStart;
}

async function getHeroesWithGoodStamina(
    questingHeroes,
    quest,
    maxAttempts,
    professional
) {
    var minStamina
    if  (quest.name == "Fishing" || quest.name == "Foraging") {
        minStamina = professional ? 5 * maxAttempts : 7 * maxAttempts;
    } else {
        // Both gardening and mining costs 1 stamina per tick, profersional or not.
        // Set to be ready at 15 stamina
        minStamina = 25;
    }
    
    let heroes = professional
        ? quest.professionHeroes
        : quest.nonProfessionHeroes;
    
    heroes = heroes.filter((h) => !questingHeroes.includes(h));

    const promises = heroes.map((hero) => {
        return questContract.getCurrentStamina(hero);
    });

    const results = await Promise.all(promises);
    const heroesWithGoodStaminaRaw = results.map((value, index) => {
        const stamina = Number(value);
        if (stamina >= minStamina) {
            return heroes[index];
        }

        return null;
    });

    const heroesWithGoodStamina = heroesWithGoodStaminaRaw.filter((h) => !!h);

    // TODO: Contract error, fix
    //let hero = await questContract.getHero(lowestStaminaHero)
    //console.log(`${professional ? "Professional" : "Non-professional" } ${quest.name} quest due to start at ${displayTime(hero.state.staminaFullAt)}`)

    if (!heroesWithGoodStamina.length) {
        console.log(
            `${professional ? "Professional" : "Non-professional"} ${
                quest.name
            } quest is not ready to start.`
        );
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
            `Error determining questing group - this will be retried next polling interval`
        );
    }
}

// WALLET INTERACTION FUNCTIONS 

async function startQuestBatch(quest, questingGroup) {

    if (!quest.name.includes("Gardening")) {
        try {
            console.log(
                `Starting ${
                    quest.professional ? "Professional" : "Non-professional"
                } ${quest.name} quest with hero(es) ${questingGroup}.`
            );
            await tryTransaction(
                () =>
                    questContract
                        .connect(wallet)
                        .startQuest(
                            questingGroup,
                            quest.address,
                            quest.attempts,
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
                `Error starting non-gardening quest - this will be retried next polling interval`
            );
            console.log(err) // DEBUGGING
        }
    } else {
        // GARDENING use startQuestWithData contract function
        try {
            console.log(quest.poolId)
            console.log(questingGroup)
            questData = [quest.poolId, 0, 0, 0, 0, 0, '', '', ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS]

            console.log(
                `Starting ${
                    quest.professional ? "Professional" : "Non-professional"
                } ${quest.name} quest with hero(es) ${questingGroup}.`
            );
            await tryTransaction(
                () =>
                    questContract
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
                `Error starting gardening quest - this will be retried next polling interval`
            );
            console.log(err) // DEBUGGING
        }
    }
    
}

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

async function completeQuest(heroId) {
    try {
        console.log(`Completing quest led by hero ${heroId}`);

        let receipt = await tryTransaction(
            () =>
                questContract
                    .connect(wallet)
                    .completeQuest(heroId, callOptions),
            2
        );
        console.log(`\n Completed quest led by hero ${heroId} \n`);

    } catch (err) {
        console.warn(
            `Error completing quest for heroId ${heroId} - this will be retried next polling interval`
        );
    }
}

// UTILS FUNCTIONS 

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


function getRpc() {
    return config.useBackupRpc ? config.rpc.poktRpc : config.rpc.harmonyRpc;
}

function displayTime(timestamp) {
    var a = new Date(timestamp * 1000);
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    return hour + ":" + min + ":" + sec;
}

async function test() {
    // Connect to questContract through rpc
    provider = new ethers.providers.JsonRpcProvider(getRpc());
    questContract = new ethers.Contract(
        config.questContract,
        questContractAbi,
        provider
    );

    // Connect to wallet
    // wallet = fs.existsSync(config.wallet.encryptedWalletPath)
    // ? await getEncryptedWallet()
    // : await createWallet();

    // console.clear();

    console.log(await getGardeningPoolId(config.poolAddress['JEWEL-AVAX']));
}

function run() {
    main();
    // test();
}

run();
