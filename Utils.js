// Utils.js

export const Utils = {
    debounce: (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    formatBytes: (str) => {
        const bytes = new Blob([str]).size;
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    getContrastYIQ: (hexcolor) => {
        hexcolor = hexcolor.replace("#", "");
        if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(c => c + c).join('');
        var r = parseInt(hexcolor.substr(0, 2), 16);
        var g = parseInt(hexcolor.substr(2, 2), 16);
        var b = parseInt(hexcolor.substr(4, 2), 16);
        return (((r * 299) + (g * 587) + (b * 114)) / 1000) >= 128 ? '#000' : '#fff';
    },

    showSystemToast: (msg, success = true) => {
        let toast = document.getElementById('sysToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sysToast';
            document.body.appendChild(toast);
        }
        toast.className = '';
        toast.innerHTML = success ? `<i class="fa-solid fa-circle-check"></i> ${msg}` : `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
        if (!success) toast.classList.add('error');
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    showMsg: (txt) => {
        const s = document.getElementById('status');
        if (!s) return;
        s.textContent = txt; s.classList.add('show');
        setTimeout(() => s.classList.remove('show'), 1500);
    },

    transformText: (text, type) => {
        let res = text;
        if (type === 'upper') res = text.toUpperCase();
        if (type === 'lower') res = text.toLowerCase();
        if (type === 'sentence') { 
            let lowerText = text.toLowerCase();
            res = lowerText.replace(/(^\s*\w|[\.\!\?]\s*\w|\b[i]\b)/g, function(match) {
                return match.toUpperCase();
            });
        }
        
        // --- NEW URL SANITIZER (Replaces old whitespace cleaner) ---
        if (type === 'clean') { 
            try {
                // Only sanitize if it's a URL, otherwise fallback to original behavior
                if (text.trim().startsWith('http')) {
                    const url = new URL(text.trim());
                    const params = new URLSearchParams(url.search);
                    
                    // List of common tracking junk to strip for the demo
                    const blacklist = [
                        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                        'ref', 'click_id', 'fbclid', 'gclid', 'session', 'affiliate', 'ncid'
                    ];
                    
                    blacklist.forEach(param => params.delete(param));
                    url.search = params.toString();
                    
                    // Clean up trailing slashes or empty '?' marks
                    res = url.toString().replace(/\/$/, "").replace(/\?$/, "");
                } else {
                    res = text.replace(/\s+/g, ''); // Keep whitespace cleaning for non-URLs
                }
            } catch (e) {
                res = text.replace(/\s+/g, ''); 
            }
        }
        
        if (type === 'slugify') res = text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
        if (type === 'camel') res = text.toLowerCase().trim().split(/[_\s-]+/).map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
        return res;
    }
};