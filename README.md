This is an extendable trollegle client written in JavaScript. Another (SimpeClient.java) is included in the [trollegle repository](https://gitlab.com/jtrygva/trollegle).

To run this, you must have [node.js](https://nodejs.org) installed. In your clone of the repository (you may download the zip file instead) you must call `npm install`. Then call `node client` to start the client.

After the client is running, call `/-navigate` for help with the UI and call `/-help full` for a list of commands, and a general description.

This client doesn't support tor circuits at the moment, but besides that it supports all of the features of SimpleClient.java. It also supports features that aren't included in SimpleClient:

* actual file logging with `/-out` instead of having to rely on standard output redirection in the execution line.

* view the current pulses with `/-pulses`

* `/-proxymove`

* control over display: display output in terminal or not, and display traditional (without `Stranger: `, and `You: ` replaced by `>`) versus verbose

* `/-loadrc path` run commands from the file

* `/-room room challenge password`, `/-enablelogin` useful with `/-loadrc` for login with `/-challenge`

* a pleasant UI that supports scrolling, colors messages according to their type, and doesn't include interferrence between the display of the input and output. Type `/-navigate` for help with the UI.

* a few other minor features

## Main Benefit ##


The *main benefit* of this client comes from it's file organization and extensibility.

To add new commands, simply 

1. extend `ClientBehavior.js`, override `addAll()` and call `super.addAll()`. 

2. Then, extend `Client.js`, override `makeBehavior()`, and include the `if (require.main === module)` check in your file.


To modify the behavior of the client (e.g. in order to make a bot with automatic behavior, perhaps to let users play hangman), simply extend `Client.js`, override the event callback methods, and include the `if (require.main === module)` check.

### Example ###

A [hangman bot example](./bots/hangman) is now available!

To run it call `node ./bots/hangman/HangmanBot`. You might wish to manually set a lurkrate with `/-lurkrate 5`.