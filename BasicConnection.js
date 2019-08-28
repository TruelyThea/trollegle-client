const _ = require("underscore");

// Currently, the site uses a timeout of 62 seconds (see getEvents() there),
//     and SimpleClient.java uses a timeout of 90 seconds (see fillHeaders() in Util.java).
// When fetching events, the site seems to return empty events [] after 60 seconds.
// If we were to have a timeout before the 60 seconds,
//    it would replace the old request on the server and the server's internal timeout for our request would be replaced.
// Our timeout would cause the request to getEvents() to fail,
//    and if this happened six consecutive times, we would mistakenly kill the UserConnection!
// Thus, we need a timeout strictly greater than 60 seconds.
// A bit of history: Not knowing this led to some unfortunate bugs in the past (see the comments in previous commits if you wish).

// Also the site's script suggests that null is returned by getEvents() if "Server was unreachable for too long and your connection was lost."
//     Clearly, though, returning null means that we were able to reach the server...

const axios = require("axios").create({timeout: 62e3});
const SocksProxyAgent = require("socks-proxy-agent");

const {headers, makeRandid, retry, splitMessage} = require("./Util");

class BasicConnection {

    constructor(config) {
        this.server = config.server || chooseFront();
        this.agent = config.proxy ? new SocksProxyAgent(config.proxy) : null;
        this.randid = makeRandid();
        this.topicsArray = config.topicsArray == null ? ["groupchat", "irc", "groupchats", "chatrooms", "math", "maths", "language", "programming", "government"] : config.topicsArray;
        ["questionMode", "lang", "proxyMove", "id"].forEach(function(value) {
            this[value] = config[value];
        }, this);
    }

    get topics() {
        if (this.topicsArray.length == 0)
            return "";
        return "&topics=" + encodeURIComponent(JSON.stringify(this.topicsArray));
    }

    set topics(list) {
        this.topicsArray = list.split(/\s*\,\s*/);
    }

    establishChat() {
        let url = "https://front" + this.server + ".omegle.com/start?caps=recaptcha2&firstevents=1&spid=&randid=" + this.randid + (this.questionMode ? "&wantsspy=1" : this.topics) + "&lang=" + this.lang;
        let agent = this.agent;

        return retry(2, function(succeed, fail) {
            axios.post(url, "", {
                headers: headers(true),
                httpsAgent: agent
            }).then(response => {
                succeed(response.data);
            }).catch(fail);
        }).catch(ex => {
            dirtyFront(this.server);
            throw ex;
        });
    }

    effectiveAgent() {
        return this.proxyMove ? null : this.agent;
    }

    getEvents() {
        if (!this.id) return Promise.reject(new Error("no clientID is defined"));

        let url = "https://front" + this.server + ".omegle.com/events";
        let data = "id=" + this.id;
        let agent = this.effectiveAgent();

        return retry(6, function(succeed, fail, lastFail) {
            setTimeout(function() { // TODO: only wait 10s if UnknownHostException in java
                axios.post(url, data, {
                    headers: headers(true),
                    httpsAgent: agent
                }).then(response => {
                    succeed(response.data);
                }).catch(fail);
            }, lastFail && !lastFail.response ? 10e3 : 0);
        }).catch(ex => {
            dirtyFront(this.server);
            throw ex;
        });
    }

    sendAction(action, msg) {
        return splitMessage(msg).reduce((chain, piece) => {
            // `.then()` seems like a better choice than `.finally()`
            return chain.then(() => this.sendActionInner(action, piece));
        }, Promise.resolve());
    }

    sendActionInner(action, msg) {
        if (!this.id) return Promise.reject(new Error("no clientID is defined"));

        let url = "https://front" + this.server + ".omegle.com/" + action; // why would action need to be converted to UTF-8, isn't it already?
        let data = (msg ? "msg=" + encodeURIComponent(msg) : "") + "&id=" + this.id;
        let agent = this.effectiveAgent();

        return retry(2, function(succeed, fail) {
            axios.post(url, data, {
                headers: headers(false),
                httpsAgent: agent
            }).then(response => {
                succeed(response.data);
            }).catch(fail); // not sure about the FileNotFoundException in java
        }).catch(ex => {
            dirtyFront(this.server);
            throw ex;
        });
    }
}


class Front {
    constructor(id) {
        this.id = id + 1;
        this.lastDirty = 0;
    }
    dirty() { this.lastDirty = Date.now(); }
    isDirty() {
        return Date.now() - this.lastDirty < 10 * 60 * 1000;
    }
}

let fronts = _.range(32).map(function(i) {
    return new Front(i);
});

fronts[5].lastDirty = Infinity; // why are you staring at me
fronts[9].lastDirty = Infinity;

function chooseFront() {
    let front = _.sample(fronts);
    if (front.isDirty()) {
        front = _.min(fronts, "lastDirty");
    }
    return front.id;
}

function dirtyFront(id) {
    let front = _.findWhere(fronts, {id});
    if (front) front.dirty();
}

module.exports = BasicConnection;