const _ = require("underscore");
const {Client, ClientBehavior} = require("../index");
const {Converter} = require('showdown');
const fs = require("fs");
const axios = require("axios").create({timeout: 30e3});
const {dialog} = require('electron').remote;
const path = require('path');

function showTab(id) {
    _.forEach(document.querySelectorAll(".main > div"), tab => {
        tab.style.display = tab.id == id ? "inherit" : "none";
    });
}

let handleFormSubmit = function(form) {
    // prevent page reload
    form.addEventListener("submit", event => {
        event.preventDefault();
    });

    let formSubmit = _.find(form.querySelectorAll("input"), input => input.type == "submit");
    
    let submit = function() { // without page refrsh; there might be a better way
        formSubmit.click();
    };

    if (formSubmit) {
        // enter to submit the form, but not if shift key is held down, which signifies that maybe a newline should be inserted instead
        form.addEventListener("keypress", event => {
            if (event.which == 13 && !event.shiftKey) {
                submit();
                event.preventDefault();
            }
        });
    }

    return submit;
};

let resize = function() {
    let main = document.querySelector(".main");
    let navbar = document.querySelector(".navbar");
    main.style.marginTop = navbar.offsetHeight + 5 + "px";
    main.style.height = `calc(100vh - ${navbar.offsetHeight}px - 10px)`;

    let width = document.body.clientWidth;
    _.each(document.querySelectorAll(".row .left"), elt => {
        elt.style.display = "block";
        if (width <= 900) {
            elt.style.marginLeft = "auto";
            elt.style.marginRight = "auto";
            elt.style.float = "none";
            elt.style.width = Math.max(600, width) + "px";
        } else if (width <= 1205) {
            elt.style.float = "left";
            elt.style.width = "50%";
            elt.style.marginLeft = width/2 - elt.clientWidth + 5 + "px";
            elt.style.marginRight = "inherit";
        } else {
            elt.style.float = "left";
            elt.style.width = "600px";
            elt.style.marginLeft = width / 2 - 600 - 10 + "px";
            elt.style.marginRight = "inherit";
        }
    });

    _.each(document.querySelectorAll(".row .right"), elt => {
        elt.style.display = "block";
        if (width <= 900) {
            elt.style.marginLeft = "auto";
            elt.style.marginRight = "auto";
            elt.style.float = "none";
            elt.style.width = Math.max(600, width) + "px";
        } else if (width <= 1205) {
            elt.style.float = "right";
            elt.style.width = "calc(50% - 20px)";
            elt.style.marginRight = width/2 - elt.clientWidth - 25 + "px";
            elt.style.marginLeft = "inherit";
        } else {
            elt.style.float = "right";
            elt.style.width = 600 - 20 + "px";
            elt.style.marginRight = width / 2 - 600 + 10 + "px";
            elt.style.marginLeft = "inherit";
        }
    });
};

resize();
addEventListener("resize", _.throttle(resize, 250, {leading: false}));

const ChatLog = (function() {
    let colors = ["#ff69ff", "lightskyblue", "#FFFF66", "lightgreen", "white", "lightgreen", "cyan", "cyan", "grey", "white"];

    function msg(type) {
        return "[\\[\\<\\{⟨]" + (type != null ? "\\(" + type + "\\) " : "") + ".*[\\]\\>\\}⟩] .*";
    }

    let regexs = ["\\* .*", "\\| .*", "\\| .*? has (entered|left|joined|returned).*", "\\| You\\'ve been here for .+",
        msg(), msg("\D*"), msg("goss"), msg("private"), msg("(mute|uncd|flood|cmd)")].map(function(pattern) {
            return new RegExp("^\\d\\d\\:\\d\\d\\s+" + pattern + "$");
        });
    regexs.push(/^\\> .*$/);
    
    let htmlEscape = _.template("<%- text %>");
    
    let lineContent = function(text, doColor) {
        let lines = htmlEscape({text}).split(/\r?\n/);

        let color = doColor ? regexs.reduce(function(acc, regex, i) {
            return regex.test(text) ? colors[i] : acc;
        }, "white") : "white";

        let date = "";
        if (/^\d\d\:\d\d/.test(lines[0])) {
            date = lines[0].slice(0,5);
            lines[0] = lines[0].slice(5);
        }

        return lines.map(function(line, i) {
            return `<p>
                        <span style="color: white;${i == 0 ? '' : ' visibility: hidden;'}">
                            <code>${date}</code>
                        </span>
                        <span style="color: ${color};">
                            <code>${line}</code>
                        </span>
                    </p>`;
        }).join("");
    };

    return class {
        constructor(element) {
            if (!(element instanceof Element))
                throw new TypeError("The argument given to ChatLog must be an Element that serve as the container.");
            this.element = element;
        }

        log(text, color) {
            let div = document.createElement("div");
            div.className = "message";
            div.innerHTML = lineContent(text, color);
            this.element.appendChild(div);
        }

        clear() {
            this.element.innerHTML = "";
        }
    };
})();
