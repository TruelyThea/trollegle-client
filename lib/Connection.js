const _ = require("underscore");
const EventEmitter = require("eventemitter3");
const {expectStringArg, headers, makeRandid, retry, splitMessage} = require("./Util");

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

class Connection extends EventEmitter {

    constructor(config) {
        super();

        this.server = config.server || chooseFront();
        this.agent = config.proxy ? new SocksProxyAgent(config.proxy) : null;
        ["questionMode", "lang", "proxyMove", "id", "topicsArray"].forEach(function(value) {
            this[value] = config[value];
        }, this);

        this.randid = makeRandid();
        this.question = null;
        this.captchaSiteKey = "";
        this.isConnected = false;
        this.tellQueue = [];
        this.seesTyping = false; // indicates whether the other participant sees typing
        this.lastLurk = 0;

        this.connected = _.once(function() {
            this.isConnected = true;
            this.emit("established");
            this.emit("connected");
        });

        this.handleFailure = ex => {
            dirtyFront(this.server);
            this.isConnected = false;
            // could be a fail from a old timedout request, after already disconnected formally)
            // so only if this is the current user:
            this.emit("died", ex.message);
            this.emit("verbose notice", ex.stack); // node Error's have a stack property
        };
    }

    dispose() {
        this.removeAllListeners();
    }

    // indicates whether this is the current connection for the client
    get done() {
        return this.listenerCount("message") == 0;
    }

    get topics() {
        if (this.topicsArray.length == 0)
            return "";
        return "&topics=" + encodeURIComponent(JSON.stringify(this.topicsArray));
    }

    set topics(list) {
        this.topicsArray = list.split(/\s*\,\s*/);
    }

    get effectiveAgent() {
        return this.proxyMove ? null : this.agent;
    }

    establishChat() {
        this.emit("verbose notice", "!! Using front " + this.server);
        let url = "https://front" + this.server + ".omegle.com/start?caps=recaptcha2&firstevents=1&spid=&randid=" + this.randid + (this.questionMode ? "&wantsspy=1" : this.topics) + "&lang=" + this.lang;
        let agent = this.agent;

        return retry(2, function(succeed, fail) {
            axios.post(url, "", {
                headers: headers(true),
                httpsAgent: agent
            }).then(response => {
                succeed(response.data);
            }).catch(fail);
        }).then(data => {
            if (!_.isObject(data)) { // *should* be string and data.trim() == ""
                this.emit("ban", "empty reply");
            } else if (_.isEmpty(data)) { // *should* be {}
                this.emit("ban", "empty object");
            } else {
                this.emit("verbose notice", "Connection established");
                this.handleReply(data);
            }
            // return this.id;
        }).catch(this.handleFailure);
    }

    sendTyping(typing) {
        return this.sendAction(typing ? "typing" : "stoppedtyping", null);
    }

    sendDisconnect() {
        this.isConnected = false;
        return this.sendAction("disconnect", null);
    }

    sendAction(action, msg) {
        let lurk = Date.now();
        return splitMessage(msg).reduce((chain, piece) => {
            // `.then()` seems like a better choice than `.finally()`
            return chain.then(() => this.sendActionInner(action, piece));
        }, Promise.resolve()).then(() => {
            this.emit("successful send", lurk, action, msg);
        }).catch(() => {
            this.emit("unsuccessful send", lurk, action, msg);
            // this.handleFailure(err);
        });
    }

    sendActionInner(action, msg) {
        if (!this.id) return Promise.reject(new Error("no clientID is defined"));
        let url = "https://front" + this.server + ".omegle.com/" + action; // why would action need to be converted to UTF-8, isn't it already?
        let data = (msg ? "msg=" + encodeURIComponent(msg) : "") + "&id=" + this.id;
        let agent = this.effectiveAgent;

        return retry(2, function(succeed, fail) {
            axios.post(url, data, {
                headers: headers(false),
                httpsAgent: agent
            }).then(response => {
                succeed(response.data);
            }).catch(fail); // not sure about the FileNotFoundException in java
        });
    }

    schedSendTyping(typing) {
        let queue = this.tellQueue;
        if (typing) {
            if (!queue.length || !queue[0].startsWith("\u0091"))
                queue.push("\u0091type");
        } else if (queue.length && queue[0] == "\u0091type") {
            queue.shift();
        } else if (!queue.length || !queue[0].startsWith("\u0091")) {
            queue.push("\u0091stop");
        }
    }

    schedSend(message) {
        this.tellQueue.push(message);
    }

    schedSendDisconnect() {
        this.tellQueue.push("\u0091disconnect");
    }

