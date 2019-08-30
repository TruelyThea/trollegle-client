// thanks to an anonomous user for the original readline UI, a while ago

// This interface has a few display problems. For instance, when the input spans multiple lines and
//    a new message is logged, some of the input will cover the new message

const readline = require("readline");

module.exports = function(onInput, onQuit) {

    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.on('line', onInput);
    
    let quit = () => {
        onQuit();
        rl.close();                
    };
    
    rl.on('SIGINT', quit);
    // rl.on('close', quit); // seems to not send "disconnect" on either close or SIGINT event, if this listener exists

    return function(line) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        console.log(line);
        rl.prompt(true);
    };
};

