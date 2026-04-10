// Templates.js

export const Templates = {
    getAboutHtml: function(isPro, isDev) {
        return `
<div class="guide-content">
    <div class="guide-header">
        <h2><i class="fa-solid fa-clipboard-list"></i> SmartClip Settings</h2>
        
        <button id="closeHelpBtn" style="background: transparent; border: 1px solid var(--brdr); color: var(--muted); cursor: pointer; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 4px; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); margin: 0;">
            Close
        </button>
    </div>
    <div class="settings-body">
        <div class="settings-sidebar">
            <div class="sidebar-section">Configuration</div>
            <button class="tab-btn active" data-tab="tab-about"><i class="fa-solid fa-circle-info"></i> About</button>
            <button class="tab-btn" data-tab="tab-prefs"><i class="fa-solid fa-sliders"></i> Preferences</button>
            <div class="sidebar-section">User Guide</div>
            <button class="tab-btn" data-tab="guide-workflow"><i class="fa-solid fa-bolt"></i> Workflow</button>
            ${isPro ? `<button class="tab-btn" data-tab="guide-pro"><i class="fa-solid fa-wand-magic-sparkles"></i> Pro Tools</button>` : ''}
            <button class="tab-btn" data-tab="guide-hotkeys"><i class="fa-solid fa-keyboard"></i> Shortcuts</button>
        </div>
        <div class="settings-main">
            <div id="tab-about" class="tab-pane active">
                <div style="text-align: center; padding: 0px 0 10px 0;">
                    <img src="icon.png" style="width: 60px; height: 60px; margin-top: 0px; margin-bottom: 0px;">
                   <div style="font-family:'Orbitron', sans-serif; font-size: 20px; font-weight: 900; color: #fff;">
    <span style="position: relative; display: inline-block;">
        <span style="color:var(--app-theme)">Smart</span>Clip
        <span class="edition-label ${isPro ? 'pro' : 'core'}" style="font-size:9px; position: absolute; left: 100%; top: 0; margin-left: 4px;">${isPro ? 'PRO' : 'CORE'}</span>
    </span>
</div>
                    <div style="font-size: 11px; color: #777; margin-top: 0px;">Version 1.0.0</div>
                    ${!isPro ? `
<div style="font-size: 11px; color: var(--app-theme); border: 1px dashed var(--app-theme); padding: 6px 15px; border-radius: 4px; opacity: 0.8; text-align: center; margin: 8px auto 10px auto; max-width: 300px;">
    <i class="fa-solid fa-file-import"></i> Drag & Drop your <b>.mint</b> file to unlock Pro
</div>
` : ''}
                    <div style="margin-top: 8px; display:flex; gap:10px; justify-content:center; align-items: center;">
                        <button id="btnCheckUpdates" style="height: 24px; display: flex; align-items: center; justify-content: center; gap: 5px; background:transparent; border:1px solid var(--app-theme); color:var(--app-theme); padding:0 12px; border-radius:4px; cursor:pointer; font-size:11px; transition: 0.2s;"><i class="fa-solid fa-rotate"></i> Updates</button>
                        ${!isPro ? `                
                        <button id="btnUpgradePro" style="height: 24px; display: flex; align-items: center; justify-content: center; gap: 5px; background:#8CFA96; border:none; color:#1e1e1e; font-weight:bold; padding:0 12px; border-radius:4px; cursor:pointer; font-size:11px; transition: 0.2s;"><i class="fa-solid fa-rocket"></i> Get Key</button>` : ''}
                    </div>
                    <p style="color:#ccc; font-size:12px; max-width:425px; margin: 15px auto 5px auto; line-height: 1.5;">SmartClip is a high-performance clipboard manager. Capture text, links, and snippets seamlessly, organize them instantly, and paste without breaking your workflow.</p>
                </div>
                <div class="setting-group" style="border-top: 1px solid #333; padding-top: 0px; padding-bottom: 0px; margin-top: 8px; margin-bottom: 10px;">
                    <div class="g-item" style="grid-column: 1 / -1;">
                        <strong style="color: var(--app-theme);"><i class="fa-solid fa-shield-halved"></i> Zero-Telemetry Policy</strong>
                        Zero-Telemetry Policy. SmartClip operates strictly offline. We do not track usage or collect analytics. The only time SmartClip connects to the internet is a single, one-time ping during Pro activation to verify your license. Your clipboard data and snippets never leave your local hardware.
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 8px; padding-bottom: 15px;">
                    <img src="mint_logic.png" alt="Mint Logic LLC" style="width: 120px; height: auto;">
                    <div style="margin-top: 8px; font-size: 10px; color: #666; letter-spacing: 0.5px;">&copy; 2026 Mint Logic. All rights reserved.</div>
                </div>
            </div>
            <div id="tab-prefs" class="tab-pane">
            ${isDev ? `
                <div class="setting-group" style="border: 1px dashed #FF007F; padding: 10px; border-radius: 6px; margin-bottom: 20px; background: rgba(255, 0, 127, 0.05);">
                    <div class="st-title" style="color: #FF007F; margin-bottom: 5px;"><i class="fa-solid fa-bug"></i> Developer Override</div>
                    <div class="setting-row" style="margin-bottom: 0;">
                        <div class="setting-label" style="color: #FF007F;">Simulate Core Mode <div class="setting-desc" style="color: rgba(255, 255, 255, 0.5);">Force-disable Pro features for UI testing.</div></div>
                        <label class="switch dev-switch" style="transform:scale(0.8); margin:0;">
                            <input type="checkbox" id="devCoreToggle">
                            <span class="slider" style="background: #333;"></span>
                        </label>
                    </div>
                </div>
            ` : ''}
                <div class="setting-group">
                    <div class="st-title">Application Behavior</div>
                    <div class="setting-row">
                        <div class="setting-label">Always On Top <div class="setting-desc">Keep window floating above other apps.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="alwaysOnTopToggle"><span class="slider"></span></label>
                    </div>
                    <div class="setting-row">
                        <div class="setting-label">System Notifications <div class="setting-desc">Show OS alerts upon successful capture.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="notifyToggle"><span class="slider"></span></label>
                    </div>
                    <div class="setting-row">
                        <div class="setting-label">Hover Tooltips <div class="setting-desc">Display descriptive labels over buttons.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="guideTooltipToggle"><span class="slider"></span></label>
                    </div>
                    <div class="setting-row">
    <div class="setting-label">UI Scale <div class="setting-desc">Adjust the overall size of the application text and interface.</div></div>
    <select id="uiScaleSelect" style="background:#1e1e1e; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:12px; cursor:pointer; outline:none;">
    <option value="1">Normal (100%)</option>
    <option value="1.15">Large (115%)</option>
    <option value="1.25">Extra Large (125%)</option>
</select>
</div>
                    <div class="setting-row">
                        <div class="setting-label">Launch on Startup <div class="setting-desc">Automatically run SmartClip when Windows starts.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="startupToggle"><span class="slider"></span></label>
                    </div>
                    <div class="setting-row">
                        <div class="setting-label">Close After Copy <div class="setting-desc">Hide the window immediately after copying a clip.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="autoCloseToggle"><span class="slider"></span></label>
                    </div>
                </div>
                <div class="setting-group">
                    <div class="st-title">Data Management</div>
                    <div class="setting-row">
                        <div class="setting-label">History Limit <div class="setting-desc">Max clips kept in memory before overwriting.</div></div>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <button id="spinDown" style="background:none; border:none; color:var(--app-theme); cursor:pointer;"><i class="fa-solid fa-minus"></i></button>
                            <input type="number" id="maxItemsInput" style="background:#1e1e1e; border:1px solid #444; color:#fff; width:45px; text-align:center; padding:4px; border-radius:4px; font-size:12px;" readonly>
                            <button id="spinUp" style="background:none; border:none; color:var(--app-theme); cursor:pointer;"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                    <div class="setting-row">
                        <div class="setting-label">Optimize Images <div class="setting-desc">Downscale massive images to save memory.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="optimizeToggle"><span class="slider"></span></label>
                    </div>
                    <div class="setting-row">
                        <div class="setting-label">Show Timestamps <div class="setting-desc">Display time of capture beneath each snippet.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="timeToggle"><span class="slider"></span></label>
                    </div>
                </div>
            </div>
            <div id="guide-workflow" class="tab-pane">
                <div class="setting-group">
                    <div class="st-title">Capture & Management</div>
                    <div class="g-grid">
                        <div class="g-item"><strong><i class="fa-solid fa-copy"></i> Auto-Capture</strong> Anything you copy to your system clipboard (Ctrl+C) is automatically intercepted and saved to your SmartClip history stack.</div>
                        <div class="g-item"><strong><i class="fa-solid fa-paste"></i> Instant Paste</strong> Clicking the main text of any clip will instantly copy it back to your active clipboard so you can paste it anywhere.</div>
                        <div class="g-item" ${!isPro ? 'style="grid-column: 1 / -1;"' : ''}><strong><i class="fa-solid fa-star"></i> Pinning & Deletion</strong> Click the star icon to permanently protect a snippet from being overwritten. Click the Trash icon to delete, or use "Clear All" for unpinned clips.</div>
                        ${isPro ? `<div class="g-item"><strong><i class="fa-solid fa-terminal"></i> Terminal Recovery</strong> Accidentally deleted a clip? Open the System Terminal Log via the gear icon. Click any entry to instantly recover it.</div><div class="g-item" style="grid-column: 1 / -1;"><strong><i class="fa-solid fa-check-double"></i> Batch Exporting</strong> Use the checkboxes on the left to select multiple snippets, then click "Export" to save them as a consolidated .TXT file.</div>` : ''}
                    </div>
                </div>
            </div>
          
            ${isPro ? `
            <div id="guide-pro" class="tab-pane">
                <div class="setting-group">
                    <div class="st-title">Pro Utility Suite</div>
                    <div class="g-grid">
                        <div class="g-item" style="grid-column: 1 / -1;">
                            <strong><i class="fa-solid fa-shield-halved"></i> Sensitive Data Guard</strong>
                            Pro automatically detects API keys, tokens, and passwords in your history and masks them with a secure "••••" overlay.
                        <div style="margin-top: 8px; font-size: 11px; border-top: 1px dashed var(--brdr); padding-top: 6px;">
                                <b style="color: var(--app-theme);">Overrides:</b> Right-click any snippet and select <i>"Secure Item"</i> to manually mask missed secrets. Falsely masked? Click the lock icon on the snippet to unmask it.
                            </div>
                        </div>
                        <div class="g-item">
                            <strong><i class="fa-solid fa-database"></i> HDD Persistence</strong>
                            Your clipboard history is now saved to your local drive. Your clips will be waiting for you even after a system reboot.
                        </div>
                        <div class="g-item">
                            <strong><i class="fa-solid fa-wand-magic-sparkles"></i> Smart Transforms</strong>
                            Use the "Magic" button on any text clip to instantly convert it to <b>CamelCase</b>, <b>URL-Slugs</b>, or <b>Cleaned Text</b>.
                        </div>
                        <div class="g-item" style="grid-column: 1 / -1;">
                            <strong><i class="fa-solid fa-file-export"></i> Bulk Export</strong>
                            Select multiple clips using the checkboxes on the left and hit <b>Export</b> to save your research as a single .txt file.
                        </div>
                    </div>
                </div>
            </div>` : ''}
            <div id="guide-hotkeys" class="tab-pane">
                <div class="st-title" style="margin-top: 0;">System Shortcuts</div>
                <div class="g-grid" style="grid-template-columns: 1fr; gap: 8px;">
                     <div class="g-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;"><span>Toggle App Visibility</span><span class="k-badge">Ctrl + Shift + Space</span></div>
                     <div class="g-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;"><span>Focus Search Bar</span><span class="k-badge">S</span></div>
                     <div class="g-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;"><span>Copy Selected</span><span class="k-badge">Enter</span></div>
                </div>
            </div>
        </div>
    </div>
</div>
        `;
    }
};