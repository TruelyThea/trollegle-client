// my bugfix for blessed insertLine, which is reparsing the tags for other lines, 
//    the bug makes escaped lines unescapped when a calling insertLine()

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

    var hasInsertLineBug = box.getLine(0) != "{bold}.{/bold}}";

    if (hasInsertLineBug) {
        let insertLine = blessed.Element.prototype.insertLine;

        blessed.Element.prototype.insertLine = function(i, line) {
            var parseTags = this.parseTags;
            line = blessed.Element.prototype._parseTags.call({parseTags: parseTags, screen: this.screen}, line);
            this.parseTags = false;
            insertLine.call(this, i, line);
            this.parseTags = parseTags;
        };
    }

    box.detach();

} catch (ex) { // Element.prototype._parseTags could not be in future versions if the internal structure was changed
    // noop
}

if (screen)
    screen.destroy();

