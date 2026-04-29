/* main.js */
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. 定义数据存储路径 (持久化存档目录)
// Windows: %APPDATA%/伊萨卡手记-测试版/save_data/
// macOS: ~/Library/Application Support/伊萨卡手记-测试版/save_data/
const SAVE_FOLDER_NAME = app.isPackaged ? 'save_data' : 'save_data_dev_test5';
const DATA_DIR = path.join(app.getPath('userData'), SAVE_FOLDER_NAME);
const ALLOWED_DATA_FILES = new Set([
    'user_data.json',
    'journal_data.json',
    'library_data.json'
]);

// 确保存档目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function resolveDataPath(filename) {
    if (!ALLOWED_DATA_FILES.has(filename)) {
        throw new Error(`不支持的数据文件: ${filename}`);
    }
    return path.join(DATA_DIR, filename);
}

function resolveTemplatePath(filename) {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'default_data', filename);
    }
    return path.join(__dirname, 'src', 'data', filename);
}

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "伊萨卡手记",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false 
        }
    });

    win.loadFile('src/index.html');
    // win.webContents.openDevTools(); // 调试用
}

app.whenReady().then(() => {
    // --- IPC 核心逻辑 ---

    // A. 读取文件 (带模板拷贝机制 - 已修复)
    ipcMain.handle('read-file', async (event, filename) => {
        try {
            // 目标路径：用户的存档目录
            const filePath = resolveDataPath(filename);

            // 1. 优先检查用户存档目录是否有数据 (老玩家/已保存过)
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf-8');
            }

            // 2. 如果存档不存在 (新玩家)，从初始模板拷贝
            const templatePath = resolveTemplatePath(filename);
            
            // 3. 尝试读取模板并初始化
            if (fs.existsSync(templatePath)) {
                console.log(`[Main] 新用户初始化，正在从模板拷贝: ${filename}`);
                console.log(`[Main] 模板源路径: ${templatePath}`);
                
                const initialData = fs.readFileSync(templatePath, 'utf-8');
                
                // 自动同步写入到用户的存档目录
                fs.writeFileSync(filePath, initialData, 'utf-8');
                return initialData;
            } else {
                console.error(`[Main] 错误：未找到初始模板文件 -> ${templatePath}`);
                return null; 
            }
        } catch (err) {
            console.error("读取操作失败:", err);
            return null;
        }
    });

    // B. 写入文件
    ipcMain.handle('write-file', async (event, filename, content) => {
        try {
            const filePath = resolveDataPath(filename);
            fs.writeFileSync(filePath, content, 'utf-8');
            return true;
        } catch (err) {
            console.error("写入操作失败:", err);
            return false;
        }
    });

    // ✨ 新增 C. 导出文件 (另存为)
    ipcMain.handle('export-file', async (event, defaultName, content) => {
        try {
            // 打开系统保存对话框
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: '导出伊萨卡手记',
                defaultPath: defaultName, // 默认文件名
                filters: [
                    { name: 'JSON 数据', extensions: ['json'] },
                    { name: 'Markdown 文档', extensions: ['md'] },
                    { name: '文本文件', extensions: ['txt'] },
                    { name: '所有文件', extensions: ['*'] }
                ]
            });

            if (canceled || !filePath) {
                return { success: false, message: '用户取消' };
            }

            // 写入文件到用户选择的路径
            fs.writeFileSync(filePath, content, 'utf-8');
            return { success: true, path: filePath };

        } catch (err) {
            console.error("导出失败:", err);
            return { success: false, message: err.message };
        }
    });

    // D. 导入 JSON 文件
    ipcMain.handle('import-json', async () => {
        // 1. 打开原生文件选择框
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: '选择 JSON 备份文件',
            properties: ['openFile'], // 只允许选文件
            filters: [
                { name: 'JSON Data', extensions: ['json'] } // 只显示 json 文件
            ]
        });

        if (canceled) {
            return { success: false, msg: '用户取消' };
        } else {
            try {
                // 2. 读取选中文件的内容
                const content = fs.readFileSync(filePaths[0], 'utf8');
                return { success: true, data: content };
            } catch (err) {
                return { success: false, msg: '读取文件失败: ' + err.message };
            }
        }
    });

    // E. 导出完整存档快照
    ipcMain.handle('export-archive', async (event, archiveJson) => {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const defaultName = `ithaca_journal_archive_${today}.json`;
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: '导出完整存档',
                defaultPath: defaultName,
                filters: [
                    { name: 'Ithaca Journal Archive', extensions: ['json'] }
                ]
            });

            if (canceled || !filePath) {
                return { success: false, message: '用户取消' };
            }

            fs.writeFileSync(filePath, archiveJson, 'utf-8');
            return { success: true, path: filePath };
        } catch (err) {
            console.error('完整存档导出失败:', err);
            return { success: false, message: err.message };
        }
    });

    // F. 彻底清空本地数据
    ipcMain.handle('delete-all-data', async () => {
        try {
            if (fs.existsSync(DATA_DIR)) {
                fs.rmSync(DATA_DIR, { recursive: true, force: true });
            }
            ensureDataDir();

            await session.defaultSession.clearStorageData({
                storages: [
                    'localstorage',
                    'indexdb',
                    'cookies',
                    'filesystem',
                    'cachestorage',
                    'shadercache',
                    'serviceworkers'
                ]
            });

            return {
                success: true,
                userDataPath: app.getPath('userData'),
                saveDataPath: DATA_DIR
            };
        } catch (err) {
            console.error('彻底清空本地数据失败:', err);
            return { success: false, message: err.message };
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
