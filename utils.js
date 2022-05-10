const config = require("./config_v2.json"); 

// WEB3 

exports.getRpc = function () {
    return  config.rpc[config.selectedRpc];
}

// OTHER 

exports.displayTime = function (timestamp) {
    var a = new Date(timestamp * 1000);
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    return hour + ":" + min + ":" + sec;
}

exports.sortNumArray = function (numArray) {
    numArray.sort(function(a, b) {
    return a - b;
    });
    return numArray
}