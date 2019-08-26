// This module is based on https://gist.github.com/hawkins/5c05d077a5d15d95404c3bb56b2a81d7

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
        vi: true,
        mouse: true,
        tags: true,
        alwaysScroll: false,
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

    // So far, I have no Idea why body.scroll isn't referring to the scroll method in it's prototype
    // I think it's another bug in blessed...
    // try:
    //     body.log(body.__proto__ == blessed.log.prototype);
    //     body.log(body.scroll == blessed.log.prototype.scroll);
    //     body.log(body.scroll == blessed.scrollablebox.prototype.scroll);
    //     body.log(body instanceof blessed.log);
    body.scroll = blessed.log.prototype.scroll; 
    
    
    screen.key(['C-c'], onQuit);
    inputBar.key(['C-c'], onQuit);

    body.key(["enter", "escape"], inputBar.focus.bind(inputBar));
    inputBar.on("cancel", body.focus.bind(body));
    inputBar.on("submit", (text) => {
        if (text == "") {
            body.focus();
        } else {
            onInput(text);
            inputBar.clearValue();
            screen.render();
            inputBar.focus();
        }
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

