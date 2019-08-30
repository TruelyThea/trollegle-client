Documentation for `trollegle-client` version `2.0.0`:

*What's new in version two?* The code has been restructured a little, and now `Connection` is an `EventEmitter` and doesn't call `Client` methods.

This is an extensible command-line client for trollegle. The [hangman bot example](./bots/hangman) illustrates how you can extend the Client to make a bot. To run it, navigate to its subdirectory, call `npm install`, and then call `npm start`.

## Selected Table of Contents ##

[Installation](#installation)

[Documentation](#documentation)

* [Connection](#connection)
* [Behavior](#behavior)
* [ClientBehavior](#clientbehavior)
* [Client](#client)
* [Bot](#bot)

## <a name="installation"></a> Installation ##

    $ npm install --save github:TruelyThea/trollegle-client

## <a name="documentation"></a> Documentation ##

requiring `trollegle-client` provides an object that exposes the classes `Connection`, `Behavior`, `ClientBehavior`, `Client`, and `Bot`, as well as some prepared interfaces.

### <a name="connection"></a> Connection ###

    const Connection = require("trollegle-client").Connection;
    let connection = new Connection(client);
    connection.once("established", client.log.bind(client, "connected"));
    connection.on("message", client.hear, client);

`Connection` inherits from `EventEmitter`. The lists of properties and methods below are incomplete.

#### Constructor ####

    new Connection(client)

This constructor takes the client that intends to listen to its events, but only to assume some of its properties for configuration purposes.

#### Selected Properties ####

* `done` - indicates whether this is the current connection for its client (*note:* a `Connection` instance should be associated with only one `Client` instance).

* `isConnected` - indicates whether the connection has been established and hasn't died or been terminated.

* `question` - the join question, or `null`.

#### Selected Methods ####

* `dispose()` - removes all event listeners on the connection's events, this should be called when we want to terminate the current connection for its associated `Client`. After there are no event listeners for the `"message"` event, `done` is `true`, which stops polling for events and sending client actions.

* `run()` - establishes itself, then polls for new actions to send and events to handle.

* `schedSend(msg)` - queues the message so that it can be sent later. `msg` should be a string.

* `schedSendTyping(typing)` - queues the action so that it may be sent later. `typing` should be a Boolean indicator.

* `schedSendDisconnect()` - queues the action so that it can be sent later.

#### Events ####

Instances of `Connection` emit many types of events.

* `established`, `disconnected` - when the connection has been established, and when the other user terminates the connection

* `died`, `captcha`, and `ban` each funish their callback with a string reason or data

* `message`, `notice`, and `verbose notice` each provide their callback with string data, usually the callback will log this message somehow

* `question`, `topics`

In addition, every event that the server returns from a request to `/events` is emitted.

### <a name="behavior"></a> Behavior ###

#### Constructor ####

    new Behavior(client)

Takes a client context with which to call commands, the client is bound to the dynamic `this` in command bodies.

#### Properties ####

* `list` - an array of all command names

#### Methods ####

* `addCommand(commandName, helpString, minimumArgLen, bodyCallback, aliasNamesArray)` - if command or alias already exists, it is overriden

* `call(commandName, argumentsArray)` - `commandName` can be the name or alias of command

### <a name="clientbehavior"></a> ClientBehavior ###

This is a subclass of Behavior.

#### Constructor ####

    new ClientBehavior(client)

#### Methods ####

* `addHiddenCommand(name, helpString, argLen, body, aliases)` - hidden commands are only listed if `/-help` is given an argument

* `addAll()` - called to set up all the commands, can override and call `super.addAll()`. Try running the client and typing `/-help full` for a full list of commands that are added by default

### <a name="client"></a> Client ###

#### Constructor ####

    new Client()

It's probably best to only ever construct one Client, especially if both setup a different UI. This can be run as the main module.

#### Selected Properties ####

* `afterStartup` - indicates whether startup (usually command-line) arguments have been interpreted and respective commands run and the UI has been created.

* `user` - current `Connection` instance or `null`

* `behavior` - `ClientBehavior` instance which is used for client commands

Additionally, there is a number of configuration properties.

#### Selected Methods ####

* `makeBehavior` - This should return an instance of (any subclass of) `Behavior`.

* `setupUI` - This should start an interface that handles input, and exiting, and should return a logging function

* `run` - performs startup

* `command(data)` - parses a data string into a command and its arguments, and uses `.behavior` to run the command

* `initiateUser()` - creates a new connection which is assigned to `this.user` and starts it, returns that connection

* `registerListeners(user)` - registers listeners for a user connection, called by `initateUser()`

* `removeUser()` - `dispose()`'s of the connection, and resets some client properties

* `inspectChallenge(salt, challenge)`, `scheduleLurk()`, `lurk()`

* `log(msg)` - log the message

* `logVerbose(msg)` - log the message if the client is in verbose mode (mostly for debugging)

* `logInner(msg)` - the shared functionality of the previous two methods

* `hear(msg)` - formats the message from the other participant, then logs it with `log()`

* `say(msg)` - formats the message from the user, then logs it with `log()` and schedules it's send (`this.user.schedSend(msg)`)

### <a name="bot"></a> Bot ###

This is a subclass of `Client`. It tries to automatically pass the pre-room. This can be run as the main module.

#### Constructor ####

    new Bot()

#### Methods ####

* `begin()` - called after the room has been entered (after getting past the pre-room if it exits).
