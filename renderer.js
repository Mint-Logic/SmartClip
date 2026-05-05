import { Templates } from './Templates.js';
import { PrivacyEngine } from './PrivacyEngine.js';
import { Utils } from './Utils.js';
import { UIManager } from './UIManager.js';
import { HistoryManager } from './HistoryManager.js';

// ==========================================================
// --- SMARTCLIP RENDERER (PRIVACY EDITION V2) ---
// ==========================================================

// --- BUILD CONFIGURATION ---
const IS_PRO_BUILD = window.smartClip.getIsProSync(); 
const IS_DEV = window.smartClip.getIsDevSync();

// --- STATE VARIABLES ---
let activeFilter = 'ALL';
let fullHistory = [];
let displayedHistory = []; 
let showTimes = true;
let autoClose = false; 
let selectedIndex = -1; 
let ctxTargetId = null; 
let selectedItems = new Set();
let isSelectionMode = false;
let globalSettings = { tooltipsEnabled: true }; 
let lastDeleted = null;
let undoTimeout = null;
let isUndoHovered = false;

const tinFoilJokes = [
                "Best for users who have never shared their Netflix password or for those who communicate exclusively via dead-drops.",
                "Best for those handling sensitive credentials, or for people who suspect their toaster is spying on them.",
                "Best for high-security environments, or for users operating from inside a Faraday cage in an underground bunker.",
                "Best for top-secret data, or for those convinced the neighbors are foreign intelligence operatives.",
                "Best for cyber-security hobbyists, or for anyone who thinks their microwave is reporting back to headquarters.",
                "Best for keeping secrets, or for people who cover their webcam with three layers of duct tape.",
                "Best for deep-cover agents, or for users who communicate exclusively via carrier pigeon.",
                "Best for protecting government secrets, or for people who think the Wi-Fi signal is telling them to buy more kale.",
                "Best for sensitive assets, or for users who are convinced their neighbor’s cat is a government surveillance drone.",
                "Best for classified data, or for people who keep their router in a lead-lined box 'just in case'.",
                "Best for protecting the crown jewels, or for people who think their smart-fridge is judging their life choices.",
                "Best for security purists, or for people who believe their Roomba is mapping their house for an upcoming alien invasion.",
                "Best for protecting nuclear launch codes, or for people who work at Area 51.",
                "Best for doomsday preppers, or for people who think The X-Files was a documentary."
            ];


// --- DOM ELEMENTS ---
const undoToast = document.getElementById('undoToast');
const undoBtn = document.getElementById('undoBtn');
const list = document.getElementById('historyList'); 
const helpModal = document.getElementById('help-modal');
const btnActivate = document.getElementById('btnActivate');

if (helpModal) helpModal.innerHTML = Templates.getAboutHtml(IS_PRO_BUILD, IS_DEV);
const uiScaleSelect = document.getElementById('uiScaleSelect');
const privacySelect = document.getElementById('privacyLevelSelect');
const ignoreColorsToggle = document.getElementById('ignoreColorsToggle');
const moveDupesToggle = document.getElementById('moveDupesToggle');
const clipHeader = document.querySelector('.clip-history-header'); 
const notifyToggle = document.getElementById('notifyToggle');
const timeToggle = document.getElementById('timeToggle');
const autoCloseToggle = document.getElementById('autoCloseToggle');
const alwaysOnTopToggle = document.getElementById('alwaysOnTopToggle');
const startupToggle = document.getElementById('startupToggle');
const optimizeToggle = document.getElementById('optimizeToggle');
const maxInput = document.getElementById('maxItemsInput');
const searchInput = document.getElementById('searchInput');
const pauseBtn = document.getElementById('pauseBtn');
const settingsPanel = document.getElementById('settingsPanel');
const searchMeta = document.getElementById('searchMeta');
const matchCount = document.getElementById('matchCount');
const searchUpBtn = document.getElementById('searchUpBtn');
const searchDownBtn = document.getElementById('searchDownBtn');

// --- MODALS & MENUS ---
const modal = document.getElementById('custom-modal');
const modalMsg = document.getElementById('modal-msg');
const modalYes = document.getElementById('modal-yes');
const modalCancel = document.getElementById('modal-cancel');
let currentConfirmAction = null; 

const confirmModal = document.getElementById('confirmModal');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');

const helpBtn = document.getElementById('helpBtn');

const ctxMenu = document.getElementById('context-menu');
const dlBtn = document.getElementById('dlBtn');
const clrBtn = document.getElementById('clrBtn');
const toggleLogBtn = document.getElementById('toggleLog');
const flushLogBtn = document.getElementById('flushLog');


// --- [FINAL PIXEL-PERFECT CALIBRATION] WINDOW SIZING ---

// THE FIX: Track the last known state to prevent infinite resize loops
let lastSetHeight = 0;
let lastSetLayout = -1;

const updateWindowHeight = Utils.debounce((args = null) => {
    const helpModalEl = document.getElementById('help-modal');
    const header = document.querySelector('.header');
    const footer = document.querySelector('.footer');
    const settings = document.getElementById('settingsPanel');
    const list = document.getElementById('historyList');
    const items = list ? list.querySelectorAll('.item') : [];
    
    const isSettingsOpen = document.body.classList.contains('settings-active');
    const isHelpOpen = (helpModalEl && helpModalEl.style.display === 'flex');

    const scale = globalSettings.uiScale || 1;

    // --- SMART WIDTH DETERMINATION ---
    let targetW;
    if (args instanceof Event) {
        // OS Window resize: keep current width so it doesn't fight your mouse
        targetW = window.outerWidth;
    } else if (typeof args === 'number') {
        // Manual drag request
        targetW = args;
    } else {
        // UI Action (settings close, scale change): Snap back!
        targetW = Math.ceil((isHelpOpen ? 750 : 535) * scale);
    }

    // 2. Calculate Vertical Height
    let chromeHeight = (header ? header.offsetHeight : 50) + (footer ? footer.offsetHeight : 40);
    chromeHeight += 3; 

    if (isSettingsOpen) {
        chromeHeight += (settings ? settings.offsetHeight : 0);
    }

    let listContentHeight = 0;
    const clipHeader = document.querySelector('.clip-history-header');
    if (clipHeader && clipHeader.style.display !== 'none') {
        listContentHeight += clipHeader.offsetHeight + 12; 
    }

    if (items.length > 0) {
        const firstItem = items[0].getBoundingClientRect();
        const lastItem = items[items.length - 1].getBoundingClientRect();
        listContentHeight += (lastItem.bottom - firstItem.top) + 12; 
    } else {
        const emptyState = document.querySelector('.empty-wrap');
        if (emptyState && emptyState.style.display !== 'none') {
            listContentHeight += emptyState.offsetHeight + 10; 
        }
    }

    const minHeight = isSettingsOpen ? 291 : 190;
    const maxHeight = Math.floor(window.screen.availHeight * 0.9);

    let finalHeight = Math.max((chromeHeight + listContentHeight), minHeight);
    finalHeight = Math.ceil(finalHeight * scale);
    finalHeight = Math.min(finalHeight, maxHeight);
    
    const currentLayout = isHelpOpen ? 2 : (isSettingsOpen ? 1 : 0);

    // 3. THE SAFETY LOCK: Stop redundant IPC spam!
    if (finalHeight === lastSetHeight && currentLayout === lastSetLayout) {
        // THE FIX: Even if the window didn't resize, DevTools might have secretly scrolled the body. Force it back.
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        return; 
    }
    lastSetHeight = finalHeight;
    lastSetLayout = currentLayout;

    // Send the explicit height and width down to the main process
    if (window.smartClip && window.smartClip.resizeWindow) {
        window.smartClip.resizeWindow({ 
            height: finalHeight, 
            width: targetW, 
            layoutState: currentLayout 
        });
    }

    const contentContainer = document.querySelector('.content');
    if (contentContainer) {
        contentContainer.style.overflowY = finalHeight >= maxHeight ? 'auto' : 'hidden';
    }

    // THE FIX: Force the body back to the top just in case the Chromium engine shoved it down
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}, 50);

