const Behavior = require("./Behavior");
const _ = require("underscore");
const fs = require("fs");
const querystring = require("querystring")
const Client = require("./Client");
let axios = require("axios").create({timeout: 30e3});

const {matchesEachKeyword, formatDate} = require("./Util");

function predAssign(value, doLog) {
    return function(predicate) {
        this[value] = (/^(true|on|1|yes|y)$/i.test(predicate));
        if (doLog)
            this.log("Setting " + value + " to " + (this[value] ? "on" : "off"));
    };
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
            let help = "Displaying command /-help" + (args.length > 0 ? ":\n" : " (other helpful commands include \"/-help full\" and \"/-navigate\")\n");
            _.filter(commands, function(cmd, key) {
                return args.length ?
                    args[0] == "full" ? true : matchesEachKeyword(cmd, args) :
                    !_.contains(hidden, key);
            }).forEach(function(cmd) {
                help += cmd.helpString.slice(1) + "\n";
            });
            return help;
        };

        this.addHiddenCommand("help", "/-help [full|words...] : displays command help.\n" +
            "    Note that command help is sometimes listed as /-cmd=value.\n" +
            "    This is the notation for command-line arguments;\n" +
            "    at runtime, use a space instead of an =.\n" +
            "    Some commands have shorthand aliases like /-c for /-connect see ClientBehavior.js for these.", 0, function() {
            this.log(generateHelp(arguments));
        }, ["h"]);

        this.addHiddenCommand("navigate", "/-navigate : displays help for navigating the text-based user interface.", 0, function() {
            this.log(
                "When focus is on the input field, press `esc` to focus the log,\n" +
                "    or press `enter` to focus the log if the input field is empty.\n" +
                "Similarly, press `esc` or `enter` to focus the input bar if the log has focus.\n" +
                "If focus is on the log: \n" +
                "    Press either `j` or the down arrow to scroll down.\n" +
                "    Press either `k` or the up arrow to scroll up.\n" +
                "    Press `g` to jump to the first line.\n" +
                "    Press `shift+g` to jump to the last line.\n"
            );
        });

        this.addCommand("connect", "/-connect [TOPICS] join the chat. If topics are provided, they'll temporarilly replace /-topics", 0, function() {
            this.doConnect = true;
            if (this.afterStartup)
                this.initiateUser([].slice.call(arguments, 0)); // okay if /-c called twice
        }, ["c"]);

        this.addCommand("leave", "/-leave leave the chat", 0, function() {
            let task = Promise.resolve();
            if (this.user) {
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
            let topics = this.topicsArray.join(", ");
            this.log("Topics set to: " + topics.slice(0, 30) + (topics.length > 30 ? "...." : "."));
        });

        this.addCommand("lurkrate", "/-lurkrate=[m<60|s<3541|ms] sets lurk rate (0 to disable)", 1, function(rate) {
            rate = parseInt(rate, 10) || 0; // lurk canceled by scheduleLurk if 0
            var unit = rate == 0 ? "off" : rate + (rate < 60 ? "m" : rate < 3541 ? "s" : "ms");
            if (rate < 60)
                rate *= 60;
            if (rate < 3541)
                rate *= 1000;
            this.lurkRate = rate;
            this.scheduleLurk();
            this.log("Setting lurkrate to " + unit + ".");
        });

        this.addCommand("lurkmsg", "/-lurkmsg=1|2 sets pipe-separated lurk messages (default /8)", 1, function() {
            this.lurkMessages = Array.prototype.join.call(arguments, " ").split(/\|/);
        });

        this.addCommand("takeover", "/-takeover=central1:blah takes an existing connection over (only on startup)", 1, function(id) {
            this.id = id;
        });

        this.addCommand("handoff", "/-handoff prints client id and exits (only on startup)", 0, function() {
            this.doHandoff = true;
        });

        this.addCommand("id", "/-id prints client id (only while running)", 0, function() {
            let user = this.user;
            if (user && user.id) {
                this.log(user.id);
            } else
                this.log("Connection not yet established");
            // log(user.killAndSave());
        });

        this.addCommand("out", "/-out=!|path log the chat to the specified path (by appending or creation)\n" +
            "    `!` to remove the path and stop logging\n" +
            "    :today: will be replaced by yyyy-mm-dd", 1, function(path) {
            if (this.fileStream) this.fileStream.end();
            path = path.replace(/:today:/gi, formatDate(Date.now()));
            let fStream = this.fileStream = path == "!" ? null : fs.createWriteStream(path, {flags:'a'});
            if (fStream)
                fStream.on('error', (err) => {
                    this.fileStream = null;
                    this.log(err);
                    this.log("the file output has been stopped.");
                    fStream.end();
                });
        }, ["logpath", "output"]);

        this.addCommand("loadrc", "/-loadrc=[FILE]?<querystring> Run commands/ say messages from the FILE. Beware of recursion!\n" +
            "    no argument defaults file .multirc\n" +
            "    `#` at the start of a line designates a comment in file\n" +
            "    optionally a query string ?key=value&key2=value2... will fill\n" +
            "        :key: to value in each command; keys must only consist of alphanumeric characters", 0, function() {
            var path = Array.prototype.join.call(arguments, "=") || ".multirc";
            var keys = {
                "colon": ":",
                "_": ":"
            };

            var index = path.indexOf("?");
            if (index > 0) {
                _.extend(keys, querystring.parse(path.slice(index + 1)));
                path = path.slice(0, index);
            }

            var isKey = new RegExp("\:(" + Object.keys(keys).filter(function(key) {
                return /^\w+$/.test(key);
            }).join("|") + ")\:", "gi");

            fs.readFile(path, "utf8", (ex, data) => {
                if (ex) {
                    this.log("Could not load the rc file.");
                    this.logVerbose(ex);
                } else {
                    data.split(/\r\n|\n/).forEach(function(command) {
                        command = command.replace(isKey, function(match) {
                            return keys[match.slice(1,-1)];
                        });
                        if (command.trim() == "") return;
                        if (command.startsWith("/-"))
                            this.command(command.slice(2));
                        else if (!command.startsWith("#"))
                            this.say(command);
                    }, this);
                }
            });
        }, ["load"]);

        this.addCommand("include", "/-include=FILE inject the JavaScript code in FILE into the process. See also /-inject.", 1, function(path) {
            fs.readFile(path, "utf8", (ex, data) => {
                if (ex) {
                    this.log("Could not load the JS file.");
                    this.logVerbose(ex);
                } else {
                    this.inject(data);
                }
            });
        }, ["include"]);

        this.addCommand("inject", "/-inject=CODE inject the JavaScript code into the process.\n" +
            "    `client`, `_` (underscore.js), `Client`, `Connection`, `Behavior`, and `ClientBehavior`\n" +
            "        are global variables.\n" +
            "    Beware: asyncronous errors could crash the process.", 0, function() {
            this.inject(Array.prototype.join.call(arguments, " "));
        }, ["inject", "code", "js", "-"]);

        this.addHiddenCommand("log", "/-log=<text> Log the text", 0, function() {
            this.log(Array.prototype.join.call(arguments, " "));
        }, ["tell"]);

        this.addHiddenCommand("display", "/-display=on|off indicates whether repsonses appear in the terminal", 1, predAssign("display"));

        this.addCommand("color", "/-color=on|off (currently only affects future messages in an interface that supports colors, like the default interface)", 1, predAssign("color"), ["colors"]);

        this.addHiddenCommand("style", "/-style=traditional|verbose", 1, function(style) {
            if (style.toLowerCase() == "traditional")
                this.style = Client.style.TRADITIONAL;
            else if (style.toLowerCase() == "verbose")
                this.style = Client.style.VERBOSE;
        }, ["logstyle"]);

        this.addCommand("proxy", "/-proxy=direct|host:port (only affects future connections)", 1, function(host, port) {
            if (host.toLowerCase() == "direct") {
                this.proxy = null;
            } else {
                let hostport = host.split(":", 2);

                if (hostport.length != 2 && !port)
                    this.log("I need a port");
                else
                    this.proxy = "socks://" + host + (hostport.length == 2 ? "" : ":" + port);
            }

            this.log("Setting proxy to " + (this.proxy || "direct"));
        });

        this.addCommand("proxymove", "/-proxymove=true|false (only affects future connections)", 1, predAssign("proxyMove", true));

        this.addHiddenCommand("server", "/-server=int (only affects future connections)", 1, function(i) {
            this.front = i;
        }, ["front"]);

        this.addHiddenCommand("lang", "/-lang=locale (only affects future connections)", 1, function(locale) {
            this.lang = locale;
        });

        this.addHiddenCommand("questionmode", "/-questionmode=false|true (only affects future connections)", 1, predAssign("questionMode"), ["question", "q"]);

        this.addHiddenCommand("verbose", "/-verbose", 0, function() {
            this.verbose = true;
        }, ["v"]);

        this.addHiddenCommand("terse", "/-terse", 0, function() {
            this.verbose = false;
        }, ["t"]);

        this.addCommand("pulses", "/-pulses displays the current pulses on the motherships", 0, function() {
            ["https://bellawhiskey.ca/trollegle", "https://centimeters.herokuapp.com/trollegle"].forEach(function(mothership) {
                axios.get(mothership + "/raw").then(res => {
                    let data = res.data;
                    let pulses = "Pulses for: " + mothership + " -\n";
                    try {
                        _.first(data.pulses, 10).forEach(function(pulse) {
                            pulses += `    ${pulse.room} (${pulse.room.normalize('NFD').replace(/[\u0300-\u036f]/g, "")}): ${pulse.words.join(", ")}\n`;
                        });
                        if (data.pulses.length == 0) pulses += "    (No rooms are listed on this mothership)\n"; // this was a suggestion from #1
                    } catch (ex) {
                        pulses += "    (response json wasn't formed correctly)\n";
                    }
                    this.log(pulses);
                }).catch(err => {
                    this.log(mothership + " -\n    couldn't be reached: " + err.message + "\n");
                });
            }, this);
        }, ["pulse", "p"]);

        this.addHiddenCommand("enablelogin", "/-enablelogin=true|false", 1, predAssign("enableLogin", true), ["enable"]);
        this.addCommand("room", "/-room room challenge password (add the triple to the challenge collection). useful with /-loadrc", 3, function(room, challenge, password) {
            this.rooms.push([room, challenge, password]);
        }, ["addroom", "challenge", "addchallenge"]);

    }

    addHiddenCommand(name, helpString, argLen, body, aliases) {
        this.addCommand(name, helpString, argLen, body, aliases);
        this.hidden.push(name);
    }
}

module.exports = ClientBehavior;
