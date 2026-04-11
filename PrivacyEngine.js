// PrivacyEngine.js

export const PrivacyEngine = {
    checkSensitivity: (text) => {
        if (!text || text.length > 5000) return false; 
        
        if (text.includes("sk_test_") || text.includes("API_KEY=")) return true;

        const CRITICAL_PATTERNS = [ 
            /sk_live_[0-9a-zA-Z]{24}/,        
            /ghp_[0-9a-zA-Z]{36}/,            
            /xox[baprs]-[0-9a-zA-Z]{10,48}/,  
            /AKIA[0-9A-Z]{16}/,               
            /-----BEGIN (RSA|DSA|EC|PGP) PRIVATE KEY/, 
            /\b0x[a-fA-F0-9]{40}\b/,          
            /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/,  
            /ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/ 
        ];
        if (CRITICAL_PATTERNS.some(p => p.test(text))) return true;
        
        const AGGRESSIVE_PATTERNS = [ 
            /\b(?:\d[ -]*?){13,19}\b/, 
            /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]{12,40}/, 
            /\b(?:api_key|apikey|token|secret|password|passwd|auth_token)\b\s*[:=]\s*(?:["']?)(\S{5,})(?:["']?)/i 
        ];

        const isValidLuhn = (numStr) => {
            let sum = 0;
            let shouldDouble = false;
            for (let i = numStr.length - 1; i >= 0; i--) {
                let digit = parseInt(numStr.charAt(i), 10);
                if (shouldDouble) {
                    if ((digit *= 2) > 9) digit -= 9;
                }
                sum += digit;
                shouldDouble = !shouldDouble;
            }
            return (sum % 10) === 0;
        };

        const hasManyLines = (text.match(/\n/g) || []).length > 2;
        const isUrl = /^https?:\/\//i.test(text.trim()); 

        if (!hasManyLines) {
            const ccMatch = text.match(AGGRESSIVE_PATTERNS[0]);
            if (ccMatch) {
                const digits = ccMatch[0].replace(/[^0-9]/g, '');
                if (digits.length >= 13 && digits.length <= 19 && isValidLuhn(digits)) {
                    return true;
                }
            }

            if (AGGRESSIVE_PATTERNS[2].test(text)) return true;

            if (!isUrl && AGGRESSIVE_PATTERNS[1].test(text)) {
                return true;
            }
        }

        return false;
    },

    getSmartSnippet: (text, term, isSecret) => {
        if (isSecret) return `<span style="color:var(--muted); letter-spacing:2px; font-weight:bold;">••••••••••••</span> <i class="fa-solid fa-lock" style="font-size:9px; opacity:0.5; margin-left:4px;"></i>`;
        if (!term || term.trim() === "") return text;
        const lowerText = text.toLowerCase();
        const index = lowerText.indexOf(term);
        if (index === -1) return text;
        const padding = 40; 
        let start = Math.max(0, index - padding);
        let end = Math.min(text.length, index + term.length + padding);
        let snippet = text.substring(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < text.length) snippet = snippet + "...";
        return snippet;
    },

    escapeHTML: (str) => {
        if (!str) return "";
        return str.replace(/[&<>"']/g, function(m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]; });
    },

    formatText: (text, term, isSecret) => {
        if (isSecret) return `<span style="color:var(--muted); letter-spacing:2px; font-weight:bold;">••••••••••••</span>`;
        let safeText = PrivacyEngine.escapeHTML(text);
        if (term && term.trim().length > 0) {
            const safeTerm = PrivacyEngine.escapeHTML(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${safeTerm})`, 'gi');
            return safeText.replace(regex, '<span class="highlight">$1</span>');
        }
        return safeText;
    }
};