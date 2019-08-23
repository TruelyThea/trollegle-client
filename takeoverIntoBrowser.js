// only have command-line client connections to your chat room, and need to solve captchas?

// step 1: adquire clientID (/-id)

// step 2: open a new window to the site, start a chat, then immediately end it

// step 3: press F12 to open developer tools, and paste the following in the developer console (until step 4):

var TAKEOVER = "central2:blah"; // replace

COMETBackend.prototype.sendPOST = function(a, b, c) {
    b = b || {}, c = c || 0, "object" == typeof b && (b.id = TAKEOVER);
    var d = this;
    killHeaders(new this.reqWindow.Request({
        url: subdomainManager.fixUrl(this.server, a),
        data: b,
        onFailure: function() {
            3 > c && d.sendPOST(a, b, c + 1)
        }
    })).send()
};

COMETBackend.prototype.getEvents = function(a) {
    if (void 0 === a && (a = 0), !this.stopped) {
        a > 2 && (this.fireEvent("connectionDied", "Lost contact with server, and couldn't reach it after 3 tries."), this.stopped = !0);
        var b = this,
            c = null,
            d = killHeaders(new b.reqWindow.Request.JSON({
                url: subdomainManager.fixUrl(b.server, "/events"),
                onSuccess: function(a) {
                    null !== c && (clearTimeout(c), c = null), b.stopped || (null === a ? (b.stopped = !0, b.fireEvent("connectionPermanentlyDied", "Server was unreachable for too long and your connection was lost.")) : (b.gotEvents(a), b.getEvents()))
                },
                onFailure: function() {
                    null !== c && (clearTimeout(c), c = null), setTimeout(function() {
                        b.getEvents(a + 1)
                    }, 2500)
                }
            }));
        d.post({
            id: TAKEOVER
        }), c = setTimeout(function() {
            c = null, d.cancel(), b.getEvents(a)
        }, 62e3)
    }
};

// step 4: start a new chat

// step 5: paste this into the devleoper console

document.querySelector(".chatmsg").disabled = false;
document.querySelector(".sendbtn").disabled = false;