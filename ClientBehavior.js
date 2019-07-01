const Behavior = require("./Behavior");
const _ = require("underscore");
const fs = require("fs");
const Client = require("./Client");
let axios = require("axios").create({timeout: 30e3});

function predAssign(value) {
    return function(predicate) {
        this[value] = (/^(true|on)$/i.test(predicate));
    };
}

function keywordPredicate(args, cmd) {
    return _.every(args, function(word) {
        let pat = new RegExp("\\b" + word + "\\b");
        return !/^[\w\d]+$/.test(word) || pat.test(cmd.helpString) || 
            cmd.name == word.toLowerCase() || _.some(cmd.aliases, function(alias) {
                return alias == word.toLowerCase();
            });
    });
}

class ClientBehavior extends Behavior {
    constructor(context) {
        super(context);

        this.hidden = [];

        this.addAll();
    }

    addAll() {
        let commands = this.commands;
        let hidden = this.hidden;

        let generateHelp = function(args) {
            let help = "";
            _.filter(commands, function(cmd, key) {
                return args.length ? 
                    args[0] == "full" ? true : keywordPredicate(args, cmd) :
                    !_.contains(hidden, key);
            }).forEach(function(cmd) {
                help += cmd.helpString.slice(1) + "\n";
            });
            return help.trim();
        };

        // todo load command files
        this.addHiddenCommand("help", "/-help [full|words...] : displays command help.\n" + 
            "    Note that command help is sometimes listed as /-cmd=value.\n" +
            "    This is the notation for command-line arguments;\n" +
            "    at runtime, use a space instead of an =.", 0, function() {
            this.log(generateHelp(arguments));
        }, ["h"]);

        this.addCommand("connect", "/-connect join the chat", 0, function() {
            this.doConnect = true;
            if (this.afterStartup)
                this.initiateUser();
        }, ["c"]);

        this.addCommand("leave", "/-leave leave the chat", 0, function() {
            let task = Promise.resolve();
            if (this.user) { // need to test
                this.log(this.user.isConnected ? "You have disconnected" : "You quit before the connection was established");
                task = this.user.sendDisconnect();
                this.removeUser();
            } else {
                this.log("You have not yet connected");
            }
            return task;
        }, ["disconnect", "l"]);

        this.addCommand("topics", "/-topics=tpc1,tpc2,... set the topics for the next chats (space delimited after startup)", 0, function(tpcs) {
            this.topicsArray = !this.afterStartup ? tpcs.split(",") : Array.prototype.slice.call(arguments);
        });

        this.addCommand("lurkrate", "/-lurkrate=ms sets lurk rate (0 to disable)", 1, function(rate) {
            rate = parseInt(rate, 10) || Infinity;
            if (rate < 60)
                rate *= 60;
            if (rate < 3540)
                rate *= 1000;
            this.lurkRate = rate;
            this.scheduleLurk();
        });

        this.addCommand("lurkmsg", "/-lurkmsg=1|2 sets pipe-separated lurk messages (default /8)", 1, function() {
            this.lurkMessages = Array.prototype.join.call(arguments, " ").split(/\|/);
        });

        this.addCommand("takeover", "/-takeover=central1:blah takes an existing connection over (only on startup)", 1, function(id) {
            this.id = id;
        });

        this.addCommand("handoff", "/-handoff prints client id and exits (only on startup)", 0, function() {
            this.handoff = true;
        });

        this.addCommand("id", "/-id prints client id (only while running)", 0, function() {
            let user = this.user
            if (user && user.id) {
                this.log(user.id);
            } else
                this.log("Connection not yet established");
            // log(user.killAndSave());
        });

        this.addCommand("out", "/-out=!|path log the chat to the specified path (by appending or creation) `!` to remove the path and stop logging", 1, function(path) {
            if (this.fileStream) this.fileStream.end();
            this.fileStream = path == "!" ? null : fs.createWriteStream(path, {flags:'a'});
        }, ["logpath", "output"]);

        this.addHiddenCommand("display", "/-display=on|off indicates whether repsonses appear in the terminal", 1, predAssign("display"));

        this.addCommand("style", "/-style=traditional|verbose", 1, function(style) {
            if (style.toLowerCase() == "traditional")
                this.style = Client.style.TRADITIONAL;
            else if (style.toLowerCase() == "verbose")
                this.style = Client.style.VERBOSE;
        }, ["logstyle"]);

        this.addCommand("proxy", "/-proxy=direct|host:port (only affects future connections)", 1, function(host, port) {
            if (host.toLowerCase() == "direct") {
                this.proxy = null;
                return;
            }

            let hostport = host.split(/\:|/, 2);

            if (hostport.length != 2 && !port)
                this.log("I need a port");
            else
                this.proxy = "socks://" + host + (hostport.length == 2 ? "" : port);
        });

        this.addCommand("proxymove", "/-proxymove=true|false (only affects future connections)", 1, predAssign("proxyMove"));

        this.addHiddenCommand("server", "/-server=int (only affects future connections)", 1, function(i) {
            this.front = i;
        }, ["front"]);

        this.addHiddenCommand("lang", "/-lang=locale (only affects future connections)", 1, function(locale) {
            this.lang = locale;
        });

        this.addHiddenCommand("questionmode", "/-questionmode=false|true (only affects future connections)", 1, predAssign("questionMode"), ["question"]);

        this.addHiddenCommand("verbose", "/-verbose", 0, function() {
            this.verbose = true;
        }, ["v"]);

        this.addHiddenCommand("terse", "/-terse", 0, function() {
            this.verbose = false;
        }, ["t"]);

        this.addCommand("pulses", "/-pulses displays the current pulses on the motherships", 0, function() {
            let log = this.log.bind(this);
            ["https://bellawhiskey.ca/trollegle", "https://centimeters.herokuapp.com/trollegle"].forEach(function(mothership) {
                axios.get(mothership + "/raw").then(function(res) {
                    let data = res.data;
                    let pulses = mothership + " -\n";
                    try {
                        _.first(data.pulses, 10).forEach(function(pulse) {
                            pulses += `    ${pulse.room} (${pulse.room.normalize('NFD').replace(/[\u0300-\u036f]/g, "")}): ${pulse.words.join(", ")}\n`
                        });
                    } catch (ex) {
                        pulses += "    response json wasn't formed correctly\n";
                    }
                    log(pulses);
                }).catch(function(err) {
                    log(mothership + " -\n    couldn't be reached: " + err.message + "\n");
                });
            });
        });

    }

    addHiddenCommand(name, helpString, argLen, body, aliases) {
        this.addCommand(name, helpString, argLen, body, aliases);
        this.hidden.push(name);
    }
}

module.exports = ClientBehavior;