const _ = require("underscore");
const {Client, ClientBehavior} = require("../index");
const {matchesEachKeyword} = require("../lib/Util");
const {Converter} = require('showdown');
const fs = require("fs");
const axios = require("axios").create({timeout: 30e3});
const { dialog } = require('electron').remote;
const path = require('path');

function lineContent(line, doColor) {
    function msg(type) {
        return "[\\[\\<]" + (type != null ? "\\(" + type + "\\) " : "") + ".*[\\]\\>] .*";
    }

    let colors = ["magenta", "lightskyblue", "#FFFF66", "lightgreen", "white", "lightgreen", "cyan", "cyan", "grey", "white"];
    let regexs = ["\\* .*", "\\| .*", "\\| .*? has (entered|left|joined|returned).*", "\\| You\\'ve been here for .+",
        msg(), msg("\D*"), msg("goss"), msg("private"), msg("(mute|uncd|flood|cmd)")].map(function(pattern) {
            return new RegExp("^\\d\\d\\:\\d\\d\\s+" + pattern + "$");
        });
    regexs.push(/^\\> .*$/);

    line = line.replace(/\r?\n/g, "<br>");
    if (doColor) {
        let color = regexs.reduce(function(acc, regex, i) {
            return regex.test(line) ? colors[i] : acc;
        }, "white");

        let date = "";
        if (/^\d\d\:\d\d/.test(line)) {
            date = line.slice(0,5);
            line = line.slice(5);
        }
        
        return `<span style="color: white;"><code>${date}</code></span> <span style="color:${color};"><code>${line}</code></span>`;
    } else {
        return `<span style="color: white;"><code>${line}</code></span>`;
    }
}

class GUIClient extends Client {
    constructor(tab) {
        super();
        this.tab = tab;
    }

    setupUI() {
        window.onbeforeunload = () => {
            if (this.user && this.user.isConnected)
                this.command("disconnect");
        };

        document.querySelector(this.tab + " form").addEventListener("submit", () => {
            let input = document.querySelector(this.tab + " textarea").value;
            if (input.trim() == "") return;
            if (input.startsWith("/-"))
                this.command(input.slice(2));
            else
                this.say(input);
            document.querySelector(this.tab + " textarea").value = "";
        });

        this.logInner = function(text) {
            let log = document.querySelector(this.tab + " .log");
            // https://stackoverflow.com/questions/876115/how-can-i-determine-if-a-div-is-scrolled-to-the-bottom
            let wasNotScrolled = log.scrollHeight - log.scrollTop - log.clientHeight < 1;

            let p = document.createElement("p");
            p.innerHTML = lineContent(text, this.color);
            log.appendChild(p);

            if (wasNotScrolled) log.scrollTop = log.scrollHeight;
        };
    }
}

function showTab(id) {
    _.forEach(document.querySelectorAll(".main > div"), tab => {
        tab.style.display = tab.id == id ? "inherit" : "none";
    });
}

let resize = function() {
    let main = document.querySelector(".main");
    let navbar = document.querySelector(".navbar");
    main.style.marginTop = navbar.offsetHeight + 5 + "px";
    main.style.height = `calc(100vh - ${navbar.offsetHeight}px - 10px)`;
};

resize();
addEventListener("resize", _.throttle(resize, 250, {leading: false}));

// comments tab

let behavior = new ClientBehavior(null);
let commands = behavior.commands;

let rowTemplate = _.template("<td> <code><%= name %></code> </td> <td> <% print(aliases ? aliases.map(alias => '<code>'+alias+'</code>').join(', ') : '' ) %> </td> <td> <code><%- helpString %></code></td>");

_.forEach(commands, function(cmd) {
    let tr = document.createElement("tr");
    tr.id = "command-" + cmd.name;
    tr.innerHTML = rowTemplate(cmd);
    document.querySelector("#commands table").appendChild(tr);
});

document.querySelector("#filter").addEventListener("change", filterHelp);

