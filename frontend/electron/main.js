const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;

let backendProcess = null;

function resolveBackendScriptPath() {
  if (isDev) {
    return path.join(__dirname, '../../backend/server.py');
  }
  return path.join(process.resourcesPath, 'backend/server.py');
}

function launchBackendWith(command, args = []) {
  const backendScriptPath = resolveBackendScriptPath();
  const processArgs = [...args, backendScriptPath];

  return spawn(command, processArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    },
  });
}

function startBackend() {
  const primaryCommand = process.env.QUIMBAR_PYTHON_BIN || (process.platform === 'win32' ? 'py' : 'python3');
  const primaryArgs = process.platform === 'win32' && primaryCommand === 'py' ? ['-3'] : [];
  backendProcess = launchBackendWith(primaryCommand, primaryArgs);

  backendProcess.once('error', () => {
    if (primaryCommand !== 'python') {
      backendProcess = launchBackendWith('python');
    }
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForBackendReady() {
  const maxAttempts = 30;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/totals');
      if (response.ok) {
        return true;
      }
    } catch (_) {
      // Keep polling until backend is ready
    }

    await sleep(1000);
  }

  return false;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
}

app.whenReady().then(async () => {
  startBackend();
  await waitForBackendReady();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
