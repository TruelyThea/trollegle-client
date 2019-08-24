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