// --- TRANSFORM MENU ---
const tfMenu = UIManager.createTransformMenu();

const performTransform = (text, type) => {
    const res = Utils.transformText(text, type);
    
    // THE FIX: By using restoreClip instead of writeClipboard, 
    // we explicitly tell the backend to push this brand-new string 
    // to the top of the history AND write it to the OS clipboard!
    window.smartClip.restoreClip({ text: res, type: 'text' });
    
    Utils.showMsg(type.toUpperCase() + " COPIED!");
    tfMenu.style.display = 'none';

    // Added the auto-close safety check here so it matches normal copies
    if (autoClose) {
        setTimeout(() => window.smartClip.hideWindow(), 250);
    }
};

const closeTfMenu = () => UIManager.closeTransformMenu(tfMenu);

// --- UNDO HELPER LOGIC ---
const showUndo = (item) => {
    lastDeleted = item;
    const undoTextEl = document.getElementById('undoText'); // Target the span
    if (undoTextEl) undoTextEl.textContent = "Item Deleted"; 
    
    if (undoToast) {
        undoToast.style.display = 'flex';
        setTimeout(() => undoToast.classList.add('show'), 10);
    }
    
    if(undoTimeout) clearTimeout(undoTimeout);
    
    // Only start the auto-hide timer if the user isn't currently hovering over the toast
    if (!isUndoHovered) {
        undoTimeout = setTimeout(() => {
            if(undoToast) {
                undoToast.classList.remove('show');
                setTimeout(() => undoToast.style.display = 'none', 300);
            }
            if (lastDeleted) {
                window.smartClip.deleteItem(lastDeleted.timestamp);
                lastDeleted = null;
            }
        }, 4000);
    }
};

// --- UNDO TOAST HOVER PAUSE ---
if (undoToast) {
    undoToast.onmouseenter = () => {
        isUndoHovered = true;
        // Stop the countdown while the mouse is over the toast
        if (undoTimeout) clearTimeout(undoTimeout); 
    };
    
    undoToast.onmouseleave = () => {
        isUndoHovered = false;
        // Restart the countdown when the mouse leaves (gives them 2 seconds before it fades)
        undoTimeout = setTimeout(() => {
            if (undoToast) {
                undoToast.classList.remove('show');
                setTimeout(() => undoToast.style.display = 'none', 300);
            }
            if (lastDeleted) {
                window.smartClip.deleteItem(lastDeleted.timestamp);
                lastDeleted = null;
            }
        }, 2000);
    };
}

// --- INITIALIZATION ---
if (!IS_PRO_BUILD) {
    if (dlBtn) dlBtn.style.display = 'none';
    if (toggleLogBtn) { toggleLogBtn.disabled = true; toggleLogBtn.style.opacity = "0.3"; toggleLogBtn.style.cursor = "default"; toggleLogBtn.title = "Available in Pro version"; }
    if (flushLogBtn) { flushLogBtn.disabled = true; flushLogBtn.style.opacity = "0.3"; flushLogBtn.style.cursor = "default"; }
} else {
    const licSection = document.getElementById('licenseSection');
    if (licSection) licSection.style.display = 'none';
}

const handleCopy = (item) => {
    // Execute the copy based on type
    if (item.type === 'image') {
        window.smartClip.writeImage(item.text);
    } else {
        window.smartClip.writeClipboard(item.text);
    }
    
    Utils.showMsg("COPIED!");

    // THE SAFETY CHECK: Ensure we aren't in multi-select mode
    if (autoClose && !isSelectionMode) { 
        setTimeout(() => {
            window.smartClip.hideWindow();
        }, 250); 
    }
};

window.addEventListener('resize', (e) => {
       requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Reset scroll to prevent DevTools from shoving the body up
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            updateWindowHeight(e);
        });
    });
});

const showConfirm = (text, action) => {
    if(modalMsg) modalMsg.textContent = text;
    currentConfirmAction = action;
    if(modal) modal.style.display = 'flex';
};

function renderLogs(logs) {
    const logContainer = document.getElementById('systemLog');
    if (!logContainer) return;
    logContainer.innerHTML = (logs && logs.length) ? '' : '<div class="log-entry">> TERMINAL READY</div>';
    if (logs) {
        logs.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'log-entry';
            div.style.cursor = 'pointer'; 
            div.title = "Click to restore to history"; 
            const ts = new Date(entry.ts).toLocaleTimeString();
            const display = entry.text.length > 30 ? entry.text.substring(0, 30) + "..." : entry.text;
            div.innerHTML = `<span style="color:var(--muted)">[${ts}]</span> ${display.replace(/</g, "&lt;")}`;
            div.onclick = () => { window.smartClip.restoreClip({text: entry.text, type: 'text'}); Utils.showMsg("RESTORED!"); };
            logContainer.appendChild(div);
        });
    }
}

const updateActionButtons = () => {
    const count = selectedItems.size;
    if (count > 0) {
        document.body.classList.add('selection-mode');
        isSelectionMode = true;
        dlBtn.textContent = `Export (${count})`;
        dlBtn.classList.add('active-selection');
        dlBtn.style.color = "var(--app-theme)";
        dlBtn.style.borderColor = "var(--app-theme)";
        
        clrBtn.textContent = `Delete (${count})`;
        clrBtn.classList.add('active-selection');
        clrBtn.style.color = "#ffffff"; 
        clrBtn.style.borderColor = "#ffffff";
    } else {
        document.body.classList.remove('selection-mode');
        isSelectionMode = false;
        
        dlBtn.textContent = "Export All";
        dlBtn.classList.remove('active-selection');
        dlBtn.style.color = ""; 
        dlBtn.style.borderColor = ""; 
        
        clrBtn.textContent = "Clear All";
        clrBtn.classList.remove('active-selection');
        clrBtn.style.color = ""; 
        clrBtn.style.borderColor = ""; 
    }
};

