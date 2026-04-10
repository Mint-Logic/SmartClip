const { app, BrowserWindow, clipboard, globalShortcut, Tray, Menu, ipcMain, dialog, Notification, screen, nativeImage, protocol, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const licenseMgr = require('./licenseManager');
const { machineIdSync } = require('node-machine-id');
const { pathToFileURL } = require('url');


// --- THE FLICKER FIX ---
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// app.disableHardwareAcceleration();

if (process.platform === 'win32') {
    // Uses standard Node/Electron permissions in Dev, and your custom ID in Production
    app.setAppUserModelId(app.isPackaged ? 'com.mintlogic.smartclip' : process.execPath);
}

// --- APP CONFIGURATION ---
// [FIX] This variable is modified by build.js. Do not change the spacing.
let IS_PRO_BUILD = false; 

// --- [UPGRADED] ASYNC HARDWARE CHECK ---
async function initializeLicense() {
    try {
        const licenseStatus = await licenseMgr.loadLicense('SmartClip'); // <-- CHANGED TO loadLicense
        if (licenseStatus && licenseStatus.valid) {
            IS_PRO_BUILD = true;
            console.log(`[LICENSE] SmartClip Hardware Verified: Pro Active`);
        } else {
            IS_PRO_BUILD = false;
            console.log(`[LICENSE] Core Mode Active: ${licenseStatus.reason || 'No key'}`);
        }
    } catch (e) {
        console.error("[LICENSE] Critical Check Error:", e);
        IS_PRO_BUILD = false;
    }
}


// Anchor the real status for the Dev Toggle
let REAL_PRO_STATUS = IS_PRO_BUILD;

let Tesseract = null;
let ocrWorker = null;

// [OFFLINE PRO] Initialize a persistent worker once to avoid WASM overhead
async function initOCR() {
    if (ocrWorker) return; 
    try {
        if (!Tesseract) Tesseract = require('tesseract.js');
        const langPathStr = OCR_ASSETS_PATH.endsWith(path.sep) ? OCR_ASSETS_PATH : OCR_ASSETS_PATH + path.sep;

        // 1. Explicitly locate Tesseract's internal engine files
        const workerScriptPath = require.resolve('tesseract.js/src/worker-script/node/index.js');
        const coreScriptPath = require.resolve('tesseract.js-core/tesseract-core.wasm.js');

        ocrWorker = await Tesseract.createWorker('eng', 1, {
            langPath: langPathStr,
            cachePath: langPathStr,
            // 2. THE FIX: Convert the internal engine paths to Absolute URLs
            workerPath: pathToFileURL(workerScriptPath).href,
            corePath: pathToFileURL(coreScriptPath).href,
            gzip: false, // Essential for 100% offline (prevents remote fetch)
            logger: m => {} 
        });
        console.log("[OCR] Persistent Offline Worker Ready.");
    } catch (e) {
        console.error("[OCR] Init Failed:", e);
    }
}

protocol.registerSchemesAsPrivileged([
    { scheme: 'scp', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
]);

// --- 1. STORAGE & PATHS ---
const MINT_LOGIC_PATH = path.join(app.getPath('appData'), 'MintLogic');
const APP_STORAGE_PATH = path.join(MINT_LOGIC_PATH, 'SmartClip');
const OCR_ASSETS_PATH = app.isPackaged 
    ? path.join(process.resourcesPath, 'assets', 'ocr') 
    : path.join(__dirname, 'assets', 'ocr');

const ensureStorage = () => {
    try {
        if (!fs.existsSync(MINT_LOGIC_PATH)) fs.mkdirSync(MINT_LOGIC_PATH);
        if (!fs.existsSync(APP_STORAGE_PATH)) fs.mkdirSync(APP_STORAGE_PATH);
        return true;
    } catch (e) { return false; }
};

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); } else { ensureStorage(); initializeApp(); }

