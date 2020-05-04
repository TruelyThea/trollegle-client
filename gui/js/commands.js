let filterHelp = (function() {
    const {matchesEachKeyword} = require("../lib/Util");
    let behavior = new ClientBehavior(null);
    let commands = behavior.commands;

    let rowTemplate = _.template("<td> <code><%= name %></code> </td> <td> <% print(aliases ? aliases.map(alias => '<code>'+alias+'</code>').join(', ') : '' ) %> </td> <td> <code><%- helpString %></code></td>");

    _.forEach(commands, function(cmd) {
        let tr = document.createElement("tr");
        tr.id = "command-" + cmd.name;
        tr.innerHTML = rowTemplate(cmd);
        document.querySelector("#commands table").appendChild(tr);
    });
    
    return function () {
        let keywords = document.querySelector("#filter").value.split(" ");
        _.forEach(commands, function(cmd, key) {
            let entry = document.querySelector("#command-" + key);
            if (keywords.length == 0 || keywords[0] == "full")
                entry.style.display = "";
            else
                entry.style.display = matchesEachKeyword(cmd, keywords) ? "" : "none";
        });
    };
})();

document.querySelector("#filter").addEventListener("change", filterHelp);
