// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron');
const fetch = require('node-fetch');
const zlib = require('zlib');
const util = require('util');
const gunzip = util.promisify(zlib.gunzip);
const https = require("https");
const path = require("path");
const WebSocketProxy = require('./WebSocketProxy');

const INTERCEPT_HTTPS_PROTOCOL = true;

let wsProxy = new WebSocketProxy();

ipcMain.on('websocket-packet', (event, dataBuffer) => {
    for (const { url, data, direction } of dataBuffer ) {
        if (direction == "SEND") {
            wsProxy.OnOutgoingMessage(url, Buffer.from(data));
        } else {
            wsProxy.OnIncommingMessage(url, Buffer.from(data));
        }
        /*let currentDataBuffer = Buffer.from(data);
        let currentDataHexString = currentDataBuffer.toString("hex").toUpperCase();

        let packetType = currentDataHexString.substring(0, 8).match(/.{1,2}/g);
        packetType = packetType.join(' ');

        console.log(direction + ": " + url);
        console.log(packetType + " DataLength: " + currentDataHexString.substring(8).length);*/
    }
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

async function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: false
        }
    });

    if (INTERCEPT_HTTPS_PROTOCOL) {
        mainWindow.webContents.session.protocol.interceptBufferProtocol('https', async (request, callback) => {
            //console.log(request.url);

            https.get(request.url, function (res) {
                let buffers = [];
                res.on('data', d => {
                    buffers.push(d);
                });
                res.on('end', () => {
                    let totalBuffer = Buffer.concat(buffers);
                    return callback({
                        data: totalBuffer
                    });
                });
            });
        });

    }

    mainWindow.webContents.session.allowNTLMCredentialsForDomains('*.flyff.com');
    await mainWindow.webContents.session.setProxy({
        pacScript: '',
        proxyBypassRules: '*-universe.flyff.com',
        proxyRules: "https://*",
    });

    // and load the index.html of the app.
    mainWindow.loadURL('https://universe.flyff.com/play');

    // Open the DevTools.
    //mainWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    });
}

app.on('login', (event, _webContents, _request, authInfo, callback) => {
    if (authInfo.isProxy) {
        event.preventDefault();
        return callback('foo', 'bar');
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
});