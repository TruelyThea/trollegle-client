const _ = require("underscore");

const {ClientBehavior} = require("trollegle-client");

class ProxyBotBehavior extends ClientBehavior {
    constructor(context) {
        super(context);
    }

    addAll() {
        super.addAll();

        this.addCommand("add", "/-add host:port [host:port...] Add the proxies", 1, function() {
            for (let i = 0; i < arguments.length; i++) {
                let proxy = arguments[i];
                if (/^\d{2,5}$/.test(arguments[i + 1])) {
                    proxy += ":" + arguments[i+1];
                    i++;
                }

                if (/^(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}$/.test(proxy))
                    this.add("socks://" + proxy);
                else
                    this.log("Illegal proxy value: " + proxy);
            }
        }, ["append"]);

        this.addCommand("save", "/-save Save the proxy status to the file", 0, function() {
            this.save();
        });
    }
}

module.exports = ProxyBotBehavior;
