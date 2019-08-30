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
};

let RANDID_PIECES = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

module.exports.makeRandid = function() {
    let s = "";
    while (s.length < 8)
        s += _.sample(RANDID_PIECES);
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

module.exports.matchesEachKeyword = function(cmd, keywords) {
    return _.every(keywords, function(word) {
        let pat = new RegExp("\\b" + word + "\\b");
        return !/^\w+$/.test(word) || pat.test(cmd.helpString) ||
            cmd.name == word.toLowerCase() || _.some(cmd.aliases, function(alias) {
                return alias == word.toLowerCase();
            });
    });
};

module.exports.expectStringArg = function(args) {
    return _.isString(args[0]);
};

module.exports.splitMessage = function(msg) {
    let pieces = [];
    while (msg != null && msg.length > 1500) {
        let left = msg.slice(0, msg.length < 2500 ? 1000 : 1500);
        let seam = left.lastIndexOf("\nban ?off =");
        if (seam == -1)
            seam = left.lastIndexOf("\n");
        if (seam == -1)
            seam = left.lastIndexOf(". ") + 2;
        if (seam == 1)
            seam = left.lastIndexOf(" ") + 1;
        if (/*seam == 0 || */seam < 300) {
            pieces.push(left);
            msg = msg.slice(left.length);
        } else {
            pieces.push(left.slice(0, seam));
            msg = msg.slice(seam);
        }
    }
    pieces.push(msg);
    return pieces;
};

module.exports.formatDate = function(date) { // from https://stackoverflow.com/questions/23593052/format-javascript-date-to-yyyy-mm-dd
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
};
