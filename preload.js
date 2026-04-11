const { contextBridge, ipcRenderer } = require('electron');

// 1. Define Allowed Channels (The Whitelist)
const VALID_CHANNELS = {
    SEND: [
        'load-data', 'toggle-pause', 'update-settings', 'flush-logs',
        'write-clipboard', 'write-image', 'restore-clip', 'toggle-favorite',
        'delete-item', 'delete-items', 'edit-item', 'clear-history',
        'download-history', 'dev-mode-toggle', 'open-external',
        'hide-window', 'minimize-window', 'resize-window', 'toggle-startup',
        'validate-license', 'get-is-pro-sync', 'validate-license-string',
        'get-is-dev-sync',
        'set-label', 
        'unmask-item',
        'mask-item',
        'set-ui-zoom' // <-- ADDED HERE TO PASS SECURITY CHECK
    ],
    RECEIVE: [
        'refresh-data', 'refresh-settings', 'update-logs', 
        'pause-status', 'startup-status', 'init-status',
        'license-response'
    ]
};

const smartClipAPI = {
    devModeToggle: (val) => smartClipAPI.send('dev-mode-toggle', val),
    // 2. Safe Wrapper for Sending
    send: (channel, data) => {
        if (VALID_CHANNELS.SEND.includes(channel)) {
            ipcRenderer.send(channel, data);
        } else {
            console.warn(`[Blocked] Unauthorized IPC send: ${channel}`);
        }
    },

    // 3. Safe Wrapper for Listening
    on: (channel, func) => {
        if (VALID_CHANNELS.RECEIVE.includes(channel)) {
            // Remove any existing listeners to prevent duplicates on hot-reload
            ipcRenderer.removeAllListeners(channel);
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        } else {
            console.warn(`[Blocked] Unauthorized IPC listener: ${channel}`);
        }
    },

    // 4. Exposed Helper Methods
    loadData: () => smartClipAPI.send('load-data'),
    togglePause: () => smartClipAPI.send('toggle-pause'),
    updateSettings: (settings) => smartClipAPI.send('update-settings', settings),
    flushLogs: () => smartClipAPI.send('flush-logs'),
    
    // NATIVE CLIPBOARD ACTIONS
    writeClipboard: (text) => smartClipAPI.send('write-clipboard', text),
    writeImage: (dataUrl) => smartClipAPI.send('write-image', dataUrl),
    
    restoreClip: (item) => smartClipAPI.send('restore-clip', item),
    toggleFavorite: (timestamp) => smartClipAPI.send('toggle-favorite', timestamp),
    
    // Batch Delete Support
    deleteItem: (timestamp) => smartClipAPI.send('delete-item', timestamp),
    deleteItems: (timestamps) => smartClipAPI.send('delete-items', timestamps),
    unmaskItem: (timestamp) => smartClipAPI.send('unmask-item', timestamp),
    maskItem: (timestamp) => smartClipAPI.send('mask-item', timestamp),
    
    editItem: (data) => smartClipAPI.send('edit-item', data),
    clearHistory: () => smartClipAPI.send('clear-history'),
    
    downloadHistory: (ids) => smartClipAPI.send('download-history', ids),
    
    // MIGRATION & WINDOW ACTIONS
    openExternal: (url) => smartClipAPI.send('open-external', url),

    hideWindow: () => smartClipAPI.send('hide-window'),
    minimizeWindow: () => smartClipAPI.send('minimize-window'),
    resizeWindow: (args) => smartClipAPI.send('resize-window', args),
    dragResize: (width) => ipcRenderer.send('drag-resize', width),

    toggleStartup: (bool) => smartClipAPI.send('toggle-startup', bool),

    // [CRITICAL FIX] Moved inside the bridge!
    setLabel: (data) => smartClipAPI.send('set-label', data),

    // Listeners
    onRefreshData: (callback) => smartClipAPI.on('refresh-data', callback),
    onRefreshSettings: (callback) => smartClipAPI.on('refresh-settings', callback),
    onUpdateLogs: (callback) => smartClipAPI.on('update-logs', callback),
    onPauseStatus: (callback) => smartClipAPI.on('pause-status', callback),
    onStartupStatus: (callback) => smartClipAPI.on('startup-status', callback),
    
    // LICENSE & PRO FEATURES
    validateLicense: (key) => smartClipAPI.send('validate-license', key),
    validateLicenseString: (keyStr) => smartClipAPI.send('validate-license-string', keyStr), // <-- ADDED FOR ADMIN BYPASS
    onLicenseResponse: (callback) => smartClipAPI.on('license-response', callback),

    // SYNCHRONOUS PRO CHECK
    getIsProSync: () => ipcRenderer.sendSync('get-is-pro-sync'),
    getIsDevSync: () => ipcRenderer.sendSync('get-is-dev-sync'),
    
    // VISUAL FIX: The new native zoom bridge successfully added inside the object
    setZoom: (factor) => ipcRenderer.send('set-ui-zoom', factor)
};

// --- THE CLEANED UP CONTEXT BRIDGE ---
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('smartClip', smartClipAPI);
    } catch (error) {
        console.error("ContextBridge Failed:", error);
    }
} else {
    window.smartClip = smartClipAPI;
}