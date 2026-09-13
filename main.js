const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const isXlsx = filePath => path.extname(filePath).toLowerCase() === '.xlsx';

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    title: 'Slate',
    backgroundColor: '#f2f4f1',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('slate:open-workbook', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Excel帳票を開く',
    properties: ['openFile'],
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  if (!isXlsx(filePath)) throw new Error('対応形式は .xlsx のみです。');
  return { name: path.basename(filePath), bytes: new Uint8Array(await fs.readFile(filePath)) };
});

ipcMain.handle('slate:save-workbook', async (_, payload) => {
  const suggested = path.basename(payload.suggestedName || 'Slate-output.xlsx').replace(/[^\w.\-()ぁ-んァ-ヶ一-龠々ー]/g, '_');
  const result = await dialog.showSaveDialog({
    title: 'SlateのExcelを書き出す',
    defaultPath: suggested.endsWith('.xlsx') ? suggested : `${suggested}.xlsx`,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, Buffer.from(payload.bytes));
  return { canceled: false, filePath: result.filePath };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