const renderList = (history) => {
    const list = document.getElementById('historyList');
    const clipHeader = document.querySelector('.clip-history-header'); 
    const historyBox = document.querySelector('.clip-history-box'); 
    if (!list) return; 
    list.innerHTML = '';
    
    const rawTerm = (searchInput && searchInput.value) ? searchInput.value : "";
    
    // 1. Pass the activeFilter to your manager (We will upgrade the manager next!)
    displayedHistory = HistoryManager.filterAndSort(history, rawTerm, activeFilter);
    
    // 2. THE NEW HEADER COUNT INJECTION
    if (historyBox) {
        const maxLimit = globalSettings.maxItems || (IS_PRO_BUILD ? 100 : 50);
        historyBox.style.display = 'flex';
        historyBox.style.justifyContent = 'space-between';
        historyBox.style.alignItems = 'baseline';
        historyBox.style.paddingRight = '40px'; // Clears the search button
        
        // Keeps the title Cyan, but makes the numbers gray/white
        historyBox.innerHTML = `
            <span>CLIP HISTORY</span>
            <span style="font-family: system-ui, -apple-system, sans-serif; font-weight: 600; font-size: 10px; color: var(--app-theme); opacity: 0.96; letter-spacing: 0.5px;">
               ITEMS: ${displayedHistory.length}/${maxLimit} 
            </span>
        `;
    }
    
    if (rawTerm.length > 0 && searchMeta && matchCount) {
        searchMeta.style.display = 'flex';
        matchCount.textContent = HistoryManager.getMatchStatus(displayedHistory.length);
    } else if (searchMeta) { 
        searchMeta.style.display = 'none'; 
    }

    // ALWAYS show the "CLIP HISTORY" title so the CMD button stays visible
    if (clipHeader) clipHeader.style.display = 'flex'; 

    if (!displayedHistory.length) { 
        list.innerHTML = `<div class="empty-wrap"><li class="empty-state">HISTORY CLEAR</li></div>`; 
        selectedIndex = -1;
        updateActionButtons();
        updateWindowHeight();
        return; 
    }

    selectedIndex = -1;
    updateActionButtons();

    displayedHistory.forEach((item, index) => {
        try {
            const li = document.createElement('li');
            li.className = `item ${item.favorite ? 'is-starred' : ''}`;
        li.dataset.index = index; 
        if (selectedItems.has(item.timestamp)) li.classList.add('selected-item');
            
            const ts = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let sizeStr = "", smartActionHTML = '';
            
            // If the user manually unmasked it, force this to false
            // renderer.js
const isSecret = HistoryManager.isSecret(item, globalSettings, IS_PRO_BUILD);

            if (item.type === 'image') {
    // If dimensions exist, show them. Otherwise fallback to "IMG" for older clips.
    sizeStr = item.dimensions ? `${item.dimensions} px` : "IMG";
    
    smartActionHTML = `<span class="smart-tag img-badge" title="Copy Image"><i class="fa-regular fa-image"></i> IMAGE</span>`;
    
    if (IS_PRO_BUILD) {
        const hoverTitle = item.ocrText ? `Text: ${item.ocrText.substring(0,50)}...` : "Extract Text";
        smartActionHTML += `<span class="smart-tag ocr-badge" style="border-color:var(--txt); color:var(--txt); margin-left:4px;" title="${hoverTitle}"><i class="fa-solid fa-file-lines"></i> TEXT</span>`;
    }
} else {
                sizeStr = Utils.formatBytes(item.text);
                if (item.isWeb) smartActionHTML += `<button class="smart-tag" onclick="window.smartClip.openExternal('${item.text}'); event.stopPropagation();"><i class="fa-solid fa-arrow-up-right-from-square"></i> OPEN</button>`;
                if (item.isColor) {
                    const contrast = Utils.getContrastYIQ(item.text);
                    smartActionHTML += `<div class="smart-tag" style="background:${item.text}; color:${contrast}; border:1px solid #fff;">${item.text}</div>`;
                }
            }

            const isChecked = selectedItems.has(item.timestamp) ? 'checked' : '';

            li.innerHTML = `
                <div class="item-header">
                    <div class="left-actions">
                        <input type="checkbox" class="select-checkbox" ${isChecked} title="Select Item">
                        ${item.type === 'text' ? `<button class="action-btn expand-btn" title="${isSecret ? 'Click to unmask' : 'Expand View'}"><i class="fa-solid fa-${isSecret ? 'lock' : 'chevron-down'}"></i></button>${IS_PRO_BUILD ? `<button class="action-btn magic-btn" title="Smart Transform"><i class="fa-solid fa-wand-magic-sparkles"></i></button>` : ''}` : `<i class="fa-solid fa-camera" style="font-size:10px; color:var(--muted)"></i>`}
                        <button class="action-btn star-btn ${item.favorite ? 'active' : ''}" title="${item.favorite ? 'Unfavorite' : 'Favorite'}"><i class="fa-${item.favorite ? 'solid' : 'regular'} fa-star"></i></button>
                        ${(item.type === 'text' && IS_PRO_BUILD && !isSecret) ? `<button class="action-btn edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>` : ''}
                    </div>
                    <div class="copy-instruction">${isSecret ? 'click to copy hidden text' : (item.type === 'image' ? 'click image or tags to copy' : 'click text to copy')}</div>
                    <div class="right-actions"><span style="font-size:0.55rem; color:var(--muted); opacity:0.7;">${sizeStr}</span></div>
                </div>
                <div class="content-wrapper">
                    ${item.type === 'image' ? `<img src="${(typeof item.text === 'string' && item.text.startsWith('data:')) ? item.text : 'scp://load/' + item.text}" class="clip-image" onerror="this.style.display='none'; this.parentNode.innerHTML='<div style=\\'padding:10px; color:#e74c3c; font-size:10px;\\'>[IMAGE DELETED]</div>';" />` : `<div class="text-content"></div>`}
                </div>
                <div class="item-footer">
                    <div style="display:flex; gap:10px; align-items:center;">
                        ${showTimes ? `<span style="font-size:0.55rem; color:var(--muted);">${ts}</span>` : ''}
                        <span class="clip-label click-only" style="font-size:0.55rem; color:var(--app-theme); cursor:pointer; font-weight:bold; opacity:0.6; transition: opacity 0.2s;" title="${item.label ? 'Edit Label' : 'Set Custom Label'}"><i class="fa-solid fa-tag"></i> ${item.label || 'Add Label'}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;">
                        ${smartActionHTML}
                        <button class="action-btn del-btn ${item.favorite ? 'disabled' : ''}" title="${item.favorite ? 'Unfavorite to Delete' : 'Delete'}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
            
            // --- LABEL LOGIC ---
            const labelBtn = li.querySelector('.clip-label');
            if (labelBtn) {
                labelBtn.onclick = (e) => {
    e.stopPropagation();
    if (!IS_PRO_BUILD) { Utils.showMsg("PRO FEATURE"); return; }
    
    // 1. Tell the parent wrapper (holds the time + label) to stretch across the footer
    const parentDiv = labelBtn.parentElement;
    parentDiv.style.flex = "1";
    
    // 2. Tell the label span to stretch within that parent
    labelBtn.style.flex = "1";
    labelBtn.style.display = "block"; 
    
    // 3. Make the input 100% width so it hits the trash can boundary
    labelBtn.innerHTML = `
        <input type="text" 
            value="${item.label || ''}" 
            placeholder="Type & hit Enter" 
            style="width: 97%; box-sizing: border-box; font-size: 0.55rem; background: var(--bg); border: 1px solid var(--app-theme); color: var(--app-theme); outline: none; border-radius: 2px; padding: 2px 4px; font-family: 'Segoe UI', sans-serif;">
    `;
    
    const input = labelBtn.querySelector('input');
    if (input) {
        input.onclick = (ev) => ev.stopPropagation();
        input.focus();
        input.select(); 
        
        const saveLabel = () => {
            const newLabel = input.value.trim();
            window.smartClip.setLabel({ timestamp: item.timestamp, label: newLabel });
            
            // Clean up styles so it doesn't break the layout when saved
            parentDiv.style.flex = "";
            labelBtn.style.flex = "";
            labelBtn.style.display = "";
        };
        
        input.onblur = saveLabel;
        input.onkeydown = (ev) => {
    ev.stopPropagation(); 
    if (ev.key === 'Enter') {
        input.onblur = null; 
        input.blur(); // THE FIX: Kill phantom focus
        window.getSelection().removeAllRanges();
        saveLabel();
    }
    if (ev.key === 'Escape') {
        input.onblur = null;
        input.blur(); // THE FIX: Kill phantom focus
        window.getSelection().removeAllRanges();
        renderList(fullHistory); 
    }
};
    }
};
            }

// CLEANED UP CLICK HANDLER:
const smartOcrBadge = li.querySelector('.ocr-badge');
if (smartOcrBadge) {
    smartOcrBadge.onclick = (e) => { 
        e.stopPropagation(); 
        smartOcrBadge.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        
        window.smartClip.invoke('perform-image-ocr', item.text)
            .then(result => {
                if (result && result.success) {
                    // Success feedback
                    Utils.showMsg("TEXT COPIED TO CLIPBOARD!");
                    smartOcrBadge.innerHTML = `<i class="fa-solid fa-check"></i> TEXT`;
                    smartOcrBadge.style.color = "#8CFA96"; // Turn mint green on success
                    
                    // Optional: If you want to automatically save this OCR text 
                    // into the SmartClip history list:
                    window.smartClip.restoreClip({ text: result.text, type: 'text' });
                } else {
                    smartOcrBadge.innerHTML = `<i class="fa-solid fa-file-lines"></i> TEXT`;
                    Utils.showMsg("NO TEXT FOUND");
                }
            })
            .catch(err => {
                console.error(err);
                smartOcrBadge.innerHTML = `<i class="fa-solid fa-file-lines"></i> TEXT`;
            });
    };
}

const smartImgBadge = li.querySelector('.img-badge');
if (smartImgBadge) {
    smartImgBadge.onclick = (e) => { 
        e.stopPropagation(); 
        e.preventDefault(); // Stop any ghost browser behaviors
        handleCopy(item); 
    };
}
            
            const checkBox = li.querySelector('.select-checkbox');
            if (checkBox) {
                checkBox.onclick = (e) => {
                    e.stopPropagation();
                    if (checkBox.checked) {
                        selectedItems.add(item.timestamp);
                        li.classList.add('selected-item'); 
                        li.classList.remove('selected'); 
                    } else {
                        selectedItems.delete(item.timestamp);
                        li.classList.remove('selected-item');
                        li.classList.remove('selected');
                    }
                    updateActionButtons();
                };
            }
            
            const contentWrapper = li.querySelector('.content-wrapper');
            if (contentWrapper) {
                if (item.type === 'text') {
    // FIXED: changed 'term' to 'rawTerm'
    const rawSnippet = PrivacyEngine.getSmartSnippet(item.text, rawTerm, isSecret); 
    const snippetHTML = isSecret ? rawSnippet : PrivacyEngine.formatText(rawSnippet, rawTerm, false);
    const fullHTML = isSecret ? rawSnippet : PrivacyEngine.formatText(item.text, rawTerm, false);
                    
                    const textDiv = li.querySelector('.text-content');
                    textDiv.innerHTML = snippetHTML;
                    
                    const expandBtn = li.querySelector('.expand-btn');
                    if (expandBtn) {
                         expandBtn.onclick = (e) => { 
                             e.stopPropagation(); 
                             if (li.classList.contains('editing')) return; 
                             
                             // THE NEW LOGIC: If it's a secret, clicking unlocks it permanently.
                             if (isSecret) {
                                 window.smartClip.unmaskItem(item.timestamp);
                                 return;
                             }
                             
                             // THE OLD LOGIC: If it's normal text, clicking expands it.
                             li.classList.toggle('expanded'); 
                             expandBtn.classList.toggle('active'); 
                             textDiv.innerHTML = li.classList.contains('expanded') ? fullHTML : snippetHTML; 
                             updateWindowHeight(); 
                        };
                    }

                    // --- ANIMATED MAGIC BUTTON LOGIC ---
                    const magicBtn = li.querySelector('.magic-btn');
                    if (magicBtn) {
                        magicBtn.onclick = (e) => {
    e.stopPropagation(); 
    if (tfMenu.style.display === 'flex' && tfMenu.dataset.activeId === String(item.timestamp)) {
        closeTfMenu(); 
        return; 
    }
    
    tfMenu.dataset.activeId = String(item.timestamp); 
    tfMenu.innerHTML = ''; 
    const transforms = [ 
        { label: 'UPPER', type: 'upper' }, 
        { label: 'lower', type: 'lower' }, 
        { label: 'Sentence', type: 'sentence' }, 
        { label: '-slugify-', type: 'slugify' }, 
        { label: 'camelCase', type: 'camel' }, 
        { label: 'Clean URL', type: 'clean' } 
    ];

    transforms.forEach((t, index) => {
        if (index > 0) {
    const divider = document.createElement('div');
    // Added a permanent layered box-shadow to create a glowing core with a soft halo
    divider.style.cssText = `
        width: 4px; 
        height: 4px; 
        background-color: #8CFA96; 
        margin: auto 1px; 
        border-radius: 1px;
        box-shadow: 0 0 4px #8CFA96, 0 0 8px rgba(140, 250, 150, 0.5);
    `;
    tfMenu.appendChild(divider);
}
        // --- UPDATED TRANSFORM BUTTON STYLE ---
const btn = document.createElement('button');
// Changed font-size to 12px and added 10px horizontal padding
btn.style.cssText = `
    background: transparent; 
    border: 1px solid transparent; 
    color:var(----txt); 
    padding: 4px 10px; 
    font-size: 12px; 
    cursor: pointer;
    font-weight: 600;
`;
        btn.textContent = t.label;
        
        // --- DYNAMIC HOVER GLOW ---
btn.onmouseenter = () => {
    btn.style.color = 'var(--app-theme)';
    btn.style.textShadow = '0 0 8px var(--app-theme)';
};
btn.onmouseleave = () => {
    btn.style.color = 'var(--txt)';
    btn.style.textShadow = 'none';
};

// Use the internal performTransform function
btn.onclick = (ev) => { 
    ev.stopPropagation(); 
    performTransform(item.text, t.type); 
    closeTfMenu(); 
};
tfMenu.appendChild(btn);
    });

    const rect = magicBtn.getBoundingClientRect();
    tfMenu.style.top = `${rect.bottom + 8}px`;
    tfMenu.classList.remove('tf-menu-close'); 
    tfMenu.classList.add('tf-menu-open'); 
    tfMenu.style.display = 'flex';
    // Perfectly center it based on the exact app window width
    tfMenu.style.left = `${((window.innerWidth - tfMenu.offsetWidth) / 2) - 0}px`;
};
                    }
                    
                   const editBtn = li.querySelector('.edit-btn');
                    if (editBtn) {
                        editBtn.onclick = (e) => {
                            e.stopPropagation(); 
                            if (li.classList.contains('editing')) return; 
                            
                            // Transform into seamless editing mode
                            li.classList.add('editing');
                            li.classList.add('expanded');
                            
                            const expandBtn = li.querySelector('.expand-btn');
                            if (expandBtn) expandBtn.classList.add('active');

                            textDiv.innerHTML = `<textarea class="edit-textarea" spellcheck="false"></textarea><div class="edit-actions-group"><button class="edit-btn-cancel">Cancel</button><button class="edit-btn-save">Save</button></div>`;
                            const ta = textDiv.querySelector('textarea');
                            ta.value = item.text; 
                            
                            // THE FIX: Smart Auto-Resize
                            let lastScrollHeight = 0;
                            const resizeTa = () => {
                                ta.style.height = 'auto';
                                const newHeight = ta.scrollHeight;
                                ta.style.height = newHeight + 'px';
                                
                                // ONLY ping the OS to resize if the text block actually grew/shrank
                                // This stops the rapid-fire IPC spam that kills the drag handler
                                if (newHeight !== lastScrollHeight) {
                                    lastScrollHeight = newHeight;
                                    updateWindowHeight();
                                }
                            };
                            
                            ta.addEventListener('input', resizeTa);
                            setTimeout(() => { resizeTa(); ta.focus(); }, 10);
                            
                            ta.onclick = ev => ev.stopPropagation();
                            ta.oncontextmenu = ev => ev.stopPropagation(); 
                            
                            const saveBtn = textDiv.querySelector('.edit-btn-save');
                            const cancelBtn = textDiv.querySelector('.edit-btn-cancel');

                            saveBtn.onclick = (ev) => {
    ev.stopPropagation();
    ta.blur(); // THE FIX: Kill phantom focus
    window.getSelection().removeAllRanges();
    const val = ta.value;
    if (val !== item.text) window.smartClip.editItem({ timestamp: item.timestamp, newText: val });
    else exitEditMode();
};
cancelBtn.onclick = (ev) => { 
    ev.stopPropagation(); 
    ta.blur(); // THE FIX: Kill phantom focus
    window.getSelection().removeAllRanges();
    exitEditMode(); 
};
                            
                            function exitEditMode() { 
                                if (ctxMenu) ctxMenu.style.display = 'none'; 
                                li.classList.remove('editing'); 
                                if (typeof renderList === 'function') renderList(fullHistory); 
                            }
                        };
                    }
                } else { const img = li.querySelector('.clip-image'); if(img) img.onload = () => updateWindowHeight(); }
                contentWrapper.onclick = (e) => { 
                    e.stopPropagation(); 
                    const selection = window.getSelection().toString();
                    if (selection.length > 0 || li.classList.contains('editing')) return;
                    handleCopy(item); 
                };
            }
            
            const starBtn = li.querySelector('.star-btn');
            if (starBtn) starBtn.onclick = (e) => { e.stopPropagation(); window.smartClip.toggleFavorite(item.timestamp); };
            
            // --- OPTIMISTIC DELETE ---
            const delBtn = li.querySelector('.del-btn');
if (delBtn) delBtn.onclick = (e) => { 
    e.stopPropagation(); 
    if (item.favorite) { Utils.showMsg("LOCKED!"); return; } 

    // 1. Tell the backend to delete it RIGHT NOW so it won't reappear on refresh
    window.smartClip.deleteItem(item.timestamp);

    // 2. Remove it visually
    fullHistory = fullHistory.filter(h => h.timestamp !== item.timestamp);
    renderList(fullHistory);

    // 3. Update the toast to be a "Restore" option rather than an "Undo delete"
    lastDeleted = item; 
    showUndo(item); // Note: Update your Undo button to call 'restoreClip' instead
};

            li.oncontextmenu = (e) => { 
                if (li.classList.contains('editing')) return; 
                
                e.preventDefault(); 
                e.stopPropagation(); 
                
                // If the menu is already open ON THIS EXACT SNIPPET, turn it off.
                if (ctxMenu && ctxMenu.style.display === 'block' && ctxTargetId === item.timestamp) {
                    ctxMenu.style.display = 'none';
                    ctxTargetId = null;
                    return;
                }

                // Otherwise, prep it for display
                ctxTargetId = item.timestamp; 
                if(ctxMenu) { 
                    // Briefly display it so the browser calculates its height/width
                    ctxMenu.style.display = 'block'; 
                    
                    let topPos = e.clientY;
                    let leftPos = e.clientX;
                    
                    // --- THE BOUNDARY CHECKS ---
                    // If it hits the bottom, push it up
                    if (topPos + ctxMenu.offsetHeight > window.innerHeight) {
                        topPos = window.innerHeight - ctxMenu.offsetHeight - 5;
                    }
                    
                    // If it hits the right edge, push it left
                    if (leftPos + ctxMenu.offsetWidth > window.innerWidth) {
                        leftPos = window.innerWidth - ctxMenu.offsetWidth - 5;
                    }

                    // Apply the safe coordinates
                    ctxMenu.style.top = `${topPos}px`; 
                    ctxMenu.style.left = `${leftPos}px`; 
                }
            };
            list.appendChild(li);
        } catch (err) { console.error("Render Error:", err); }
    });
    updateWindowHeight();
};

