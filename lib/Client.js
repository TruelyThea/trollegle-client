const _ = require("underscore");
const {pad} = require("./Util");
const ClientBehavior = require("./ClientBehavior");
const Connection = require("./Connection");
const Sha1 = require("./libraries/Sha1");

const INACTIVE_HUMAN = 13 * 59 * 1000;

class Client {

    constructor() {
        this.args = process.argv.slice(2);
        this.verbose = false;

        this.qShown = false;

        this.doHandoff = false;
        this.doConnect = false;

        this.lurkRate = 0;
        this.lurkMessages = ["/8"];
        this.lastLurk = 0;
        this.lurkTask = null;
        this.id = null;
        this.proxy = null;
        this.proxyMove = false;
        this.front = null;
        this.questionMode = false;
        this.topicsArray = null;
        this.lang = "en";
        this.fileStream = null;
        this.display = true;
        this.color = true;
        this.style = Client.style.TRADITIONAL;
        this.enableLogin = true;
        this.rooms = [];

        this.afterStartup = false;

        this.user = null;
        this.behavior = this.makeBehavior();

        // tor circuits?
    }

    makeBehavior() {
        return new ClientBehavior(this);
    }

    setupUI() {
        let onInput = (input) => {
            if (input.trim() == "") return;
            if (input.startsWith("/-"))
                this.command(input.slice(2));
            else
                this.say(input);
        };

        let onQuit = () => {
            if (this.user && this.user.isConnected) {
                this.command("disconnect").then(function() {
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        };

        this.logInner = require("./interfaces/textualUI")(onInput, onQuit, this);
    }

    run() {
        this.setupUI();

        this.log("Welcome to the command-line client! Type \"/-help\", \"/-help full\", and \"/-navigate\" for help.");

        this.args.forEach(function(arg) {
            if (arg.startsWith("-"))
                this.command(arg.slice(1));
        }, this);

        let topics = this.args.filter(function(arg) {
            return !arg.startsWith("-");
        });

        this.topicsArray = this.topicsArray || topics.length > 0 ? topics.concat(this.topicsArray || []) :
            ["groupchat", "irc", "groupchats", "chatrooms", "math", "maths", "language", "programming", "government"];

        if (this.doHandoff || this.id != null || this.doConnect)
            this.initiateUser();

        this.afterStartup = true;
    }

    command(data) {
        // during startup also compatible with loadrc, given the command doesn't contain =
        let args = this.afterStartup ? data.split(/\s+/) : data.split(/\=|\s+/);

        try {
            // note that behavior is not a function, so this isn't the call in Function.prototype
            return this.behavior.call(args[0], args.slice(1));
        } catch (ex) {
            this.logVerbose(ex);
            this.log(ex.message);
        }
    }

    initiateUser() {
        if (this.user) { // /-c called twice
            this.log("A connection already is present. If you wish to start a new connection, call /-leave first.");
            return;
        }

        this.user = this.registerListeners(new Connection(this));

        if (this.doHandoff) {
            this.user.establishChat().then(() => {
                if (this.user)
                    this.log(this.user.id);
                else
                    this.log("Couldn't perform handoff; perhaps there was a captcha or a ban or the connection died.");
                // process.exit(0); // would cause the text on the new interface to not show..., so user has to press Ctrl-C, unfortunately
            });
        } else {
            this.user.run();
        }

        return this.user;
    }

    registerListeners(user) {
        return user
          .once("established", () => {
            if (!this.qShown) {
                this.qShown = true;
                this.log(user.question != null ? "Question to discuss: " + user.question : "Connected");
            }
            this.lastLurk = Date.now();
            this.scheduleLurk();
        }).once("disconnected", () => {
            this.log("Stranger has disconnected");
            this.removeUser();
        }).once("died", data => {
            this.log("died: " + data);
            this.removeUser();
        }).once("captcha", data => {
            this.log("captcha: " + data);
            this.removeUser();
        }).once("ban", data => {
            this.log("ban: " + data);
            this.removeUser();
        }).on("message", data => {
            this.hear(data);
            let parts = data.split(/ +/);
            if (this.enableLogin && parts.length >= 5 && parts[1] == "Login" && parts[2] == "challenge:")
                this.inspectChallenge(parts[3], parts[4]);
        }).on("successful send", time => {
            this.lastLurk = time;
            this.scheduleLurk();
        }).on("unsuccessful send", (time, action, msg) => {
            this.log("Failed to send " + action + (msg ? " with `" + msg + "`": "") + ".");
            // I'm not exactly sure why we do this, I'm just following SimpleClient.java
            this.lastLurk += Math.max(0, INACTIVE_HUMAN - time + this.lastLurk);
            this.scheduleLurk();
        }).on("notice", this.log, this)
          .on("verbose notice", this.logVerbose, this);
    }

    removeUser() {
        if (this.user)
            this.user.dispose();
        this.user = null;
        this.qShown = false;
        clearTimeout(this.lurkTask);
    }

    inspectChallenge(salt, challenge) { // essentially from https://bellawhiskey.ca/trollegle.user.js
        var matching = this.rooms.filter((a) => Sha1.hash(salt + a[1]) == challenge);
        if (matching.length) {
            if (matching.length == 1) {
                var a = matching[0];
                this.log("This *seems* to be " + a[0]);
                this.say("/password " + Sha1.hash(salt + a[2]));
            } else {
                this.log("More than one matching room found (" + matching.map((a) => a[0]).join(", ") +
                        "). There might be something amiss in the settings.");
            }
        } else {
            this.log("This doesn't look like a known room");
        }
    }

    scheduleLurk() {
        clearTimeout(this.lurkTask); // okay even if lurkTask is null

        // `unsuccessfulSend` changes lastLurk and calls this to reschedule the lurk.
        // Also, after calling `/-lurkrate`, this is called to reschedule the lurk.
        let wait = Math.max(0, this.lurkRate + this.lastLurk - Date.now());

        // must be less than or equal to the max signed int,
        // otherwise would be overflow and immediate execution of lurk function (well, on the next tick)
        if (wait > 0x7FFFFFFF)
            this.logVerbose("Cannot schedule lurk because lurkrate is too long");
        else if (this.lurkRate > 0) // lurkRate == 0 => not scheduled
            this.lurkTask = setTimeout(this.lurk.bind(this), wait);
    }

    lurk() {
        // why would we want to format the string with  System.currentTimeMillis() / 1000 as first fill?
        this.say(_.sample(this.lurkMessages));
    }

    log(data) {
        let d = new Date();
        let time = pad("00", d.getUTCHours()) + ":" + pad("00", d.getUTCMinutes());
        let msg = time + " " + data;
        if (this.display)
            this.logInner(msg);
        if (this.fileStream)
            this.fileStream.write(msg.replace(/\r?\n/g, "\r\n") + "\r\n");
    }

    logVerbose(ex) {
        if (this.verbose)
            this.logInner(ex);
    }

    // This is overriden by setupUI() by default
    logInner(line) {
        console.log(line);
    }

    hear(data) {
        let prepend = this.style == Client.style.TRADITIONAL ? "" : "Stranger: ";
        // the site server seems to insert random space in messages
        // (try listening on /-verbose for a little while to see)
        this.log(prepend + data.replace(/  +/g, " "));
    }

    say(data) {
        let prepend = this.style == Client.style.TRADITIONAL ? "> " : "You: ";
        if (this.user && this.user.isConnected) {
            this.log(prepend + data);
            this.user.schedSend(data);
        }
    }

    inject(code) {
        try {
            (new Function("client", code))(this);
        } catch (ex) {
            this.log(ex.message);
            this.logVerbose(ex);
        }
    }
}

Client.style = {
    TRADITIONAL: 0,
    VERBOSE: 1
};

if (require.main === module) {
    new Client().run();
}

module.exports = Client;
