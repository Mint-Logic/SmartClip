const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron'); 

const LicenseManager = {
    getLicensePath: (appName) => {
        const storagePath = path.join(app.getPath('appData'), 'MintLogic', appName);
        if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
        return path.join(storagePath, 'license.bin'); 
    },

    saveLicense: (data, appName) => {
        if (!safeStorage.isEncryptionAvailable()) return false;
        
        try {
            const encryptedString = safeStorage.encryptString(JSON.stringify(data));
            fs.writeFileSync(LicenseManager.getLicensePath(appName), encryptedString);
            return true;
        } catch (e) {
            console.error("Passkey Encryption Failed:", e);
            return false;
        }
    },

    loadLicense: (appName) => {
        const filePath = LicenseManager.getLicensePath(appName);
        if (!fs.existsSync(filePath)) return { valid: false, reason: "No license found." };
        if (!safeStorage.isEncryptionAvailable()) return { valid: false, reason: "DPAPI unavailable." };

        try {           
            const encryptedBuffer = fs.readFileSync(filePath); // <-- Reads the raw binary Buffer natively!
            const decryptedString = safeStorage.decryptString(encryptedBuffer);
            const data = JSON.parse(decryptedString);
            
            if (data && data.unlocked && data.app === appName) {
                return { valid: true, data };
            }
            return { valid: false, reason: "Invalid passkey data." };
        } catch (e) {
            return { valid: false, reason: "Hardware mismatch (Decryption failed)." };
        }
    }
};

module.exports = LicenseManager;