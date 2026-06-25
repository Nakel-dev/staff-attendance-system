const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = process.env.ATTENDPRO_PORT || "3847";
let mainWindow;
let serverProcess;

function getStandaloneDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone");
  }
  return path.join(__dirname, "..", ".next", "standalone");
}

function loadEnvFile() {
  const envPath = app.isPackaged
    ? path.join(app.getPath("userData"), ".env.local")
    : path.join(__dirname, "..", ".env.local");

  if (!fs.existsSync(envPath)) return {};

  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function startServer() {
  return new Promise((resolve, reject) => {
    const standaloneDir = getStandaloneDir();
    const serverPath = path.join(standaloneDir, "server.js");

    if (!fs.existsSync(serverPath)) {
      reject(new Error(`Server not found at ${serverPath}. Run npm run desktop:prepare first.`));
      return;
    }

    const fileEnv = loadEnvFile();
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        ...fileEnv,
        PORT,
        NODE_ENV: "production",
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: "inherit",
    });

    serverProcess.on("error", reject);
    setTimeout(resolve, 2500);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "AttendPro",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error(err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
