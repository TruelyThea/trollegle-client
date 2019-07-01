This is an extendable trollegle client written in JavaScript. Another (SimpeClient.java) is included in the [trollegle repository](https://gitlab.com/jtrygva/trollegle).

To run this, you must have [node.js](https://nodejs.org) installed. In your clone of the repository (you may download the zip file instead) you must call `npm install`. Then call `node client` to start the client.

After the client is running, call `/-help full` for a list of commands, and a general description.

This client doesn't support tor circuits at the moment, but besides that it supports all of the features of SimpleClient.java. It also supports features that aren't included in SimpleClient:

* actual file logging with `/-out` instead of having to rely on standard output redirection in the execution line.

* view the current pulses with `/-pulses`

* `/-proxymove`

* control over display: display output in terminal or not, and display traditional (without `Stranger: `, and `You: ` replaced by `>`) versus verbose

* a few other minor features

## Main Benefit ##


The *main benefit* of this client comes from it's file organization and extensibility.

To add new commands, simply 

1. extend `ClientBehavior.js`, override `addAll()` and call `super.addAll()`. 

2. Then, extend `Client.js`, override `makeBehavior()`, and include the `if (require.main === module)` check in your file.


To modify the behavior of the client (e.g. in order to make a bot with automatic behavior, perhaps to let users play hangman), simply extend `Client.js`, override the event callback methods, and include the `if (require.main === module)` check.

### Example ###

To make a hangman bot I would imagine:

1. in the constructor store: 

    an `_.throttle`'d `sayUpdate()` function to say updates,

    an `update(user, guess)` function that updates the guesses, word, etc., and calls `sayUpdate()`,
    
    and any other variables (current word, guesses).

2. override `connected()` to call `say("/nick BeepBoop")`, initiate the `word` and `guess` array, and after, say, four seconds `say()` a description of the bot

3. override `message()` to call the `update()` function if the message matches `/^\[\(private\) (.+)\] (.)/`. The first group is the user, and the second group is the guess.

4. override `died()` and `disconnected()` to reset the word, guesses, or clear any timeouts connected to your bot

5. and possibly also override `/-leave` from `ClientBehavior.js` in a new subclass by overriding `addAll()` and calling `this.addCommand("leave", ...` in order to do the same as item 4.

