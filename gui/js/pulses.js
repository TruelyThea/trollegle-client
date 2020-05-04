let msToTime = function(ms) {
    let months = ["Janurary", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    let date = new Date(ms);
    return `${months[date.getUTCMonth()]} ${date.getUTCDate() + 1}, ${date.getUTCFullYear()} ${("00" + date.getUTCHours()).slice(-2)}:${("00" + date.getUTCMinutes()).slice(-2)}:${("00" + date.getUTCSeconds()).slice(-2)} UTC`;
};

let refresh = (function() {
    let pulsesTemplate = _.template("<tr><td><%= room %></td><td><% print(words.join(' ')) %></td><td><% print(msToTime(date)) %></td>");

    let refresh = function() {
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
    };

    refresh();
    
    return refresh;
})();
