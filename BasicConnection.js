const _ = require("underscore");

/*
    By default, axios has no timeout on requests. 
    I encountered a problem in which my client occasionally stopped displaying responses. 
    At the time I thought that the conection failed, and restarted the client. 
    The bug only occured about once per hour. 
    I decided that it was necessary to solve the bug: I knew that it would occur again.
    After much testing and some false ends (the connection hadn't failed), 
    I eventually found that what I sent from the terminal still appeared in another window.
    So, I knew that it had to be an error with `handleEvents` or `getEvents`.
    After quite a few `console` logs, I concluded that the `axios` request promises don't resolve if I turn off my connection for a little while.
    From there, it wasn't long before I noticed there wasn't a response timeout.
    After a little reading, I leaned that that fact about no timeout on request.
    This is an example of a *tiny* bug that took a couple hours to solve.
*/
const axios = require("axios").create({timeout: 30e3});
const SocksProxyAgent = require("socks-proxy-agent");

const {headers, makeRandid, retry} = require("./Util");

class BasicConnection {

    constructor(config) {
        this.server = config.server || chooseFront();
        this.agent = config.proxy ? new SocksProxyAgent(config.proxy) : null;
        this.randid = makeRandid();
        this.topicsArray = config.topicsArray == null ? ["groupchat", "irc", "groupchats", "chatrooms", "math", "maths", "language", "programming", "government"] : config.topicsArray;
        ["questionMode", "lang", "proxyMove", "id"].forEach(function(value) {
            this[value] = config[value];
        }.bind(this));
    }

    get topics() {
        if (this.topicsArray.length == 0)
            return "";
        return "&topics=" + encodeURIComponent(JSON.stringify(this.topicsArray));
    }

    set topics(list) {
        this.topicsArray = list.split(/\s*+\,\s*/);
    }

    establishChat() {
        let url = "https://front" + this.server + ".omegle.com/start?caps=recaptcha2&firstevents=1&spid=&randid=" + this.randid + (this.questionMode ? "&wantsspy=1" : this.topics) + "&lang=" + this.lang;
        let agent = this.agent;
        
        return retry(2, function(succeed, fail) {
            axios.post(url, "", {
                headers: headers(true),
                httpsAgent: agent
            }).then(function(response) {
                succeed(response.data);
            }).catch(fail);
        }).catch(function(ex) {
            dirtyFront(this.server);
            throw ex;
        }.bind(this));
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
                }).then(function(response) {
                    succeed(response.data);
                }).catch(fail);
            }, lastFail && !lastFail.response ? 10e3 : 0);
        }).catch(function(ex) {
            dirtyFront(this.server);
            throw ex;
        }.bind(this));
    }

    sendAction(action, msg) {
        while (msg != null && msg.length > 1500) {
            let left = msg.slice(0, msg.length < 2500 ? 1000 : 1500);
            let seam = left.lastIndexOf("\nban ?off =");
            if (seam == -1)
                seam = left.lastIndexOf("\n");
            if (seam == -1)
                seam = left.lastIndexOf(". ") + 2;
            if (seam == 1)
                seam = left.lastIndexOf(" ") + 1;
            if (seam == 0 || seam < 300) {
                this.sendActionInner(action, left);
                msg = msg.slice(left.length);
            } else {
                this.sendActionInner(action, left.slice(0, seam));
                msg = msg.slice(seam);
            }
        }
        return this.sendActionInner(action, msg);
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
            }).then(function(response) {
                succeed(response.data);
            }).catch(fail); // not sure about the FileNotFoundException in java
        }).catch(function(ex) {
            dirtyFront(this.server);
            throw ex;
        }.bind(this));
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
        front = _.min(fronts, "lastDirty")
    }
    return front.id;
}

function dirtyFront(id) {
    let front = _.findWhere(fronts, {id});
    if (front) front.dirty();
}

module.exports = BasicConnection;