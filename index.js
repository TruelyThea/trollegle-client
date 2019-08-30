// Expose

module.exports = {
    Bot: require("./lib/Bot"),
    Client: require("./lib/Client"),
    Connection: require("./lib/Connection"),
    ClientBehavior: require("./lib/ClientBehavior"),
    Behavior: require("./lib/Behavior"),
    interfaces: {
        readlineUI: require("./lib/interfaces/readlineUI"),
        textualUI: require("./lib/interfaces/textualUI")
    }
};

if (require.main === module) {
    var Client = require("./lib/Client");
    new Client().run();
}
