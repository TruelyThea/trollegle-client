let add = (function() {
    class GUIClient extends Client {
        constructor(tab) {
            super();
            this.tab = tab;
            this.chatLog = new ChatLog(document.querySelector(tab + " .log"));
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
                let log = this.chatLog.element;
                // https://stackoverflow.com/questions/876115/how-can-i-determine-if-a-div-is-scrolled-to-the-bottom
                let wasNotScrolled = log.scrollHeight - log.scrollTop - log.clientHeight < 1;
                this.chatLog.log(text, this.color);
                if (wasNotScrolled) log.scrollTop = log.scrollHeight;
            };
        }
    }

    let count = 1;

    return function() {
        let i = count++;

        let a = document.createElement("a");
        a.textContent = "💬" + i;
        a.onclick = showTab.bind(null, "chat-" + i);
        document.querySelector(".navbar").prepend(a);

        let tab = document.querySelector("#template .chat").cloneNode(true);
        document.querySelector(".main").appendChild(tab);
        tab.setAttribute("id", "chat-" + i);

        let [messageForm, multircForm] = tab.querySelectorAll("form");
        let submitMsg = handleFormSubmit(messageForm);
        handleFormSubmit(multircForm);

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
                if (!res.canceled)
                    path.textContent = filePath = res.filePaths[0];
            });
        });

        multircForm.addEventListener("submit", () => {
            messageForm.elements.message.value = `/-loadrc ${filePath}${multircForm.elements.options.value}`;
            submitMsg();
        });

        tab.querySelector(".leave").addEventListener("click", () => {
            messageForm.elements.message.value = `/-leave`;
            submitMsg();
        });

        tab.querySelector(".connect").addEventListener("click", () => {
            messageForm.elements.message.value = `/-c ${tab.querySelector(".topics").value}`;
            submitMsg();
        });
    };
})();
