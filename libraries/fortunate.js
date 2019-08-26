// my bugfix for blessed insertLine, which is reparsing the tags for other lines, 
//    the bug makes escaped lines unescapped when a calling insertLine()
//    This must be a bug: it's unexpected behavior, 
//        a method named insertLine should only insert a line into the content (and maybe also modify/sanitize/format *that* line),
//     Also also the bug makes the method less useful, 
//        because if you wanted escaped tags (in an already existing line), you cannot use insertLine with the bug

const blessed = require("blessed");

var screen;

try {

    screen = blessed.screen();

    var box = blessed.box({
        tags: true,
        parent: screen
    });

    box.insertLine(0, "{open}bold{close}.{open}/bold{close}");
    box.insertLine(1, "");

    var hasInsertLineBug = box.getLine(0) != "{bold}.{/bold}";

    if (hasInsertLineBug) {
        let insertLine = blessed.Element.prototype.insertLine;

        blessed.Element.prototype.insertLine = function(i, line) {
            var parseTags = this.parseTags;
            // Element.prototype._parseTags could not be in future versions if the internal structure was changed
            // that would throw an error
            line = blessed.Element.prototype._parseTags.call({parseTags: parseTags, screen: this.screen}, line);
            this.parseTags = false;
            insertLine.call(this, i, line);
            this.parseTags = parseTags;
        };
    }

    box.detach();

} finally { 
    if (screen) screen.destroy();
}