const updateSelection = (index, scroll = true) => {
    const items = list.querySelectorAll('.item');
    if (items.length === 0) return;
    if (index < 0) index = 0;
    if (index >= items.length) index = items.length - 1;
    selectedIndex = index;
    items.forEach(el => el.classList.remove('selected'));
    const target = items[selectedIndex];
    if (target) { target.classList.add('selected'); if (scroll) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
};

document.addEventListener('keydown', (e) => {
    if ((modal && modal.style.display === 'flex') || (helpModal && helpModal.style.display === 'flex') || (confirmModal && confirmModal.classList.contains('show'))) return;
    if (document.activeElement.tagName === 'TEXTAREA') return;
    if ((e.key === 's' || e.key === 'S') && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT') { 
        e.preventDefault(); 
        settingsPanel.style.display = 'block'; 
        document.body.classList.add('settings-active'); // <-- THE MISSING CLASS
        updateWindowHeight(); 
        if(searchInput) searchInput.focus(); 
        return; 
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); updateSelection(selectedIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); updateSelection(selectedIndex - 1); }
    else if (e.key === 'Enter') { if (document.activeElement === searchInput) { e.preventDefault(); if (e.shiftKey) updateSelection(selectedIndex - 1); else updateSelection(selectedIndex + 1); } else if (selectedIndex >= 0 && displayedHistory[selectedIndex]) handleCopy(displayedHistory[selectedIndex]); }
});

