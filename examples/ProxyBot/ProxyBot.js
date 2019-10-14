const _ = require("underscore");
const {Bot, Connection} = require("trollegle-client");
const fs = require("fs"), path = require("path");

const ProxyBotBehavior = require("./ProxyBotBehavior");

let isReadyForSearch = function(proxy) { 
    return !proxy.searching && Date.now() - proxy.lastChecked > 15 * 60e3;
};

// This is sort of arbitray right now:
// every hour since being checked adds 1 to the priority
// established sets the priority to max(it's current + 1, 0)
// ban/died subtracts one from the priority
let priority = function(proxy) {
    if (!isReadyForSearch(proxy))
        return -Infinity;
    return (Date.now() - proxy.lastChecked) / (60 * 60e3) + proxy.priority;
};

let updateProxy = function(proxy, event) {
    proxy.working = (event == "established" || event == "disconnected");

    if (proxy.working) proxy.priority = Math.max(proxy.priority + 1, 0);
    else if (event != "captcha") proxy.priority -= 1;

    proxy.reason = event;

    return proxy.working;
};

class ProxyBot extends Bot {
    constructor() {
        super();
        this.proxies = [];
        this.vanilla = false;

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
        let choice = _.max(this.proxies, priority);

        if (!isReadyForSearch(choice)) {
            return new Promise((resolve) => {
                setTimeout(resolve, 5e3);
            }).then(() => this.searchProxy());
        } else {
            choice.searching = true;

            let user = new Connection({
                proxy: choice.proxy,
                questionMode: false,
                lang: "en",
                proxyMove: false,
                topicsArray: []
            });

            return new Promise((resolve, reject) => {
                setTimeout(resolve.bind(null, "died"), 5 * 60e3);
                ["established", "disconnected", "died", "captcha", "ban"].forEach(function(event) {
                    user.once(event, () => {
                        this.logVerbose(choice.proxy + " " + event);
                        resolve(event);
                    });
                }, this);
                user.run();
            }).then((event) => {
                if (updateProxy(choice, event))
                    this.sendProxy(choice.proxy.slice(9));
            }).finally(() => {
                choice.lastChecked = Date.now();
                choice.searching = false;

                this.save();
                user.sendDisconnect();
                user.dispose();
                return this.searchProxy();
            });
        }
    }

    add(proxy) {
        if (!_.findWhere(this.proxies, {proxy: proxy}))
            this.proxies.push({proxy: proxy, lastChecked: 0, searching: false, priority: 0});
    }

    isAdmin() {
       let user =  _.findWhere(this.list, {you: true});
       return user && user.flags.indexOf("A") >= 0;
    }

    sendProxy(proxy) {
        if (this.user && this.user.isConnected)
            this.say((this.isAdmin() ? "/!addproxy " : "/ hey admin, here is a proxy: ") + proxy);
        else
            this.log("Not connected, but found proxy: " + proxy);
    }

    load() {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(__dirname, "/status.json"), "utf8", (err, data) => {
                resolve(err ? null : this.proxies = JSON.parse(data).map((proxy) => {
                    proxy.searching = false;
                    proxy.priority = proxy.priority || 0;
                    return proxy;
                }));
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
