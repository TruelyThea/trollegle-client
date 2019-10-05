const _ = require("underscore");
const {Bot, Connection} = require("trollegle-client");
const fs = require("fs"), path = require("path");

const ProxyBotBehavior = require("./ProxyBotBehavior");

class ProxyBot extends Bot {
    constructor() {
        super();
        this.proxies = [];

        this.load().finally(() => { // search twenty-four at a time
            this.proxies.forEach(function(proxy) {
                proxy.searching = false;
            });
            for (let i = 0; i < 24; i++) this.searchProxy();
        });
    }

    makeBehavior() {
        return new ProxyBotBehavior(this);
    }

    searchProxy() {
        if (_.all(this.proxies, function(proxy) { return proxy.searching || Date.now() - proxy.lastChecked < 15 * 60e3; }) ||
                !this.user || !this.user.isConnected || !this.isAdmin()) {
            return new Promise((resolve) => {
                setTimeout(resolve, 5e3);
            }).then(() => this.searchProxy());
        } else {
            let proxy = _.min(this.proxies, function(proxy) {
                return proxy.searching ? Infinity : proxy.lastChecked;
            });
            proxy.searching = true;

            let user = new Connection({
                proxy: proxy.proxy,
                questionMode: false,
                lang: "en",
                proxyMove: false,
                topicsArray: []
            });

            return new Promise((resolve, reject) => {
                user.on("captcha", () => resolve([false, "captcha"]));
                user.on("ban", () => resolve([false, "ban"]));
                user.on("died", () => resolve([false, "died"]));
                user.on("established", () => resolve([true, "success"]));
                user.on("disconnected", () => resolve([true, "success"]));
                ["established", "disconnected", "died", "captcha", "ban", "message"].forEach(function(event) {
                    user.on(event, () => this.logVerbose(proxy.proxy + " " + event));
                }, this);
                
                user.run();
            }).then((results) => {
                if (results[0]) this.say("/!addproxy " + proxy.proxy.slice(9));
                proxy.lastChecked = Date.now();
                proxy.searching = false;
                proxy.working = results[0];
                proxy.reason = results[1];
                this.save();
                user.sendDisconnect();
                user.dispose();
                return this.searchProxy();
            });
        }
    }

    add(proxy) {
        if (!_.findWhere(this.proxies, {proxy: proxy}))
            this.proxies.push({proxy: proxy, lastChecked: 0, searching: false});
    }

    isAdmin() {
       let user =  _.findWhere(this.list, {you: true});
       return user && user.flags.indexOf("A") >= 0;
    }

    load() {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(__dirname, "/status.json"), "utf8", (err, data) => {
                resolve(err ? null : this.proxies = JSON.parse(data));
            });
        });
    }

    save() {
        return new Promise((resolve, reject) => {
            fs.writeFile(path.join(__dirname, "/status.json"), JSON.stringify(this.proxies), (err) => {
                if (err) reject(err);
                else resolve();
            });
        }).catch(function(err) {
            this.log("error writting status.json file: " + err.message);
            this.logVerbose(err);
        });
    }
}

if (require.main === module) {
    new ProxyBot().run();
}

module.exports = ProxyBot;
