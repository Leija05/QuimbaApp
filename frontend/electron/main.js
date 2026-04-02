const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;

let backendProcess = null;
let backendStartupIssue = '';

function resolveBackendExecutablePath() {
  if (isDev) {
    return path.join(__dirname, '../resources/quimbar-server.exe');
  }
  return path.join(process.resourcesPath, 'resources', 'quimbar-server.exe');
}

function startBackend() {
  const backendExecutablePath = resolveBackendExecutablePath();
  if (!fs.existsSync(backendExecutablePath)) {
    backendStartupIssue = `No existe quimbar-server.exe en: ${backendExecutablePath}`;
    console.error(backendStartupIssue);
    return;
  }

  backendProcess = spawn(backendExecutablePath, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    cwd: path.dirname(backendExecutablePath),
    env: process.env,
  });
  backendProcess.once('error', (error) => {
    backendStartupIssue = `Error al iniciar quimbar-server.exe: ${error?.message || String(error)}`;
    console.error('No se pudo iniciar quimbar-server.exe:', error);
  });
  backendProcess.once('exit', (code, signal) => {
    if (code !== 0) {
      backendStartupIssue = `quimbar-server.exe terminó al iniciar (code=${code}, signal=${signal || 'none'})`;
    }
  });
  backendProcess.stdout?.on('data', () => {});
  backendProcess.stderr?.on('data', () => {});
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForBackendReady() {
  const maxAttempts = 60;
  const urlsToProbe = [
    'http://127.0.0.1:8000/api/totals',
    'http://127.0.0.1:8000/totals',
    'http://127.0.0.1:8000/api/',
    'http://127.0.0.1:8000/',
  ];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    for (const url of urlsToProbe) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return true;
        }
      } catch (_) {
        // Keep polling until backend is ready
      }
    }

    if (backendProcess && backendProcess.exitCode !== null) {
      return false;
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
  const ready = await waitForBackendReady();
  createWindow();
  if (!ready) {
    const extra = backendStartupIssue ? `\n\nDetalle técnico:\n${backendStartupIssue}` : '';
    dialog.showMessageBox({
      type: 'warning',
      title: 'Servidor local no disponible',
      message: 'No se pudo iniciar quimbar-server.exe en 127.0.0.1:8000.',
      detail: `La aplicación se abrirá, pero no podrá operar hasta que el servidor local esté activo.\n\nPasos:\n1) Ejecuta la app como administrador.\n2) Verifica que tu antivirus no bloquee quimbar-server.exe.\n3) Reinstala la app para restaurar el ejecutable.${extra}`,
      buttons: ['Aceptar'],
    });
  }

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
