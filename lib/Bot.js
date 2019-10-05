const _ = require("underscore");
const Client = require("./Client");

class Bot extends Client {
    constructor() {
        super();
        this.list = [];
        this.lastUpdate = 0;
    }

    registerListeners(user) {
        return super.registerListeners(user)
            .once("established", () => {
                this.entered = false;
                this.say("/8");
            }).on("message", data => {
                // the site server seems to insert random space in messages
                // (try listening on /-verbose for a little while to see)
                data = data.trim().replace(/\s+/g, " ");

                if (data.indexOf("#A") == 0) {
                    try {
                        let updates = JSON.parse(data.slice(3));
                        this.lastUpdate = updates.time;
                        if (updates.action == "user_list") this.list = updates.users;
                        else if (updates.action == "update_list") {
                            delete updates.action;
                            delete updates.time;
                            let user =  _.findWhere(this.list, {id: updates.user});
                            if (user) _.extend(user, updates);
                        }
                    } catch (ex) {
                        // noop
                    }
                }

                let mustSay = data.match(/^\| .* you need to say (the word \")?(.+?)\"?\./);
                if (!this.entered && mustSay) {
                    this.entered = true;
                    this.say(mustSay[2]);
                    this.begin();
                } else if (!this.entered && /^\| You\'ve been here for/.test(data)) {
                    this.entered = true;
                    this.begin();
                }
            });
    }

    begin() { 
        // after getting past the pre-room (if present)
        this.say("/bot");
        this.say("/list");
    }
}

if (require.main === module) {
    new Bot().run();
}

module.exports = Bot;
