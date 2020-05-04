(function() {
    let chatLog = new ChatLog(document.querySelector("#viewer div"));

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
                chatLog.clear();
                data.split(/\r?\n/).forEach(function(line) {
                    chatLog.log(line, color);
                });
            });
        });
    });
})();
