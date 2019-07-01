const _ = require("underscore");

module.exports.retry = function(times, request) {
    return new Promise(function(resolve, reject) {
        let lastFailure = null;
        let _retry = function() {
            new Promise(function(resolve, reject) {
                request(resolve, reject, lastFailure);
            })
            .then(resolve)
            .catch(function(reason) {
                lastFailure = reason;
                if (times-- > 0) _retry();
                else reject(reason);
            });
        };
        _retry();
    });
};

module.exports.headers = function(json) {
    var headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:50.0) Gecko/20100101 Firefox/50.0",
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        "Accept-Language": "en-US;en;q=0.5",
        "origin": "https://www.omegle.com",
        "Referer": "https://www.omegle.com/"
    };

    if (json)
        headers["Accept"] = "application/json";
    else
        headers["Accept"] = "text/javascript, text/html, application/xml, text/xml, */*";

    return headers;

    // conn.setConnectTimeout(2 * 60 * 1000);
    // conn.setReadTimeout(2 * 60 * 1000);
};

let RANDID_PIECES = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

module.exports.makeRandid = function() {
    let s = "";
    while (s.length < 8) {
        s += RANDID_PIECES[Math.floor(RANDID_PIECES.length * Math.random())];
    }
    return s;
};

module.exports.delay = function(t, v) {
    return new Promise(function(resolve) { 
        setTimeout(resolve.bind(null, v), t);
    });
 };

module.exports.pad = function(pad, data) {
    if (!_.isString(pad)) throw new Error("pad must be a string");
    return (pad + data).slice(-pad.length);
};