const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

let backendProcess;
let frontendProcess;

const isDev = !app.isPackaged;

function getBasePath() {
  return isDev ? __dirname : path.join(process.resourcesPath, "app");
}

function runCommand(command, args, cwd) {
  return spawn(command, args, {
    cwd,
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
      PATH: process.env.PATH
    }
  });
}

function waitForUrl(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      http
        .get(url, () => resolve(true))
        .on("error", () => {
          if (Date.now() - start > timeout) {
            reject(new Error("Frontend did not start"));
          } else {
            setTimeout(check, 1000);
          }
        });
    };

    check();
  });
}

async function startServers() {
  const basePath = getBasePath();

  const backendPath = path.join(basePath, "backend");
  const frontendPath = path.join(basePath, "frontend");

  backendProcess = runCommand("npm.cmd", ["run", "dev"], backendPath);
  frontendProcess = runCommand("npm.cmd", ["run", "dev", "--", "--host", "127.0.0.1"], frontendPath);

  await waitForUrl("http://127.0.0.1:5173");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1450,
    height: 920,
    title: "الملكي POS",
    icon: path.join(getBasePath(), "frontend", "public", "logo.jpeg"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL("http://127.0.0.1:5173");
}

app.whenReady().then(async () => {
  try {
    await startServers();
    createWindow();
  } catch (error) {
    console.error(error);
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (frontendProcess) frontendProcess.kill();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
// const { app, BrowserWindow } = require("electron");
// const { spawn } = require("child_process");
// const path = require("path");

// let backendProcess;
// let frontendProcess;

// function startServers() {
//   backendProcess = spawn("npm", ["run", "dev"], {
//     cwd: path.join(__dirname, "backend"),
//     shell: true,
//     stdio: "inherit"
//   });

//   frontendProcess = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1"], {
//     cwd: path.join(__dirname, "frontend"),
//     shell: true,
//     stdio: "inherit"
//   });
// }

// function createWindow() {
//   const win = new BrowserWindow({
//     width: 1400,
//     height: 900,
//     title: "الملكي POS",
//     icon: path.join(__dirname, "frontend", "public", "logo.jpeg"),
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true
//     }
//   });

//   win.loadURL("http://127.0.0.1:5173");
// }

// app.whenReady().then(() => {
//   startServers();

//   setTimeout(() => {
//     createWindow();
//   }, 5000);
// });

// app.on("window-all-closed", () => {
//   if (backendProcess) backendProcess.kill();
//   if (frontendProcess) frontendProcess.kill();

//   if (process.platform !== "darwin") {
//     app.quit();
//   }
// });