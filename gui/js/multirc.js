(function() {
    let textarea = document.querySelector("#multirc textarea");
    let [save, colorsOn, colorsOff, lurkRate, lurkMsg, output, outDir, chosenOutDir, room] =
        ["#saveMultirc", "#showColors", "#hideColors", "#lurkRate", "#lurkMessage", 
         "#output", "#outDir", "#chosenOutDir", "#room"].map(document.querySelector.bind(document));
    
    [lurkRate, lurkMsg, output, room].forEach(handleFormSubmit);
    
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
        textarea.value += "\n/-color on\n";
    });

    colorsOff.addEventListener("click", () => {
        textarea.value += "\n/-color off\n";
    });

    lurkRate.addEventListener("submit", () => {
        textarea.value += `\n/-lurkrate ${lurkRate.elements.value.value}\n`;
    });

    lurkMsg.addEventListener("submit", () => {
        textarea.value += `\n/-lurkmsg ${lurkMsg.elements.value.value}\n`;
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

    output.addEventListener("submit", () => {
        textarea.value += `\n/-out ${path.join(filePath, output.elements.name.value)}\n`;
    });
    
    room.addEventListener("submit", () => {
        textarea.value += `\n/-room ${room.elements.name.value} ${room.elements.challenge.value} ${room.elements.password.value}\n`;
    });
})();