function initializeApp() {
    const imagesDir = path.join(APP_STORAGE_PATH, 'images');
    const migrationFile = path.join(APP_STORAGE_PATH, 'migration_data.json');
    
    if (!fs.existsSync(imagesDir)) { try { fs.mkdirSync(imagesDir, { recursive: true }); } catch (e) {} }

    const store = new Store({
        cwd: APP_STORAGE_PATH,
        defaults: {
            history: [], logs: [],
            settings: { maxItems: 100, showTimes: true, notificationsEnabled: false, autoClose: false, alwaysOnTop: true, launchOnStartup: false, optimizeImages: true },
            windowBounds: { width: 535, height: 600 } 
        }
    });

    let ramStore = { history: [], logs: [] };

    const db = {
        get: (key) => {
            if (!IS_PRO_BUILD && (key === 'history' || key === 'logs')) return ramStore[key];
            return store.get(key);
        },
        set: (key, val) => {
            if (!IS_PRO_BUILD && (key === 'history' || key === 'logs')) { ramStore[key] = val; return; }
            store.set(key, val);
        }
    };

    let tray = null;
    let window = null;
    let lastContent = clipboard.readText(); 
    let isPaused = false; 
    const iconPath = path.join(__dirname, 'icon.ico');
    const pngPath = path.join(__dirname, 'icon.png');

    app.on('second-instance', () => {
        if (window) { if (window.isMinimized()) window.restore(); toggleWindow(); }
    });

    const reAssertTop = () => {
    if (window && !window.isDestroyed() && window.isVisible()) {
        const settings = db.get('settings');
        if (settings.alwaysOnTop) {
            // Level: screen-saver, RelativeLevel: 1 
            // The '1' ensures you stay above Chrome's rendering layer.
            window.setAlwaysOnTop(true, 'screen-saver', 1);
        }
    }
};

    function createWindow() {
        require('electron').nativeTheme.themeSource = 'dark';
    const bounds = db.get('windowBounds') || { height: 600, width: 535 };
    const savedSettings = db.get('settings');
    const savedScale = savedSettings.uiScale || 1.0;

    // 1. Initialize the window instance first to avoid "Cannot read properties of null"
    window = new BrowserWindow({
        width: bounds.width || 535, 
        height: 190, 
        minHeight: 190, 
        minWidth: 535, 
        maxWidth: 9999,
        resizable: false,
        transparent: true,
        backgroundColor: '#00000000',
        show: false, 
        frame: false, 
        skipTaskbar: false, 
        center: true,
        icon: fs.existsSync(iconPath) ? iconPath : pngPath, 
        webPreferences: { 
            nodeIntegration: false, 
            contextIsolation: true, 
            preload: path.join(__dirname, 'preload.js'), 
            devTools: true,
            zoomFactor: savedScale 
        }
    });

    window.on('focus', reAssertTop);
    window.on('blur', reAssertTop);

    // SECURE: Block drag-and-drop or programmatic navigation to external websites
    window.webContents.on('will-navigate', (event, navigationUrl) => {
        event.preventDefault();
        console.warn('Navigation blocked to:', navigationUrl);
    });

    // SECURE: Block any attempts to open new popup windows
    window.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

        if (process.platform === 'win32') {
        window.setWindowButtonVisibility?.(false); 
    }

        window.loadFile('index.html');
        
        window.webContents.once('did-finish-load', () => {
    // Safety net to ensure zoom sticks after full load
    window.webContents.setZoomFactor(savedScale);
    
    window.webContents.send('init-status', IS_PRO_BUILD);
    window.webContents.send('refresh-data', db.get('history'));
    window.webContents.send('update-logs', db.get('logs') || []);
    window.webContents.send('refresh-settings', { ...savedSettings });
    window.webContents.send('pause-status', isPaused);
    window.webContents.send('startup-status', savedSettings.launchOnStartup || false);
    
    const isStartupLaunch = process.argv.includes('--hidden');
    
    if (!isStartupLaunch) { 
        window.show(); 
        window.focus();
        if (savedSettings.alwaysOnTop) {
            window.setAlwaysOnTop(true, 'screen-saver');
        }
    } else {
        console.log("[STARTUP] Launched silently to tray.");
        // Ensure tray is ready so they can actually find the app
        if (!tray) createTray(); 
    }
});

        // Updated to save the actual dynamic width!
        let resizeTimeout;
        window.on('resize', () => { 
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (window && !window.isDestroyed()) {
                    db.set('windowBounds', { 
                        width: window.getBounds().width, 
                        height: window.getBounds().height 
                    });
                }
            }, 250); // Waits 250ms after you stop dragging before saving to disk
        });
    }

    function createTray() {
        const finalPath = fs.existsSync(iconPath) ? iconPath : pngPath;
        if (fs.existsSync(finalPath)) {
            tray = new Tray(finalPath);
            tray.setToolTip(IS_PRO_BUILD ? 'SmartClip Pro' : 'SmartClip Core');
            tray.on('click', toggleWindow);
            tray.on('double-click', toggleWindow);
            tray.setContextMenu(Menu.buildFromTemplate([ { label: 'Show/Hide', click: toggleWindow }, { type: 'separator' }, { label: 'Quit', click: () => app.quit() } ]));
        }
    }

    function toggleWindow() {
        if (!window) return;
        if (window.isVisible()) { 
            window.hide(); 
        } else { 
            window.show(); 
            
            // FIX: Re-assert Always on Top every time the window wakes up
            const settings = db.get('settings');
            if (settings.alwaysOnTop) {
                window.setAlwaysOnTop(true, 'screen-saver');
            }
            
            window.focus(); 
        }
    }

    function logToUI(msg) {
        let logs = db.get('logs') || [];
        logs.unshift({ ts: Date.now(), text: msg });
        if(logs.length > 50) logs.splice(50);
        db.set('logs', logs);
        if (window && !window.isDestroyed()) window.webContents.send('update-logs', logs);
    }

