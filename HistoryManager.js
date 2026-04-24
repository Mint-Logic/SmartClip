// HistoryManager.js
import { PrivacyEngine } from './PrivacyEngine.js';

export const HistoryManager = {
    filterAndSort: (history, rawTerm, filterType = 'ALL') => {
        // 1. START WITH CATEGORY FILTERING
        let processedList = [...history];

        if (filterType === 'IMAGE') {
            processedList = processedList.filter(item => item.type === 'image');
        } else if (filterType === 'LINK') {
            processedList = processedList.filter(item => item.isWeb === true);
        } else if (filterType === 'COLOR') {
            processedList = processedList.filter(item => item.isColor === true);
        }

        // 2. APPLY SEARCH FILTERING
        if (rawTerm && rawTerm.trim().length > 0) {
            const term = rawTerm.toLowerCase().trim();
            processedList = processedList.filter(item => {
                if (!item) return false;

                // Check label first
                if (item.label && item.label.toLowerCase().includes(term)) return true;
                
                // Search text content (masking secrets)
                if (item.type === 'text') {
                    if (HistoryManager.isSecret(item)) return false; 
                    return item.text.toLowerCase().includes(term);
                }
                
                // Search OCR text for images
                if (item.type === 'image') {
                    const matchesKeyword = term === 'image';
                    const matchesOCR = item.ocrText && item.ocrText.toLowerCase().includes(term);
                    return matchesKeyword || matchesOCR;
                }
                return false;
            });
        }

        // 3. APPLY SORTING (Pinned First, then Newest)
        return processedList.sort((a, b) => {
            if (a.favorite === b.favorite) {
                return b.timestamp - a.timestamp; 
            }
            return a.favorite ? -1 : 1; 
        });
    },

    getMatchStatus: (count) => {
        return count > 0 ? `1/${count}` : "0/0";
    },

    isSecret: (item, settings = {}, isPro = false) => {
    if (item.type !== 'text' || item.unmasked) return false;
    if (item.manualMask) return true;

    const text = item.text;
    
    // THE CORE VS PRO ENFORCEMENT
    // Core is locked to 'MED'. Pro can access 'LOW' or 'HIGH'.
    const level = isPro ? (settings.privacyLevel || 'MED') : 'MED';
    
    const spaceCount = (text.match(/ /g) || []).length;
    
    // Developer Prose Bypass (Only active for Pro users)
    if (isPro) {
        const isCode = /[{}[\]()=;]/.test(text) && text.length > 50;
        if (isCode) return false;
    }

        const keywords = ['password', 'token', 'key', 'secret', 'auth', 'api'];
        const hasKeyword = keywords.some(k => text.toLowerCase().includes(k));

        // --- THE CALIBRATED BYPASS ---
        if (spaceCount > 3) {
            // High is only paranoid about sentences if they contain a keyword
            if (level === 'HIGH' && hasKeyword) {
                // Continue to masking check
            } else {
                return false; // Safe prose
            }
        }

        // --- TIERED MASKING LOGIC ---
        if (level === 'LOW') {
            return PrivacyEngine.checkSensitivity(text, 'LOW');
        }
        if (level === 'MED') {
            if (hasKeyword && (text.includes(':') || text.includes('='))) return true;
            return PrivacyEngine.checkSensitivity(text, 'MED');
        }
        if (level === 'HIGH') {
            if (hasKeyword) return true;
            if (text.length < 25 && spaceCount === 0) return true;
            return PrivacyEngine.checkSensitivity(text, 'HIGH');
        }

        return false;
    }
};