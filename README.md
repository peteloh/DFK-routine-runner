# DFKRoutineRunner
This code builds upon SansegoTek's DFKQuestRunner that developed a great framework for automatic fishing / foraging questing with many tweakable parameters in the config file.
The following is the link to the github repo: https://github.com/SansegoTek/DFKQuestRunner

## Main Features
1. Automatic questing for both questV1 and questV2
    - Gardening and Mining quests still use QuestCoreV1 contracts
    - Training quests, Foraging and Fishing quests use QuestCoreV2 contracts
2. Automatically list heroes for sale
    - Any hero idling in the wallet with stamina less than 20 and forSale is true will be listed according to the price in config file.
    - When hero listed for sale has `minStamina` for quest, it will automatically get delisted to do quest.
    - When any hero has been sold / there is new hero in the account, it will be updated in "newHero" / "heroSold" log in the terminal.

## Setup
1. Clone this repo
2. Setup Config File
    - Fill in `config_v2_example.json` and rename it to `config_v2.json` (the code detects `config_v2.json` file)
    - put your public address in the wallet.address part of config
    - put heroId into the the [] of different type of "quest".
    - update "heroes" to match the heroes placed in the quest routine 
    - set forSale to false if you dont want it to be automatically listed on auction
    - set listing price for each hero
3. Run `node routine_runner_v2.js`

## Future Updates
1. Automatic levelling (prefined stats to choose)
2. Crystalvale support (multichain code)

## Private Keys - Written by SansegoTek
Private Keys - Proceed with EXTREME CAUTION!
I'll be very blunt about this - if you are not extremely careful using this app, you run the risk of losing the entire contents of your wallet. Yes, that's right - every single hero, JEWEL, Egg, Goldvein etc that you've worked so hard to accumulate - all gone. Not only that, but any ONE, ETH, NFTs etc that reside in that wallet - somebody else's property. Scared? Good!

You're in DFK and on GitHub, so you probably have a good understanding of why this risk exists. The reasons are spelled out below, but if any of this is news to you, you almost definitely shouldn't be using this app.

The reason this risk exists is because the app needs access to your private key. Private keys are like the main "password" to your wallet. Every time something significant (a "Transaction") happens in your wallet like sending coin to a different wallet, or sending a hero on a quest, your private key is used to ensure that you have personally signed-off on that transaction. MetaMask manages your private key for you and keeps it safe. When it pops up asking you to confirm a transaction, it's using your private key to sign that transaction.

The whole purpose of DFKQuestRunner is to run unattended. If you have to click a button every time a quest needs to start or complete, it defeats the purpose. So to manage this, it needs access to the private key so it can sign those transactions automatically. There is currently no way around this (although we're looking into options).

DFKQuestRunner ONLY uses your private key to sign transactions. The first time you run it, it will prompt you for your private key and a password, and it will save the private key in an encrypted form, to a file called 'w.json' (by default, but you can change this). Only somebody who knows the password will be able to decrypt it. The private key is then used to configure the popular open-source "ethers.js" library, which is used to sign and run the transactions. The app itself will not save the private key in it's unencrypted form. You can verify this in the code yourself - in fact, I would wholeheartedly recommend that you do exactly that (and tell us fast if you find any issues!)

Please be aware that what follows is not advice as to what you should do in your specific situation - if you want to use this app, you need to educate yourself on the risks, and find a level of risk that you're comfortable with.

So, what are the risks? The main risk is that your encrypted private key will reside in a file somewhere. It runs the risk of being discovered, either by another human or some malware. There's a chance they could know or guess your password and be able to access it. Even if you create the file, use the runner, and then delete the file, somebody could potentially use drive recovery tools to restore that deleted file and access your private key. Paranoid? Maybe. But this is real money we're talking about.

Some people are comfortable with that risk - their password is strong, maybe their drive is encrypted, they use 2FA on their OS, they lock their laptop in a safe when they are not using it. Other people would prefer that the private key file never touches their hard drive, and so create it on a secure USB drive which it never leaves (you can configure this - see the configuration section below). There are no doubt plenty of other methods. Again, education is key.

When you export your private key from MetaMask, you might be tempted to copy/paste it into the application. Are you absolutely sure you don't have any malware on your machine that could read the contents of your clipboard? And there's the possibility of leaving the private key lying around in your clipboard, and then accidentally pasting it into a discord. Typing it in to the application, rather than copy/pasting, would be safer. Yes, it takes longer and is more error prone, but you only have to do it once.

There is also a risk for source code contributors. If you were to inadvertently push your unencrypted private key file into GitHub - well, let's just say - it would be bad. There are bots out in the wild that react to GitHub commits in public repos, and scan for anything resembling a private key. Your wallet would be emptied before you could say "total protonic reversal", and who ya gonna call to dig you out of that mess? Don't be tempted to copy/paste your private key and save it unencrypted anywhere near the git folder structure.

Finally - if you've done your homework, found a level of risk you are comfortable with, and are happily using this app, don't be tempted to try out any similar-looking projects without first thoroughly investigating their code base. Sometimes people will fork GitHub projects, make some changes (e.g. like sending your private key to a web server that they control), and try and pass it off as the original by, say, casually dropping a link to it in a discord somewhere.

Listen - ultimately, you're running some random code off of the internet, written by some people you probably don't know, who are asking you for access to your private key. WTF???!!??! I can tell you that we're good guys, and won't scam you, and that's absolutely true - but I'd prefer it if you didn't believe me. Do your homework, read the code, be aware of the risks, and only go ahead if you're comfortable. Otherwise, stay away. You're on your own. No responsibility for losses can or will be accepted from anyone involved in the project

If you've got this far and are still considering using the app, congratulations my friend. You're tougher than an Ironscale, and will be auto-questing faster than a Sailfish. It's a beautiful and powerful thing. Some say, even more beautiful and powerful than a Shimmerscale...

## Tip Jar
If you're finding DFKRoutineRunner useful, any tips are gratefully received. 
Tip jar: 0xC2cfCDa0cd983C5E920E053F0985708c5e420f2F