document.addEventListener('click', () => { 
    if (ctxMenu) ctxMenu.style.display = 'none'; 
    closeTfMenu(); 
});

document.addEventListener('contextmenu', (e) => { 
    // If you right-click anywhere that isn't a snippet, close the menu
    if (ctxMenu && !e.target.closest('.item')) {
        ctxMenu.style.display = 'none'; 
    }
});

window.smartClip.loadData();
window.smartClip.onRefreshData((history) => { fullHistory = history; renderList(history); });
window.smartClip.onPauseStatus((isPaused) => {
    const header = document.querySelector('.header');
    
    if (isPaused) { 
        pauseBtn.classList.add('active'); 
        // CLEAR EVERYTHING inside and add ONLY the play icon
        pauseBtn.innerHTML = ''; 
        const playIcon = document.createElement('i');
        playIcon.className = 'fa-solid fa-play';
        pauseBtn.appendChild(playIcon);
        
        pauseBtn.title = "Resume Capture"; 
        header.classList.add('paused'); 
    } else { 
        pauseBtn.classList.remove('active'); 
        // Restore the default Pause mask
        pauseBtn.innerHTML = '<span class="ctrl-icon"></span>'; 
        pauseBtn.title = "Pause Capture"; 
        header.classList.remove('paused'); 
    }
});

