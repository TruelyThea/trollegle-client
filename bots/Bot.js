const Client = require("../Client");

class Bot extends Client {
    constructor() {
        super();
    }

    connected() {
        super.connected();
        this.entered = false;
        this.say("/8");
    }

    begin() { 
        // after getting past the pre-room (if present)
    }

    // no need to override disconnected and died to assign this.entered = false

    message(data) {
        super.message(data);
        // the site server seems to insert random space in messages
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
    }
}

if (require.main === module) {
    new Bot().run();
}

module.exports = Bot;