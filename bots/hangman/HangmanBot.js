const _ = require("underscore");
const Bot = require("../Bot");

var phrases = require("./phrases");

class HangmanBot extends Bot {
    constructor() {
        super();

        this.sayUpdates = _.throttle(function() {
            // no need to override died, diconnected, and /-leave to call this.sayUpdates.cancel()
            if (!this.user || !this.user.isConnected) return;

            if (this.isGuessed()) {
                this.say("status: " + this.phrase + "; " + this.nextUpdate);
                this.initiatePhrase();
                this.sayUpdates();
            } else {
                let status = this.phrase.split("").map(function(letter) {
                    return letter == " " || this.historyContains(letter) ? letter : "_";
                }, this).join("");
                this.say("status: " + status + "; " + this.nextUpdate);
                this.nextUpdate = "";
            }
        }, 7e3);
    }

    initiatePhrase() {
        this.phrase = _.sample(phrases);
        this.history = [];
        this.nextUpdate = "new phrase; ";
    }

    historyContains(guess) {
        return this.history.some(function(update) {
            return update.toLowerCase() == guess.toLowerCase();
        });
    }

    isGuessed() {
        let phraseGuessed = this.historyContains(this.phrase);
        let eachLetterGuessed = this.phrase.split("").every(function(letter) {
            return letter == " " || this.historyContains(letter);
        }, this);
        return phraseGuessed || eachLetterGuessed;
    }

    update(user, guess) {
        if (!this.isGuessed()) {
            this.nextUpdate += user + " guessed `" + guess + "`; ";
            if (!this.historyContains(guess))
                this.history.push(guess);
            if (guess.length > 1) { // a phrase was guessed
                if (this.isGuessed()) {
                    this.nextUpdate += "`" + guess + "` is the correct phrase! Congratulations, " + user + "!";
                } else {
                    this.nextUpdate += "`" + guess + "` is not the phrase; ";
                }
            } else { // a letter was guessed
                if (this.isGuessed()) {
                    this.nextUpdate += "the phrase has been filled in!";
                } 
            }
            this.sayUpdates();
        }
    }

    connected() {
        super.connected();
        this.initiatePhrase();
    }

    begin() {
        setTimeout(this.say.bind(this, "/nick BeepBoop"), 4e3);
        setTimeout(this.say.bind(this, "I am a hangman bot. I accept guesses via private messages."), 8e3);
        setTimeout(this.sayUpdates.bind(this), 14e3);
    }

    message(data) {
        super.message(data);
        // the site server seems to insert random space in messages
        data = data.trim().replace(/\s+/g, " ");

        let guess = data.match(/^[\[\<]\(private\) (.+)[\]\>] (.+)$/);
        if (guess) {
            this.update(guess[1], guess[2]);
        }
    }
}

if (require.main === module) {
    new HangmanBot().run();
}

module.exports = HangmanBot;