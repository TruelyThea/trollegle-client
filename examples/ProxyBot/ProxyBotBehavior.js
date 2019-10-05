const _ = require("underscore");

const {ClientBehavior} = require("trollegle-client");

class ProxyBotBehavior extends ClientBehavior {
    constructor(context) {
        super(context);
    }

    addAll() {
        super.addAll();

        this.addCommand("add", "/-add host:port [host:port...] Add the proxies", 1, function() {
            let prior = this.proxies.length;
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
            this.log("Added " + (this.proxies.length - prior) + " proxies.");
        }, ["append"]);

        this.addCommand("remove", "/-remove {[\"working\": indicator, \"reason\": \"captcha\"|\"ban\"|\"died\"|\"success\", \"proxy\":\"socks://...\", \"searching\":indicator, \"lastChecked\":time]}\n    Remove the proxies that satisfy the matcher object, you can include any number of properties to match to.", 1, function() {
            try {
                let matcher = JSON.parse([].join.call(arguments, " "));
                let prior = this.proxies.length;
                this.proxies = _.filter(this.proxies, _.negate(_.matcher(matcher)));
                this.log("Removed " + (prior - this.proxies.length) + " proxies.");
            } catch (ex) {
                this.log(ex.message);
                this.logVerbose(ex);
            }
        }, ["filter"]);

        this.addCommand("save", "/-save Save the proxy status to the file", 0, function() {
            this.save().then(() => this.log("saved the proxy state"));
        });
    }
}

module.exports = ProxyBotBehavior;