function filterHelp() {
    let keywords = document.querySelector("#filter").value.split(" ");
    _.forEach(commands, function(cmd, key) {
        let entry = document.querySelector("#command-" + key);
        if (keywords.length == 0 || keywords[0] == "full")
            entry.style.display = "";
        else
            entry.style.display = matchesEachKeyword(cmd, keywords) ? "" : "none";
    });
}

// api tab

let converter = new Converter();

fs.readFile('./DOCUMENTATION.md', 'utf8', (err, data) => {
    if (err) throw err;    
    document.querySelector("#docs-api").innerHTML = converter.makeHtml(data);
});

// pulses tab

let pulsesTemplate = _.template("<tr><td><%= room %></td><td><% print(words.join(' ')) %></td><td><% print(msToTime(date)) %></td>");

let msToTime = function(ms) {
    let months = ["Janurary", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    let date = new Date(ms);
    return `${months[date.getUTCMonth()]} ${date.getUTCDay() + 1}, ${date.getUTCFullYear()} ${("00" + date.getUTCHours()).slice(-2)}:${("00" + date.getUTCMinutes()).slice(-2)}:${("00" + date.getUTCSeconds()).slice(-2)} UTC`;
};

function refresh() {
    document.querySelector("#loading").style.display = "block";
    Promise.all(_.map({
        "BellaWhiskey": "https://bellawhiskey.ca/trollegle"
    }, function(url, mothership) {
        return axios.get(url + "/raw").then(res => {
            if (res.data.pulses.length == 0) {
                return "<p> No rooms are listed on this mothership.</p> <p>Last Updated: " + msToTime(res.data.lastUpdate) + "</p>";
            } else {
                return "<table>" + res.data.pulses.map(pulsesTemplate).join(" ") + "</table> <p>Last Updated: " + msToTime(res.data.lastUpdate) + "</p>";
            }
        }).catch(err => {
            return `<p>${mothership} couldn't be reached: ${err.toString()}.</p>`;
        }).then(function(content) {
            document.querySelector(`#${mothership} .result`).innerHTML = content;
        });
    })).then(() => {
        document.querySelector("#loading").style.display = "none";
    });
}

refresh();

// .multirc

(function() {
    let textarea = document.querySelector("#multirc textarea");
    let [save, colorsOn, colorsOff, lurkRate, addRate, lurkMsg, addMsg, outDir, chosenOutDir, outName, addOut, roomName, roomChallenge, roomPassword, addRoom] =
    ["#saveMultirc", "#showColors", "#hideColors", "#lurkRate", "#addLurkRate", "#lurkMessage", "#addLurkMessage", "#outDir", "#chosenOutDir", "#outName", "#addOut", "#roomName", "#roomChallenge", "#roomPassword", "#addRoom"].map(document.querySelector.bind(document));
    
    save.addEventListener("click", () => {
        dialog.showSaveDialog(null,  {
            filters: [
                { name: 'multirc', extensions: ['multirc'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        }).then(res => {
            if (!res.canceled)
                fs.writeFile(res.filePath, textarea.value, "utf8", err => {
                    if (err) alert(err);
                });
        }).catch(err => {
            if (err) alert(err);
        });
    });

    colorsOn.addEventListener("click", () => {
        textarea.value += "\n/-colors on\n";
    });

    colorsOff.addEventListener("click", () => {
        textarea.value += "\n/-colors off\n";
    });

    addRate.addEventListener("click", () => {
        textarea.value += `\n/-lurkrate ${lurkRate.value}\n`;
    });

    addMsg.addEventListener("click", () => {
        textarea.value += `\n/-lurkmsg ${lurkMsg.value}\n`;
    });

    let filePath = "";
    outDir.addEventListener("click", () => {
        dialog.showOpenDialog(null, {
            properties: [
                "openDirectory"
            ]
        }).then(function(res) {
            if (!res.canceled) chosenOutDir.textContent = filePath = res.filePaths[0];
        });
    });

    addOut.addEventListener("click", () => {
        textarea.value += `\n/-out ${path.join(filePath, outName.value)}\n`;
    });

    addRoom.addEventListener("click", () => {
        textarea.value += `\n/-room ${roomName.value} ${roomChallenge.value} ${roomPassword.value}\n`;
    });
})();

// viewer

document.querySelector("#loadLog").addEventListener("click", function() {
    let color = document.querySelector("#logColor").checked;

    dialog.showOpenDialog(null, {
        filters: [
            { name: 'log', extensions: ['log', 'txt'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: [
            "openFile"
        ]
    }).then(function(res) {
        if (!res.canceled) fs.readFile(res.filePaths[0], "utf8", function(err, data) {
            document.querySelector("#viewer div").innerHTML = data.split(/\r?\n/).map(line => `<p>${lineContent(line, color)}</p>`).join(" ");
        });
    });
});

// client

let count = 1;

let chatHTML = `
<div style='width: 100%; height: 70%; resize: none; overflow: scroll; background: black;' class="log"></div>
<form>
<textarea style='width: 100%; height: 10%; resize: none; margin-top:5px'></textarea>
<input type="submit" class="formSubmit"></input>Enter submits sends the message, and shift + enter gives a new line.
</form><button class="leave">leave</button> Connect: Topics: <input class="topics" type="text"><button class="connect">Connect</button>
<br>
<p>Load a <code>.multirc</code> file: <button class="multirc">load file</button></p>
<p>Selected: <code><span class="path"></span></code></p>
<p>Options: <code><input class="multircOptions"></input></code>. The options are given as a query string of key value pairs, like what sometimes appears after a url. For example, if I had a variable <code>:room:</code> representing a room on trollegle, I wanted to fill that variable with <code>bellawhiskey</code>, and I had no more variables to fill, I could type <code>?room=bellawhiskey</code>.</p>
<p><button class="multircSubmit">Submit</button></p>
<br>
<p><em>Side note</em>: The text in <code>/-navigate</code> does not apply for the graphical user interface (at least yet).</p>
<br>
`;

function add() {
    let i = count++;

    let a = document.createElement("a");
    a.textContent = "💬" + i;
    a.onclick = showTab.bind(null, "chat-" + i);
    document.querySelector(".navbar").prepend(a);

    let tab = document.createElement("div");
    tab.style = "display: hidden: width: 100%; height: 100%";
    tab.id = "chat-" + i;
    tab.class = "chat";
    tab.innerHTML = chatHTML;
    document.querySelector(".main").appendChild(tab);

    let textarea = tab.querySelector("textarea");
    let form = tab.querySelector("form");
    let formSubmit = tab.querySelector(".formSubmit");

    form.addEventListener("submit", (event) => {
        event.preventDefault();
    });

    textarea.addEventListener("keypress", function(event) {
        if (event.which == 13 && !event.shiftKey) {
            formSubmit.click();
            event.preventDefault();
        }
    });

    resize();

    new GUIClient("#chat-" + i).run();

    let filePath = "";
    let multircInput = tab.querySelector(".multirc");
    let path = tab.querySelector(".path");
    multircInput.addEventListener("click", function() {
        dialog.showOpenDialog(null, {
            filters: [
                { name: 'multirc', extensions: ['multirc', 'rcmulti'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: [
                "openFile"
            ]
        }).then(function(res) {
            if (!res.canceled) path.textContent = filePath = res.filePaths[0];
        });
    });

    let multircOptions = tab.querySelector(".multircOptions");
    multircOptions.value = "?";
    let multircSubmit = tab.querySelector(".multircSubmit");
    multircSubmit.addEventListener("click", () => {
        textarea.value = `/-loadrc ${filePath}${multircOptions.value}`;
        formSubmit.click();
    });

    tab.querySelector(".leave").addEventListener("click", () => {
        textarea.value = `/-leave`;
        formSubmit.click();
    });

    tab.querySelector(".connect").addEventListener("click", () => {
        textarea.value = `/-c ${tab.querySelector(".topics").value}`;
        formSubmit.click();
    });
}