window.smartClip.onUpdateLogs((logs) => renderLogs(logs));
window.smartClip.onRefreshSettings((settings) => {
    globalSettings = settings;
    const titleEl = document.querySelector('.brand-title');
   if (titleEl) {
    titleEl.innerHTML = `
        <span style="position: relative; display: inline-block;">
            Smart<span style="color:white">Clip</span>
            <span class="edition-label ${IS_PRO_BUILD ? 'pro' : 'core'}" style="position: absolute; left: 100%; top: 0; margin-left: 4px;">${IS_PRO_BUILD ? 'PRO' : 'CORE'}</span>
        </span>
    `;

    if (ignoreColorsToggle) ignoreColorsToggle.checked = settings.ignoreColors === true;
        if (moveDupesToggle) moveDupesToggle.checked = settings.moveDuplicates === true;
        
        if (privacySelect) {
            const val = settings.privacyLevel || 'MED';
            privacySelect.value = val;
            
            const statusMsg = document.getElementById('sensitivityStatus');
            const jokeTarget = document.getElementById('jokeEnding');

            if (val === 'HIGH' && statusMsg && jokeTarget) {
                jokeTarget.textContent = tinFoilJokes[Math.floor(Math.random() * tinFoilJokes.length)];
                statusMsg.style.display = 'block';
            } else if (statusMsg) {
                statusMsg.style.display = 'none';
            }
        }
    }
    
if (maxInput) {
        maxInput.disabled = false;
        maxInput.removeAttribute('title');
        maxInput.removeAttribute('readonly'); 
        
        const spinBtns = document.querySelector('.spin-btns');
        if (spinBtns) spinBtns.style.display = 'flex'; 

        let currentMax = parseInt(settings.maxItems);
        if (isNaN(currentMax)) currentMax = IS_PRO_BUILD ? 100 : 50;

        // Apply Native Zoom on Boot
        if (uiScaleSelect) {
            uiScaleSelect.value = settings.uiScale || "1";
            if (window.smartClip.setZoom) {
                window.smartClip.setZoom(parseFloat(settings.uiScale || 1));
            }
        }
        
        // Strip any accidental CSS zoom that might be lingering
        document.body.style.zoom = '';
        
        if (!IS_PRO_BUILD && currentMax > 50) currentMax = 50;
        maxInput.value = currentMax;
    }

    timeToggle.checked = settings.showTimes !== false; 
    notifyToggle.checked = settings.notificationsEnabled !== false; 
    autoCloseToggle.checked = settings.autoClose === true; 
    if(alwaysOnTopToggle) alwaysOnTopToggle.checked = settings.alwaysOnTop === true;
    if(optimizeToggle) optimizeToggle.checked = settings.optimizeImages !== false;
    
    showTimes = settings.showTimes !== false; 
    autoClose = settings.autoClose === true; 
    
    if(settings.logs) renderLogs(settings.logs); 
    renderList(fullHistory); 
});
window.smartClip.onStartupStatus((isEnabled) => { if (startupToggle) startupToggle.checked = isEnabled; });

if(modalCancel) modalCancel.onclick = () => { modal.style.display = 'none'; currentConfirmAction = null; };
if(modalYes) modalYes.onclick = () => { if (typeof currentConfirmAction === 'function') currentConfirmAction(); modal.style.display = 'none'; currentConfirmAction = null; };


// --- UNDO BUTTON LOGIC ---
if (undoBtn) {
    undoBtn.onclick = () => { 
        if (lastDeleted) { 
            // Re-inject the item into the database
            window.smartClip.restoreClip(lastDeleted);
            lastDeleted = null; 
            
            if(undoToast) {
                undoToast.classList.remove('show'); 
                setTimeout(() => undoToast.style.display = 'none', 300);
            }
        } 
    };
}

if (uiScaleSelect) {
    uiScaleSelect.onchange = () => {
        const scale = parseFloat(uiScaleSelect.value);
        window.smartClip.updateSettings({ uiScale: scale });
        
        // HEXSTACK LOGIC: Pure native zoom
        if (window.smartClip.setZoom) {
            window.smartClip.setZoom(scale);
        }
        
        // HEXSTACK LOGIC: 150ms delay prevents the window from stuttering
        setTimeout(() => updateWindowHeight(), 150); 
    };
}

if(searchUpBtn) searchUpBtn.onclick = () => updateSelection(selectedIndex - 1);
if(searchDownBtn) searchDownBtn.onclick = () => updateSelection(selectedIndex + 1);
if(document.getElementById('ctx-copy')) {
    document.getElementById('ctx-copy').onclick = () => { const item = fullHistory.find(h => h.timestamp === ctxTargetId); if (item) handleCopy(item); };
    document.getElementById('ctx-edit').onclick = () => Utils.showMsg("Use Pencil Icon");
    document.getElementById('ctx-pin').onclick = () => { if (ctxTargetId) window.smartClip.toggleFavorite(ctxTargetId); };
    
    // THE NEW LISTENER
    document.getElementById('ctx-mask').onclick = () => { 
        if (ctxTargetId) window.smartClip.maskItem(ctxTargetId); 
        if (ctxMenu) ctxMenu.style.display = 'none'; // Close the menu
    };
    
    document.getElementById('ctx-del').onclick = () => { if (ctxTargetId) window.smartClip.deleteItem(ctxTargetId); };
}
if(pauseBtn) pauseBtn.onclick = () => window.smartClip.togglePause();