async function processOCR(imagePath) {
    if (!IS_PRO_BUILD) return { success: false, error: "Pro feature" };
    try {
        if (!ocrWorker) await initOCR(); // Ensure worker is "hot"

        // Convert the raw Windows path into a Node-safe Absolute URL
        const safeImageUrl = pathToFileURL(imagePath).href;

        const { data: { text } } = await ocrWorker.recognize(safeImageUrl);
        return { success: true, text: text.trim() };
    } catch (error) {
        console.error("[OCR] Recognition Error:", error);
        return { success: false, error: error.message };
    }
}

function saveClip(content, type = 'text', dimensions = null) {
    const history = db.get('history');
    const settings = db.get('settings');
    let limit = settings.maxItems || 100;

    // [SECURITY] Hard cap fallback if user manually tampers with the config file
    if (!IS_PRO_BUILD && limit > 50) {
        limit = 50;
    }
    
    if (type === 'text' && history.length > 0 && history[0].text === content) return;

    let finalContent = content;
    const timestamp = Date.now();

    if (type === 'image' && IS_PRO_BUILD) {
        try {
            const fileName = `clip_${timestamp}.png`;
            const filePath = path.join(imagesDir, fileName); // imagesDir is inherited from initializeApp scope
            
            // Save binary buffer
            fs.writeFileSync(filePath, Buffer.isBuffer(content) ? content : Buffer.from(content.replace(/^data:image\/\w+;base64,/, ""), 'base64'));
            finalContent = fileName;
            
            // Execute OCR using the persistent worker
            processOCR(filePath).then(res => {
                if (res.success && res.text) {
                    const currentHist = db.get('history');
                    const item = currentHist.find(i => i.timestamp === timestamp);
                    if (item) { 
                        item.ocrText = res.text; 
                        db.set('history', currentHist); 
                        if (window) window.webContents.send('refresh-data', currentHist); 
                    }
                }
            });
        } catch (err) { 
            logToUI(`[ERROR] Image Save Failed: ${err.message}`); 
            return; 
        }
    }

    const isWeb = (type === 'text' && (content.startsWith('http') || content.startsWith('www')));
    const isColor = (type === 'text' && /^#([0-9A-F]{3}){1,2}$/i.test(content));

    history.unshift({ text: finalContent, type, timestamp, favorite: false, isWeb, isColor, ocrText: null, dimensions });

    // Handle History Limits
    if (history.length > limit) {
        const kept = history.filter((item, idx) => idx < limit || item.favorite);
        const discarded = history.filter((item, idx) => idx >= limit && !item.favorite);
        discarded.forEach(item => { if (item.type === 'image') deleteImageFile(item.text); });
        db.set('history', kept);
    } else { 
        db.set('history', history); 
    }

    if (window) window.webContents.send('refresh-data', db.get('history'));
    
    let logMsg = type === 'image' ? `[IMG] Captured Image` : `[TXT] "${content.substring(0, 25).replace(/\s+/g, ' ')}..."`;
    logToUI(logMsg);
    
    // --- [FIX] NOTIFICATION ENGINE RESTORED ---
    if (settings.notificationsEnabled !== false && Notification.isSupported()) { 
        try {
            const notifOptions = {
                title: type === 'image' ? 'Image Captured' : 'New Clip Saved',
                body: type === 'image' ? 'Image saved' : (content.length > 60 ? content.substring(0, 60) + '...' : content),
                silent: false
            };

            // Only append the icon if the file is physically present
            const toastIcon = fs.existsSync(iconPath) ? iconPath : (fs.existsSync(pngPath) ? pngPath : null);
            if (toastIcon) notifOptions.icon = toastIcon;

            const toast = new Notification(notifOptions);

            toast.on('click', () => {
                if (window && !window.isDestroyed()) {
                    if (window.isMinimized()) window.restore();
                    window.show();
                    window.focus();
                }
            });

            toast.show();
        } catch (err) {
            console.error("Notification Error:", err);
        }
    }
    
}

let debounceTimer = null;
let pendingText = null;
let lastImageFingerprint = null;

function startMonitoring() {
    setInterval(() => {
        if (isPaused) return;

        try {
            // THE FIX: Check available formats FIRST before building a heavy NativeImage
            const formats = clipboard.availableFormats();
            const hasImage = formats.some(f => f.startsWith('image/'));

            if (hasImage) {
                const img = clipboard.readImage();
                if (!img.isEmpty()) {
                    // INSTANT FINGERPRINT: Use width, height, and raw byte length
                    let size = img.getSize(); // Changed from 'const' to 'let' to fix large-image crash
                    const fingerprint = `${size.width}x${size.height}_${img.getBitmap().length}`;
                    
                    if (fingerprint !== lastImageFingerprint) {
                        lastImageFingerprint = fingerprint;
                        
                        let finalImg = img;
                        const settings = db.get('settings');

                        // Optimize if the toggle is ON
                        if (settings.optimizeImages !== false && size.width > 1920) {
                            finalImg = img.resize({ width: 1920 }); 
                            size = finalImg.getSize(); 
                        }
                        
                        const imageBuffer = finalImg.toPNG();
                        const dimString = `${size.width}x${size.height}`;
                        
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            saveClip(imageBuffer, 'image', dimString); 
                        }, 400);
                    }
                    return; // Stop here if we processed an image
                }
            }

            // Fall back to text if no image was found
            const text = clipboard.readText();
            if (text && text.trim() !== '') {
                if (text !== pendingText) {
                    pendingText = text;
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        saveClip(pendingText, 'text');
                    }, 100);
                }
            }
        } catch (err) {
            console.error("Clipboard Error:", err);
        }
    }, 500);
}
    app.whenReady().then(async () => {
        
        // ADD THIS: Force the app to wait for the hardware check before building the UI
        await initializeLicense(); 
        
        // NEW WAVE: Modern Electron protocol handling (SECURED)
        protocol.handle('scp', (request) => {
            const rawFilename = decodeURI(request.url.replace('scp://load/', ''));
            // SECURE: Strip out any directory traversal attempts (e.g., ../../)
            const safeFilename = path.basename(rawFilename);
            const filePath = path.join(imagesDir, safeFilename);
            return net.fetch('file://' + filePath);
        });
        
        createWindow(); 
        createTray();
        globalShortcut.register('CommandOrControl+Shift+Space', toggleWindow);
        globalShortcut.register('F12', () => { if(window) window.webContents.openDevTools({mode:'detach'}); });
        startMonitoring();
    });

    // --- NEW: Helper to safely delete orphaned image files ---
    function deleteImageFile(fileName) {
        if (!fileName) return;
        const filePath = path.join(imagesDir, fileName);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                console.error("Failed to delete dead image file:", e);
            }
        }
    }

    // --- IPC LISTENERS ---

    // --- FEATURE FLAG HANDLER ---
    ipcMain.on('get-is-pro-sync', (event) => { 
        // Public behavior: Respects the variable set by build.js or the License Manager
        event.returnValue = IS_PRO_BUILD; 
    });

    // --- DEVELOPER UI CHANNELS ---
    ipcMain.on('get-is-dev-sync', (e) => { 
        // Public behavior: Hides dev toggle in compiled app, shows it in npm start
        e.returnValue = !app.isPackaged; 
    });

    ipcMain.on('dev-mode-toggle', (event, shouldBeCore) => {
        IS_PRO_BUILD = shouldBeCore ? false : REAL_PRO_STATUS; 
        if (window) window.reload();
    });

    ipcMain.on('set-ui-zoom', (event, factor) => {
        // Dynamically get the window that sent the message
        const webContents = event.sender;
        if (webContents) {
            webContents.setZoomFactor(factor);
        }
    });