    pollQueue() { // polls for new messages to send
        if (this.done) return; // stop polling

        let queue = this.tellQueue;

        let poll = ()  => { // this part is especially ugly, this still needs to be made better; possibly with promises
            if (!queue.length) {
                this.pollQueue();
                return;
            }

            let msg = queue.shift();
            if (msg == "\u0091type") {
                if (!this.seesTyping) {
                    this.sendTyping(true);
                    this.seesTyping = true;
                }
                poll();
            } else if (msg == "\u0091stop") {
                if (!queue.length || queue[0].startsWith("\u0091")) {
                    this.sendTyping(false);
                    this.seesTyping = false;
                }
                poll();
            } else if (msg == "\u0091disconnect") {
                queue.length = 0;
                this.sendDisconnect();
                poll(); // just to be on the safe side; what if the message didn't successfully send?
            } else {
                this.emit("verbose notice", "[sending]: " + msg);
                if (!this.seesTyping)
                    this.sendTyping(true);
                setTimeout(() => {
                    this.sendAction("send", msg);
                    this.seesTyping = false;
                    setTimeout(poll, 75);
                }, 75 + Math.floor(30 * Math.log(msg.length)));
            }
        };

        setTimeout(() => {
            if (!this.isConnected) {
                queue.length = 0; // no prior scheduling, excess lurks, e.g. removed
                this.pollQueue();
                return;
            }
            poll();
        }, 75);
    }

    getEvents() {
        if (!this.id) return Promise.reject(new Error("no clientID is defined"));

        let url = "https://front" + this.server + ".omegle.com/events";
        let data = "id=" + this.id;
        let agent = this.effectiveAgent;

        return retry(6, function(succeed, fail, lastFail) {
            setTimeout(function() { // TODO: only wait 10s if UnknownHostException in java
                axios.post(url, data, {
                    headers: headers(true),
                    httpsAgent: agent
                }).then(response => {
                    succeed(response.data);
                }).catch(fail);
            }, lastFail && !lastFail.response ? 10e3 : 0);
        });
    }

    handleEvents() { // polls for new events to acknowledge
        let _handleEvents = () => {
            this.getEvents().then(data => {
                this.emit("verbose notice", "[events]: " + JSON.stringify(data));
                // before, it is true that _handleEvents wasn't called if the server returned null
                // however, the user wasn't formally disconnected and it wasn't uncommon to see the lurkrate trail off with no response
                // now a died event is properly emitted
                // hopefully this fixes that problem...
                if (!this.done) { // stop polling
                    if (data === null) {
                        this.emit("died", "Server was unreachable for too long and your connection was lost.");
                    } else {
                        this.handleReply(data);
                        setTimeout(_handleEvents, 200);
                    }
                }
            }).catch(this.handleFailure);
        };

        _handleEvents();
    }

    handleReply(data) {
        if (_.isArray(data)) {
            this.handleEventsReply(data);
        } else if (_.isObject(data)) {
            if (data.clientID)
                this.id = data.clientID;
            if (data.events)
                this.handleEventsReply(data.events);
        } else {
            this.emit("verbose notice", "Can't handle reply: `" + data + "`");
        }
    }

    handleEventsReply(events) {
        events.forEach(function(event) {
            if (!_.isArray(event) || event.length < 1 || !_.isString(event[0]))
                this.emit("notice", "Badly formed event: " + event);
            else
                this.handleEvent(event[0], event.slice(1));
        }, this);
    }

    handleEvent(event, args) {
        // for reference, possible events include:
        //     waiting, connected, gotMessage, strangerDisconnected, typing, stoppedTyping, recaptchaRequired, recaptchaRejected,
        //     count, spyMessage, spyTyping, spyStoppedTyping, spyDisconnected, question, serverMessage, error, commonLikes,
        //     antinudeBanned, statusInfo, identDigests, icecandidate, rtccall, rtcpeerdescription, partnerCollege
        // every event from the site is emitted with a ~ prefix
        this.emit("~" + event, args);
        if (event == "recaptchaRequired" || event == "recaptchaRejected") {
            if (!expectStringArg(args))
                this.emit("notice", "Captcha challenge missing:" + args);
            else
                this.emit("captcha", this.captchaSiteKey = args[0]);
        } else if (event == "antinudeBanned") {
            this.emit("ban", args[0]);
        } else if (event == "question") {
            if (!expectStringArg(args))
                this.emit("notice", "Question missing: " + args);
            else
                this.question = args[0];
            // in the original UserConnection.java, Util.sleep(200) must've been there to simulate user reading the question
            // If so, we probably don't need to worry about this here because we aren't sending the welcome announcements
        } else if (event == "gotMessage") {
            if (!expectStringArg(args))
                this.emit("notice", "Message missing: " + args);
            else
                this.emit("message", args[0]);
        } else if (event == "strangerDisconnected") {
            this.isConnected = false;
            this.emit("disconnected");
        } else if (event == "commonLikes") {
            if (!_.isArray(args[0]))
                this.emit("notice", "Common topics missing: " + args);
            else
                this.emit("topics", args[0]);
        }
        if (event == "connected" && ! this.questionMode || event == "question" || event == "gotMessage")
            this.connected(); // note: can use question event, which provides the array of arguments, or can check for question property on user during established event
    }

    run() {
        (this.id != null ? (this.connected(), Promise.resolve()) : this.establishChat()).then(() => {
            if (this.id) {
                this.pollQueue();
                this.handleEvents();
            } else {
                this.emit("died", "connection died before it could be established or server didn't include clientID");
            }
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

module.exports = Connection;