document.getElementById('toggleLog').onclick = () => { const l = document.getElementById('systemLog'); l.style.display = (l.style.display === 'block') ? 'none' : 'block'; setTimeout(updateWindowHeight, 50); };
if(flushLogBtn) flushLogBtn.onclick = () => window.smartClip.flushLogs();
document.getElementById('spinUp').onclick = () => { 
    const absoluteMax = IS_PRO_BUILD ? 500 : 50; 
    // Fallback to 50 prevents the math from returning NaN if the box is somehow empty
    let currentVal = parseInt(maxInput.value) || 50; 
    maxInput.value = Math.min(absoluteMax, currentVal + 5); 
    window.smartClip.updateSettings({ maxItems: parseInt(maxInput.value) }); 
};

document.getElementById('spinDown').onclick = () => { 
    let currentVal = parseInt(maxInput.value) || 50;
    maxInput.value = Math.max(5, currentVal - 5); 
    window.smartClip.updateSettings({ maxItems: parseInt(maxInput.value) }); 
};

if(maxInput) {
    maxInput.onchange = () => {
        let val = parseInt(maxInput.value); 
        // Fallback if they delete everything or type letters
        if (isNaN(val)) val = 50; 

        const absoluteMax = IS_PRO_BUILD ? 500 : 50;
        
        if (val > absoluteMax) val = absoluteMax;
        if (val < 5) val = 5;
        
        maxInput.value = val;
        window.smartClip.updateSettings({ maxItems: val }); 
    };
}
if(notifyToggle) notifyToggle.onchange = () => window.smartClip.updateSettings({ notificationsEnabled: notifyToggle.checked });
if(timeToggle) timeToggle.onchange = () => window.smartClip.updateSettings({ showTimes: timeToggle.checked });
if(autoCloseToggle) autoCloseToggle.onchange = () => window.smartClip.updateSettings({ autoClose: autoCloseToggle.checked });
if(alwaysOnTopToggle) alwaysOnTopToggle.onchange = () => window.smartClip.updateSettings({ alwaysOnTop: alwaysOnTopToggle.checked });
// Locate your existing startupToggle listener or add this:
if (startupToggle) {
    startupToggle.onchange = () => {
        const isEnabled = startupToggle.checked;
        window.smartClip.toggleStartup(isEnabled);
        Utils.showSystemToast(isEnabled ? "Will launch at startup" : "Startup launch disabled");
    };
}
if (searchInput) {
    const clearSearchBtn = document.getElementById('clearSearch');

    searchInput.addEventListener('input', () => {
        // Show/Hide the X based on text presence
        if (clearSearchBtn) {
            clearSearchBtn.style.display = searchInput.value.length > 0 ? 'block' : 'none';
        }
        renderList(fullHistory);
    });

    if (clearSearchBtn) {
        clearSearchBtn.onclick = () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            renderList(fullHistory);
            searchInput.focus();
        };
    }
}
const settingsBtn = document.getElementById('settingsBtn');
const guideLauncher = document.getElementById('guideLauncher');
const closeHelpBtn = document.getElementById('closeHelpBtn');

// --- 1. GEAR BUTTON: OPENS SETTINGS MODAL DIRECTLY ---
if (settingsBtn) {
    settingsBtn.onclick = () => { 
        if (helpModal) {
            helpModal.style.display = 'flex';             
            UIManager.initSettingsTabs(helpModal);
            updateWindowHeight(); 
        }
    };
}

// --- 2. NEW TERMINAL BUTTON: OPENS THE DROPDOWN PANEL ---
const consoleBtn = document.getElementById('consoleBtn');
const toggleConsolePanel = () => {
    const isHidden = settingsPanel.style.display === 'none' || settingsPanel.style.display === '';
    settingsPanel.style.display = isHidden ? 'block' : 'none';
    
    if (isHidden) {
        document.body.classList.add('settings-active');
        setTimeout(() => { if (searchInput) searchInput.focus(); }, 50);
    } else {
        document.body.classList.remove('settings-active');
    }
    updateWindowHeight();
};
if (consoleBtn) consoleBtn.onclick = toggleConsolePanel;

if (closeHelpBtn) {
    closeHelpBtn.onclick = () => { 
        if (helpModal) helpModal.style.display = 'none'; 
        updateWindowHeight(); 
    };
}

const ttToggle = document.getElementById('guideTooltipToggle');
if(ttToggle) {
    ttToggle.checked = globalSettings.tooltipsEnabled !== false; 
    ttToggle.onchange = () => { 
        window.smartClip.updateSettings({ tooltipsEnabled: ttToggle.checked }); 
        globalSettings.tooltipsEnabled = ttToggle.checked; 
    };
}
if(dlBtn && IS_PRO_BUILD) dlBtn.onclick = () => { 
    if (selectedItems.size > 0) window.smartClip.downloadHistory(Array.from(selectedItems)); 
    else window.smartClip.downloadHistory([]); 
};

if (clrBtn) {
    clrBtn.onclick = () => {
        if (selectedItems.size > 0) {
            const count = selectedItems.size;
            showConfirm(`DELETE ${count} ITEMS?`, () => {
                window.smartClip.deleteItems(Array.from(selectedItems));
                selectedItems.clear(); 
            });
        } else {
            confirmModal.classList.add('show');
        }
    };
}

if (confirmYes) { confirmYes.onclick = () => { window.smartClip.clearHistory(); confirmModal.classList.remove('show'); }; }
if (confirmNo) { confirmNo.onclick = () => { confirmModal.classList.remove('show'); }; }

// ==========================================================
// --- LICENSE ACTIVATION LOGIC (SMARTCLIP) ---
// ==========================================================

if (window.smartClip && window.smartClip.onLicenseResponse) {
    // We only need ONE listener for this!
    window.smartClip.onLicenseResponse((response) => {
        if (response.success) {
            // 1. The glorious success toast
            Utils.showMsg("PRO ACTIVATED! RESTARTING...");
            
            // 2. Update the button if it exists
            if(btnActivate) {
                btnActivate.textContent = "SUCCESS";
                btnActivate.style.borderColor = "#8CFA96";
                btnActivate.style.color = "#8CFA96";
            }

            // 3. Add the Neon Flash to the main container
            const contentArea = document.querySelector('.content') || document.body;
            if (contentArea) {
                contentArea.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
                contentArea.style.border = '1px solid #8CFA96';
                contentArea.style.boxShadow = '0 0 50px rgba(140, 250, 150, 0.8), inset 0 0 30px rgba(140, 250, 150, 0.5)';
            }

        } else {
            // The rejection toast
            Utils.showMsg("ERROR: " + (response.reason || "Invalid Key"));
            if (btnActivate) {
                btnActivate.textContent = "UNLOCK";
                btnActivate.style.opacity = "1";
            }
        }
    });
}

