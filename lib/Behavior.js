const _ = require("underscore");
const EventEmitter = require("eventemitter3");

class Command {
    constructor(context, name, helpString, argLen, body, aliases) {
        if (argLen == null && body == null) {
            body = helpString;
            helpString = null;
        } else if (body == null) {
            body = argLen;
            argLen = helpString;
            helpString = null;
        }

        this.name = name;
        this.helpString = helpString;
        this.aliases = aliases;
        // I haven't decided whether I want to bind context as `this` context
        // or only as the first argument to body; for now, the former will be
        this.body = function(args) {
            if (args.length < argLen) {
                throw new Error(name + " requires " + argLen + " arguments.");
            }
            return body.apply(context, args);
        }
    }
}

class Behavior extends EventEmitter {
    constructor(context) {
        super();
        this.context = context;
        this.commands = {};
        this.aliases = {};
    }

    addCommand(name, helpString, argLen, body, aliases) {
        let cmd = new Command(this.context, name, helpString, argLen, body, aliases);
        this.commands[name] = cmd;
        if (_.isArray(aliases))
            aliases.forEach(function(name) {
                this.aliases[name] = cmd;
            }, this);
    }

    call(name, args) {
        let result = null;
        let cmd = (this.commands[name] || this.aliases[name]);

        if (cmd) { // command is defined
            result = cmd.body(args);
            this.emit(cmd.name, args);
        } else if (this.listeners(name).count == 0) { // command isn't defined, and there are no listeners for name
            throw new Error(name + " is not a valid command.");
        }

        this.emit(name, args); // there are either listeners for name or the command exists
        return result;
    }

    get list() {
        return _.keys(this.commands);
    }
}

module.exports = Behavior;
