const _ = require("underscore");

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

class Behavior {
    constructor(context) {
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
        let cmd = (this.commands[name] || this.aliases[name]);
        if (!cmd)
            throw new Error(name + " is not a valid command.");
        return cmd.body(args);
    }

    get list() {
        return _.keys(this.commands);
    }
}

module.exports = Behavior;
