// This module is based on https://gist.github.com/hawkins/5c05d077a5d15d95404c3bb56b2a81d7

// a number of features I still want to add:
//    allow scrolling in the log (will probably invole work with focusing)
//        stil unsure about how to do this :/
//    DONE: color the text according to the message type: pm, system announcement, regular message, commands, ...

// I think that this is an improvement over the old rl interface
// It would automatically scroll anyway when new messages were logged,
//     so it's not exactly that we're losing a feature by not having scrolling yet
// This in fact fixes display problems, like when the input spanned multiple lines,
//    a new message was logged, but it wasn't entirally visible because some of input covered it
//    and also fixes some issues when there was scrolling in the rl interface

// for now, console.log() and console.error() calls are commented out in UserConnection.js in case they case display issues


const blessed = require("blessed");
require("../libraries/fortunate"); // bugfix

module.exports = function(onInput, onQuit) {
    var screen = blessed.screen({
        smartCSR: true,
        fullUnicode: true // display emoji if possible (hopefully) 
    });

    var body = blessed.log({
        parent: screen,
        top: 0,
        left: 0,
        height: '100%-1',
        width: '100%',
        keys: true,
        mouse: true,
        tags: true,
        // alwaysScroll: true,
        scrollable: true,
        scrollbar: {
            ch: ' ',
            bg: 'red'
        }
    });
    
    blessed.text({
        parent: screen,
        bottom: 0,
        left: 0,
        content: '>'
    });
    
    var inputBar = blessed.textbox({
        parent: screen,
        bottom: 0,
        left: 1,
        height: 1,
        width: '100%-1',
        keys: true,
        mouse: true,
        inputOnFocus: true,
        style: {
            fg: 'white',
            bg: 'blue'
        }
    });

    // body.key('enter', inputBar.focus.bind(inputBar));
    
    screen.key(['C-c'], onQuit);
    inputBar.key(['C-c'], onQuit);
    
    inputBar.on('submit', (text) => {
        onInput(text);
        inputBar.clearValue();
        screen.render();
        inputBar.focus();
    });

    inputBar.focus();
    screen.render();

    function msg(type) {
        return "[\\[\\<]" + (type != null ? "\\(" + type + "\\) " : "") + ".*[\\]\\>] .*";
    }

    var colors = ["magenta", "yellow", "yellow", "green", "white", "green", "cyan", "cyan", "green", "white"];
    var regexs = ["\\* .*", "\\| .*", "\\| .*? has (entered|left|joined|returned).*", "\\| You\\'ve been here for .+",
        msg(), msg(".*"), msg("goss"), msg("private"), msg("(mute|uncd|flood|cmd)")].map(function(pattern) {
            return new RegExp("^\\d\\d\\:\\d\\d\\s+" + pattern + "$");
        });
    regexs.push(/^\\> .*$/);

    // return log function
    return function(text) {
        var color = regexs.reduce(function(acc, regex, i) {
            return regex.test(text) ? colors[i] : acc;
        }, "white");

        var date = "";

        if (/^\d\d\:\d\d/.test(text)) {
            date = text.slice(0,5);
            text = text.slice(5);
        }

        body.log(date + "{" + color + "-fg}" + blessed.escape(text) + "{/} ");
        screen.render();
    };
};