// --- NEW WAVE: HARDWARE ID GENERATOR ---
const { machineIdSync } = require('node-machine-id');

// --- UPDATED LICENSE VALIDATOR (WITH UPSTASH PING) ---
ipcMain.on('validate-license', async (event, payload) => {
    console.log(`[DEBUG-MAIN] SmartClip Passkey drop received!`);
    try {
        let rawData;
        
        // Safely handle Path vs. Raw String vs. Object
        if (typeof payload === 'string') {
            if (payload.trim().startsWith('{')) {
                rawData = JSON.parse(payload); // It's a raw JSON string
            } else {
                const fileContent = fs.readFileSync(payload, 'utf-8'); // It's a file path
                rawData = JSON.parse(fileContent);
            }
        } else {
            rawData = payload; // It's already an object
        }

        // 1. Cross-App Check
        if (rawData.app !== 'SmartClip') {
            return event.reply('license-response', { 
                success: false, 
                reason: `This key is for ${rawData.app || 'another app'}, not SmartClip.` 
            });
        }

        // 2. Corporate Registry Bypass for Hardware ID
        let hwId;
        try {
            const { machineIdSync } = require('node-machine-id');
            hwId = machineIdSync();
        } catch (e) {
            const crypto = require('crypto');
            const os = require('os');
            hwId = crypto.createHash('sha256').update(os.hostname() + os.userInfo().username).digest('hex');
        }
        
        // 3. Ping Upstash
        const UPSTASH_CHECK_URL = "https://mint-logic-site.vercel.app/api/check-activation";
        const cloudResponse = await fetch(UPSTASH_CHECK_URL, {
            method: 'POST',
            body: JSON.stringify({ order_id: rawData.order_id, hw_id: hwId, app: 'SmartClip' }),
            headers: { 'Content-Type': 'application/json' }
        });

        const cloudResult = await cloudResponse.json();

        // 4. Block the Pirates
        if (!cloudResult.authorized) {
            if (!app.isPackaged) {
                console.log("🛠️ DEV MODE: Bypassing Upstash limit for local testing.");
            } else {
                return event.reply('license-response', { 
                    success: false, 
                    reason: cloudResult.reason || "Activation limit reached (3 max)." 
                });
            }
        }

        // 1. We construct the payload, but this time we inject the REAL hwId 
        // that was generated at the top of this function!
        const payloadToSave = { 
            app: 'SmartClip', 
            owner: rawData.owner, 
            order_id: rawData.order_id, 
            hw_id: hwId, // <-- THE MISSING HARDWARE SEAL
            unlocked: true 
        };
        
        // 2. LicenseManager will automatically detect the real hw_id, 
        // recalculate the signature locally, and encrypt it to the disk.
        const saved = licenseMgr.saveLicense(payloadToSave, 'SmartClip');
        
        if (saved) {
            IS_PRO_BUILD = true;
            REAL_PRO_STATUS = true; // Updates your specific dev toggle anchor
            event.reply('license-response', { success: true, owner: rawData.owner });
            setTimeout(() => { if (window) window.reload(); }, 1500);
        } else {
            event.reply('license-response', { success: false, reason: "Local Windows OS Encryption failed." });
        }

    } catch (err) {
        console.error("[DEBUG-MAIN] Activation Error:", err);
        event.reply('license-response', { success: false, reason: "Invalid file format or connection error." });
    }
});

