const BasicConection = require("./BasicConnection");
const _ = require("underscore");

function expectStringArg(args) {
    return _.isString(args[0]);
}

class UserConnection extends BasicConection {

    constructor(client) {
        super(client);

        this.question = null;
        this.client = client;
        this.captchaSiteKey = "";
        this.done = false;
        this.isConnected = false;
        this.tellQueue = [];
        this.seesTyping = false;
        this.lastLurk = 0;

        this.connected = _.once(function() {
            this.isConnected = true;
            client.connected();
        });
        this.banned = _.bind(client.ban, client);
        ["log", "logVerbose"].forEach(function(value) {
            this[value] = _.bind(client[value], client)
        }, this);
    }

    dispose() {
        this.done = true;
    }

    establishChat() {
        if (!this.questionMode) {
            this.logVerbose("!! Listening on front" + this.server);
        }
        this.logVerbose("Starting chat on front " +  this.server);

        return super.establishChat().then(function(data) {
            if (!_.isObject(data)) { // *should* be string and data.trim() == ""
                this.banned("empty reply");
            } else if (_.isEmpty(data)) { // *should* be {}
                this.banned("empty object");
            } else {
                this.logVerbose("Connection established");
                this.handleReply(data);
            }
            // return this.id;
        }.bind(this)).catch(function(ex) {
            this.isConnected = false;
            // could be a fail from a old timedout request, after already disconnected formally)
            // in which case don't call died
            if (this.client.user == this)
                this.client.died(ex.message);
            // if (this.client.verbose) {
                // console.error(ex);
            // } else {
                this.log(ex.message);
            // }
        }.bind(this));
    }

    sendTyping(typing) {
        if (typing)
            return this.sendAction("typing", null);
        return this.sendAction("stoppedtyping", null);
    }

    sendDisconnect() {
        this.isConnected = false;
        return this.sendAction("disconnect", null);
    }

    sendAction(action, msg) {
        let lurk = Date.now();
        let client = this.client;
        return super.sendAction(action, msg).then(function() {
            client.successfulSend(lurk, action, msg);
        }).catch(function() {
            client.unsuccessfulSend(lurk, action, msg);
        });
    }

    sendActionInner(action, msg) {
        return super.sendActionInner(action, msg).catch(function(ex) {
            this.isConnected = false;
            if (this.client.user == this) // could be a fail from a old timedout request, after already disconnected formally)
                this.client.died(ex.message);
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
        if (this.done) return;

        let queue = this.tellQueue;

        let poll = function() { // this part is especially ugly, needs to be made better; possibly with promises
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
                poll();
            } else {
                if (!msg.startsWith("["))
                    this.logVerbose("[sending] " + msg);
                if (!this.seesTyping)
                    this.sendTyping(true);
                setTimeout(function() {
                    this.sendAction("send", msg);
                    setTimeout(function() {
                        this.seesTyping = false;
                        poll();
                    }.bind(this), 75);
                }.bind(this), 75 + Math.floor(30 * Math.log(msg.length)));
            }
        }.bind(this);

        setTimeout(function() {
            if (!this.isConnected) {
                queue.length = 0; // no prior scheduling, excess lurks, e.g. removed
                this.pollQueue();
                return;
            }
            poll();
        }.bind(this), 75);
    }

    handleEvents() { // polls for new events to acknowledge
        let _handleEvents = function() {
            this.getEvents().then(function(data) {
                this.logVerbose("[events]: " + JSON.stringify(data));
                // before, it is true that _handleEvents wasn't called if the server returned null
                // however, the user wasn't formally disconnected and it wasn't uncommon to see the lurkrate trail off with no response
                // now this.died() is properly called if null is returned
                // hopefully this fixes that problem...
                if (!this.done) {
                    if (data === null) {
                        this.died("Server was unreachable for too long and your connection was lost.");
                    } else {
                        this.handleReply(data);
                        setTimeout(_handleEvents, 200);
                    }
                }
            }.bind(this)).catch(function(ex) {
                this.isConnected = false;
                // could be a fail from a old timedout request, after already disconnected formally)
                // so if this is the current user:
                if (this.client.user == this) { 
                    this.client.died(ex.message);
                    // if (this.client.verbose) {
                        // console.error(ex);
                    // } else {
                        this.log(ex.message);
                    // }
                }
            }.bind(this));
        }.bind(this);

        _handleEvents();
    }

    handleReply(data) {
        if (this.client.user !== this) return; // could be formally disconnected already?
        if (_.isArray(data)) {
            this.handleEventsReply(data);
        } else if (_.isObject(data)) {
            if (data.clientID) {
                this.id = data.clientID;
            }
            if (data.events) {
                this.handleEventsReply(data.events);
            }
        } else  {
            this.log("Can't handle reply: " + line);
        }
    }

    handleEventsReply(events) {
        events.forEach(function(event) {
            if (!_.isArray(event) || event.length < 1 || !_.isString(event[0]))
                this.log("Badly formed event: " + event);
            else 
                this.handleEvent(event[0], event.slice(1));
        }, this);
    }

    handleEvent(event, args) {
        if (event == "recaptchaRequired" || event == "recaptchaRejected") {
            if (!expectStringArg(args))
                this.log("Captcha challenge missing:" + args);
            else
                this.client.captcha(this.captchaSiteKey = args[0]);
        } else if (event == "antinudeBanned") {
            // console.log("ban", args); // commented out for now
            this.banned("antinudeBanned");
        } else if (event == "typing") {
            this.client.typing();
        } else if (event == "stoppedTyping") {
            this.client.stoppedTyping();
        } else if (event == "question") {
            if (!expectStringArg(args))
                this.log("Question missing: " + args);
            else
                this.question = args[0];
            this.connected();
            // sleep in java?
        } else if (event == "gotMessage") {
            this.connected();
            if (!expectStringArg(args))
                this.log("Message missing: " + args);
            else
                this.client.message(args[0]);
        } else if (event == "strangerDisconnected") {
            this.isConnected = false;
            this.client.disconnected();
        } else if (event == "connected" && !this.questionMode) {
            this.connected();
        } else if (event == "commonLikes") {
            if (!_.isArray(args[0]))
                this.log("Common topics missing: " + args);
            else
                this.client.commonTopics(args[0]);
        }
    }

    run() {
        if (this.id != null) this.connected();
        (this.id != null ? Promise.resolve() : this.establishChat()).then(function() {
            if (this.id) {
                this.pollQueue();
                this.handleEvents();
            } else {
                this.client.died();
            }
        }.bind(this));
    }


}

module.exports = UserConnection;