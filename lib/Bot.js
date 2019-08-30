const Client = require("./Client");

class Bot extends Client {
    constructor() {
        super();
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
    }
}

if (require.main === module) {
    new Bot().run();
}

module.exports = Bot;