// THE MANUAL OVERRIDE BYPASS
ipcMain.on('validate-license-string', async (event, rawJson) => {
    try {
        const tempPath = path.join(app.getPath('temp'), 'manual_license.mint');
        fs.writeFileSync(tempPath, rawJson);
        ipcMain.emit('validate-license', event, tempPath);
    } catch (e) {
        event.reply('license-response', { success: false, reason: "Manual entry failed." });
    }
});

ipcMain.on('open-external', (event, url) => { 
    try { 
        if (url) shell.openExternal(url); 
    } catch (err) {
        console.error("Failed to open external link:", err);
    } 
});

    ipcMain.on('load-data', (event) => {
        event.reply('refresh-data', db.get('history'));
        event.reply('update-logs', db.get('logs') || []); 
        event.reply('refresh-settings', db.get('settings'));
        event.reply('pause-status', isPaused);
        event.reply('init-status', IS_PRO_BUILD);
    });

    ipcMain.on('toggle-pause', (event) => { 
    isPaused = !isPaused; 
    
    if (!isPaused) {
        // We just unpaused. Establish the current clipboard as the new baseline
        // so the monitoring loop doesn't instantly capture it.
        const formats = clipboard.availableFormats();
        
        if (formats.some(f => f.startsWith('image/'))) {
            const img = clipboard.readImage();
            if (!img.isEmpty()) {
                const size = img.getSize();
                lastImageFingerprint = `${size.width}x${size.height}_${img.getBitmap().length}`;
                lastContent = img.toDataURL();
            }
        } else {
            pendingText = clipboard.readText();
            lastContent = pendingText;
        }
    }
    
    event.reply('pause-status', isPaused);
    logToUI(isPaused ? "Capture Paused" : "Capture Resumed"); 
});
    
    ipcMain.on('update-settings', (event, newSettings) => {
        const currentSettings = db.get('settings');

        // [SECURITY] Strict enforcement of Core limits on the backend
        if (!IS_PRO_BUILD && newSettings.maxItems !== undefined) {
            if (newSettings.maxItems > 50) newSettings.maxItems = 50;
            if (newSettings.maxItems < 5) newSettings.maxItems = 5; 
        }

        const updated = { ...currentSettings, ...newSettings };
    db.set('settings', updated);
    
if (newSettings.uiScale !== undefined && window) {
        window.webContents.setZoomFactor(newSettings.uiScale);
    }
    if (newSettings.alwaysOnTop !== undefined && window) {
        window.setAlwaysOnTop(newSettings.alwaysOnTop, 'screen-saver', 1); 
    }
    
    event.reply('refresh-settings', updated);
});

    ipcMain.on('edit-item', (event, data) => {
        const history = db.get('history');
        const item = history.find(i => i.timestamp === data.timestamp);
        if (item) { item.text = data.newText; db.set('history', history); event.reply('refresh-data', history); logToUI("Item edited."); }
    });

    ipcMain.on('unmask-item', (event, timestamp) => {
        const history = db.get('history');
        const item = history.find(i => i.timestamp === timestamp);
        if (item) { 
            item.unmasked = true;  // Set the override flag
            item.manualMask = false; // THE FIX: Also clear the manual mask!
            db.set('history', history); 
            event.reply('refresh-data', history); 
            logToUI("Privacy mask removed."); 
        }
    });

    ipcMain.on('mask-item', (event, timestamp) => {
        const history = db.get('history');
        const item = history.find(i => i.timestamp === timestamp);
        if (item) { 
            item.manualMask = true; // Force the mask on
            item.unmasked = false;  // Clear the unmask flag just in case they change their mind
            db.set('history', history); 
            event.reply('refresh-data', history); 
            logToUI("Item manually secured."); 
        }
    });

    ipcMain.on('set-label', (event, data) => {
        const history = db.get('history');
        const item = history.find(i => i.timestamp === data.timestamp);
        if (item) { 
            item.label = data.label; 
            db.set('history', history); 
            event.reply('refresh-data', history); 
            logToUI(`Label updated: ${data.label}`); 
        }
    });

    ipcMain.on('download-history', async (event, selectedIds) => {
        const history = db.get('history');
        const items = selectedIds.length ? history.filter(i => selectedIds.includes(i.timestamp)) : history;
        const content = items.map(i => i.text).join('\n---\n');
        const { filePath } = await dialog.showSaveDialog(window, { defaultPath: 'SmartClip_Export.txt' });
        if (filePath) { fs.writeFileSync(filePath, content); logToUI(`Exported ${items.length} items.`); }
    });

    ipcMain.on('write-clipboard', (event, text) => { lastContent = text; clipboard.writeText(text); });
    ipcMain.on('write-image', (event, input) => {
    try {
        let img;
        if (input.startsWith('data:')) {
            img = nativeImage.createFromDataURL(input);
        } else {
            // SECURE: Prevent hackers from navigating outside the images directory
            const safeInput = path.basename(input);
            const filePath = path.join(APP_STORAGE_PATH, 'images', safeInput);
            if (fs.existsSync(filePath)) {
                img = nativeImage.createFromPath(filePath);
            }
        }

        if (img && !img.isEmpty()) {
            clipboard.writeImage(img);
            // Update lastContent to prevent the app from re-capturing its own paste
            lastContent = img.toDataURL(); 
        } else {
            console.error("[CLIPBOARD] Failed to create image from:", input);
        }
    } catch (err) {
        console.error("[CLIPBOARD] Image write error:", err);
    }
});

    ipcMain.on('hide-window', () => {
    if (window && !window.isDestroyed()) {
        window.blur(); // Focus must be removed FIRST
        window.hide(); // Then safely hide the window
    }
});
    ipcMain.on('minimize-window', () => window.minimize());

    ipcMain.on('resize-window', (event, arg1) => {
    if (window && !window.isDestroyed() && !window.isMaximized()) {
        // Unpack the payload
        let newHeight = typeof arg1 === 'object' ? arg1.height : arg1;
        let layoutState = typeof arg1 === 'object' ? arg1.layoutState : 0;
        let requestedWidth = typeof arg1 === 'object' ? arg1.width : null;
        
        const currentBounds = window.getBounds();
        
        // 1. TRUST THE RENDERER: Use requested width or default to 535
        let targetW = typeof requestedWidth === 'number' ? requestedWidth : 535;
        let minH = 161;

        if (layoutState === 2) {
            minH = 550; // Help mode
        } else if (layoutState === 1) {
            minH = 291; // Settings mode
        }

        const finalH = Math.max(minH, Math.floor(newHeight));

        const currentScreen = screen.getDisplayMatching(currentBounds);
        const { height: screenHeight, y: screenY } = currentScreen.workArea; 
        
        let newY = currentBounds.y;
        const projectedBottomEdge = newY + finalH;
        const screenBottomEdge = screenY + screenHeight; 

        if (projectedBottomEdge > screenBottomEdge) {
            newY = screenBottomEdge - finalH;
        }
        if (newY < screenY) {
            newY = screenY;
        }

        // --- THE NEW SAFETY CHECK ---
        // Do not trigger a redraw if the window is already the correct size!
        if (currentBounds.width === targetW && currentBounds.height === finalH && currentBounds.y === newY) {
            return; 
        }

        // 2. Apply sizes
        window.setMinimumSize(535, minH);
        window.setMaximumSize(9999, 9999); 
        
        window.setBounds({ 
            x: currentBounds.x, 
            y: newY, 
            width: targetW, 
            height: finalH 
        }, true); // <--- We put 'true' back so DWM doesn't drop the texture!
    }
});

    ipcMain.on('toggle-favorite', (event, timestamp) => {
        const history = db.get('history');
        const item = history.find(i => i.timestamp === timestamp);
        if (item) { item.favorite = !item.favorite; db.set('history', history); event.reply('refresh-data', history); }
    });

    ipcMain.on('delete-item', (event, timestamp) => {
        const history = db.get('history');
        const itemToDelete = history.find(i => i.timestamp === timestamp);
        
        // Destroy the physical file if it's an image
        if (itemToDelete && itemToDelete.type === 'image') {
            deleteImageFile(itemToDelete.text);
        }

        const updatedHistory = history.filter(i => i.timestamp !== timestamp);
        db.set('history', updatedHistory);
        event.reply('refresh-data', updatedHistory);
    });

    ipcMain.on('delete-items', (event, timestamps) => {
    const history = db.get('history');
    
    // 1. Identify items to remove
    const itemsToDelete = history.filter(i => timestamps.includes(i.timestamp));
    
    // 2. Destroy physical files for any images in the batch
    itemsToDelete.forEach(item => {
        if (item.type === 'image') deleteImageFile(item.text);
    });

    // 3. Update database
    const updatedHistory = history.filter(i => !timestamps.includes(i.timestamp));
    db.set('history', updatedHistory);
    
    event.reply('refresh-data', updatedHistory);
    logToUI(`Batch deleted ${timestamps.length} items.`);
});

