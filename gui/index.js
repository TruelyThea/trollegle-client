const { app, BrowserWindow } = require('electron');

function createWindow () {
  new BrowserWindow({
    title: "Trollegle",
    icon: "./gui/trollegle.ico",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true
    }
  }).loadURL(`file://${__dirname}/index.html`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
