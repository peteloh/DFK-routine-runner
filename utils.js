const config = require("./config.actual.json"); 

// WEB3 

exports.getRpc = function () {
    return config.useBackupRpc ? config.rpc.poktRpc : config.rpc.harmonyRpc;
}

// OTHER 

exports.displayTime = function (timestamp) {
    var a = new Date(timestamp * 1000);
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    return hour + ":" + min + ":" + sec;
}

exports.erc20Abi = [
    // Read-Only Functions
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",

    // Authenticated Functions
    "function transfer(address to, uint amount) returns (bool)",

    // Events
    "event Transfer(address indexed from, address indexed to, uint amount)"
];