ipcMain.on('clear-history', (event) => {
    const history = db.get('history');
    
    // [FIX] Ensure we only keep favorites and delete files for everything else
    const itemsToDelete = history.filter(i => !i.favorite);
    itemsToDelete.forEach(item => {
        if (item.type === 'image') deleteImageFile(item.text);
    });

    const keptHistory = history.filter(i => i.favorite);
    db.set('history', keptHistory);
    
    clipboard.clear();
    event.reply('refresh-data', keptHistory);
    logToUI("History & Image storage purged."); 
});

    ipcMain.on('restore-clip', (event, item) => {
        const history = db.get('history');
        const existingIndex = history.findIndex(i => i.text === item.text);
        if (existingIndex > -1) history.splice(existingIndex, 1);
        const newItem = { ...item, timestamp: Date.now() };
        history.unshift(newItem);
        db.set('history', history);
        if (item.type === 'image') { const img = nativeImage.createFromDataURL(item.text); clipboard.writeImage(img); } 
        else { clipboard.writeText(item.text); }
        event.reply('refresh-data', history);
        logToUI("Restored from log.");
    });

    ipcMain.on('flush-logs', (event) => { db.set('logs', []); event.reply('update-logs', []); });
    
    ipcMain.on('toggle-startup', (event, isEnabled) => {
    try {
        const settings = db.get('settings');
        settings.launchOnStartup = isEnabled;
        db.set('settings', settings);

        app.setLoginItemSettings({
            openAtLogin: isEnabled,
            path: process.execPath,
            // The --hidden flag tells our code below NOT to show the window
            args: ['--hidden'] 
        });

        event.reply('startup-status', isEnabled);
        logToUI(isEnabled ? "Startup Launch Enabled" : "Startup Launch Disabled");
    } catch(e) {
        console.error("Startup Toggle Error:", e);
    }
});

    // --- CLEAN SHUTDOWN ---
app.on('will-quit', async () => {
    if (ocrWorker) {
        try {
            await ocrWorker.terminate();
            console.log("[OCR] Offline Worker terminated safely.");
        } catch (e) {
            console.error("[OCR] Termination Error:", e);
        }
    }
});
}