// ==========================================
// --- DEVELOPER OVERRIDE WIRING ---
// ==========================================

// 1. Event Delegation: Listens on the document so it survives DOM re-renders 
// (Works perfectly even if Templates.js destroys and recreates the HTML)
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'devCoreToggle') {
        const shouldBeCore = e.target.checked;
        window.smartClip.devModeToggle(shouldBeCore);
    }
});

// 2. Visual Sync: Ensures the toggle matches the actual backend state when the modal opens
const syncDevToggle = () => {
    // We only bother syncing if we are actually in the dev environment
    if (!IS_DEV) return; 
    
    requestAnimationFrame(() => {
        const devCoreToggle = document.getElementById('devCoreToggle');
        if (devCoreToggle) {
            const isActuallyPro = window.smartClip.getIsProSync();
            devCoreToggle.checked = !isActuallyPro; 
        }
    });
};

// 3. Bind the sync to the buttons that open your settings/help modals
if (settingsBtn) settingsBtn.addEventListener('click', syncDevToggle);
const consoleBtnEl = document.getElementById('consoleBtn');
if (consoleBtnEl) consoleBtnEl.addEventListener('click', syncDevToggle);

// --- UPDATED SETTINGS BUTTONS (SMARTCLIP) ---
const btnCheckUpd = document.getElementById('btnCheckUpdates') || document.getElementById('btn-check-updates');
if (btnCheckUpd) {
    btnCheckUpd.onclick = (e) => {
        e.preventDefault();
        // Uses the build config already defined at the top of this script
        if (IS_PRO_BUILD) {
            window.smartClip.openExternal('https://app.lemonsqueezy.com/my-orders/');
        } else {
            window.smartClip.openExternal('https://github.com/Mint-Logic/SmartClip/releases');
        }
    };
}

const btnGetPro = document.getElementById('btnUpgradePro');
if (btnGetPro) {
    btnGetPro.onclick = () => {
        const checkoutUrl = "https://mintlogic.lemonsqueezy.com/checkout/buy/60d0f8ab-c5c2-4ed7-a5bd-9d8250ea8867";
        window.smartClip.openExternal(checkoutUrl);
    };
}

// --- MANUAL WINDOW RESIZING FOR TRANSPARENT FRAMELESS ---
const resizeHandle = document.querySelector('.resize-handle');
if (resizeHandle) resizeHandle.style.display = 'none';

// ==========================================================
// --- MANUAL KEY ENTRY (ADMIN BYPASS) ---
// ==========================================================
window.addEventListener('keydown', (e) => {
    // Press Ctrl + Shift + L to trigger manual license activation
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        const keyJson = prompt("Paste the content of your SmartClip .mint file here:");
        if (keyJson) {
            try {
                JSON.parse(keyJson); // Quick validate
                if (window.smartClip && window.smartClip.send) {
                    window.smartClip.send('validate-license-string', keyJson);
                } else if (window.electronAPI && window.electronAPI.send) {
                    window.electronAPI.send('validate-license-string', keyJson);
                }
            } catch (err) {
                Utils.showMsg("INVALID JSON FORMAT");
            }
        }
    }
});

// --- ESC TO CLOSE / CLEAR SEARCH ---
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const searchInput = document.getElementById('searchInput');
        const clearBtn = document.getElementById('clearSearch');
        
        // 1. If you are typing a search, Esc clears the search first
        if (searchInput && searchInput.value.length > 0) {
            searchInput.value = '';
            if (clearBtn) clearBtn.style.display = 'none';
            searchInput.blur(); // Remove focus
            if (typeof renderList === 'function' && typeof fullHistory !== 'undefined') {
                renderList(fullHistory); // Reset the list
            }
            return;
        }

        // 2. Otherwise, hide the app to the tray using the correct Preload method
        if (window.smartClip && window.smartClip.hideWindow) {
            window.smartClip.hideWindow();
        }
    }
});

document.getElementById('closeBtn').onclick = () => window.smartClip.hideWindow();
document.getElementById('minimizeBtn').onclick = () => window.smartClip.minimizeWindow();

// --- KICKOFF UI MANAGER ---
UIManager.initTooltips(() => globalSettings);

const dropzone = document.getElementById('dropzone-overlay');
UIManager.initDragAndDropUI(dropzone, async (file) => {
    if (file.name.endsWith('.mint')) {
        try {
            const fileContent = await file.text(); 
            window.smartClip.validateLicense(fileContent);
        } catch (err) {
            console.error("OS blocked file read:", err);
            Utils.showMsg("ERROR: OS BLOCKED FILE");
        }
    }
});

// --- QUICK FILTER LOGIC ---
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = (e) => {
        // 1. Remove active class from all buttons
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        
        // 2. Add active class to the clicked button
        btn.classList.add('active');
        
        // 3. Update the state and refresh the list
        activeFilter = btn.getAttribute('data-filter');
        renderList(fullHistory);
    };
});

// --- NEW: SMARTCLIP AUTOMATION LISTENERS ---

if (privacySelect) {
    privacySelect.onchange = () => {
        const val = privacySelect.value;
        window.smartClip.updateSettings({ privacyLevel: val });
        globalSettings.privacyLevel = val;

        const statusMsg = document.getElementById('sensitivityStatus');
        const jokeTarget = document.getElementById('jokeEnding');

        if (val === 'HIGH' && statusMsg && jokeTarget) {
            jokeTarget.textContent = tinFoilJokes[Math.floor(Math.random() * tinFoilJokes.length)];
            statusMsg.style.display = 'block';
        } else if (statusMsg) {
            statusMsg.style.display = 'none';
        }
        
        renderList(fullHistory);
    };
}

if (ignoreColorsToggle) {
    ignoreColorsToggle.onchange = () => {
        window.smartClip.updateSettings({ ignoreColors: ignoreColorsToggle.checked });
        globalSettings.ignoreColors = ignoreColorsToggle.checked;
    };
}

if (moveDupesToggle) {
    moveDupesToggle.onchange = () => {
        window.smartClip.updateSettings({ moveDuplicates: moveDupesToggle.checked });
        globalSettings.moveDuplicates = moveDupesToggle.checked;
    };
}

// ==========================================================
// --- GLOBAL SCOPE BRIDGE (FOR HTML ATTRIBUTES) ---
// ==========================================================
window.performTransform = performTransform;
window.handleCopy = handleCopy;
window.updateSelection = updateSelection;
window.renderList = renderList;
window.showConfirm = showConfirm;
window.updateWindowHeight = updateWindowHeight;

// Expose variables needed for inline HTML logic
window.IS_PRO_BUILD = IS_PRO_BUILD;
window.IS_DEV = IS_DEV;