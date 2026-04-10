// HistoryManager.js
import { PrivacyEngine } from './PrivacyEngine.js';

export const HistoryManager = {
    filterAndSort: (history, searchTerm) => {
        const term = searchTerm.toLowerCase();
        
        const filtered = history.filter(item => {
            if (!item || !item.text) return false; 
            if (item.type === 'image') {
                const matchesKeyword = term === 'image';
                const matchesOCR = item.ocrText && item.ocrText.toLowerCase().includes(term);
                return term === '' || matchesKeyword || matchesOCR;
            }
            return item.text.toLowerCase().includes(term);
        });
        
        // Sort: Favorites ALWAYS at the top
        return filtered.sort((a, b) => (a.favorite === b.favorite) ? 0 : a.favorite ? -1 : 1);
    },

    getMatchStatus: (count) => {
        return count > 0 ? `1/${count}` : "0/0";
    },

    isSecret: (item) => {
    if (item.type !== 'text') return false;
    if (item.unmasked) return false;
    // Ensure PrivacyEngine is available
    return (item.manualMask || PrivacyEngine.checkSensitivity(item.text));
}
};