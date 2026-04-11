// UIManager.js

export const UIManager = {
    initTooltips: (getSettingsFn) => {
        const tooltip = document.getElementById('custom-tooltip');
        if (!tooltip) return;

        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[title], [data-tooltip]');
            if (target) {
                if (target.hasAttribute('title')) { 
                    target.setAttribute('data-tooltip', target.getAttribute('title')); 
                    target.removeAttribute('title'); 
                }
                
                const settings = getSettingsFn();
                if (settings.tooltipsEnabled !== false) {
                    tooltip.textContent = target.getAttribute('data-tooltip'); 
                    tooltip.classList.add('show');
                    
                    const rect = target.getBoundingClientRect();
                    const tipRect = tooltip.getBoundingClientRect();
                    const winW = window.innerWidth;
                    const winH = window.innerHeight;
                    const gap = 8;
                    const padding = 10;
                    
                    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
                    if (left < padding) left = padding;
                    if (left + tipRect.width > winW - padding) left = winW - tipRect.width - padding;
                    
                    let top = rect.bottom + gap;
                    if (top + tipRect.height > winH - padding) {
                        top = rect.top - tipRect.height - gap;
                    }
                    
                    tooltip.style.left = left + 'px';
                    tooltip.style.top = top + 'px';
                }
            }
        });

        document.addEventListener('mouseout', () => tooltip.classList.remove('show'));
    },

    initSettingsTabs: (helpModal) => {
        if (!helpModal) return;
        const tabBtns = helpModal.querySelectorAll('.tab-btn');
        const tabPanes = helpModal.querySelectorAll('.tab-pane');
        
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                helpModal.querySelector(`#${btn.dataset.tab}`).classList.add('active');
            };
        });
    },

    createTransformMenu: () => {
        const tfMenu = document.createElement('div');
        tfMenu.id = 'transform-menu';
        tfMenu.style.cssText = `display: none; position: fixed; z-index: 20001; background: rgba(26, 31, 36, 0.95); backdrop-filter: blur(4px); border: 1px solid rgba(0, 188, 212, 0.3); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.6); padding: 3px; gap: 3px; flex-direction: row; white-space: nowrap;`;
        document.body.appendChild(tfMenu);
        return tfMenu;
    },

    closeTransformMenu: (tfMenu) => {
        if (tfMenu && tfMenu.style.display !== 'none') {
            tfMenu.classList.remove('tf-menu-open');
            tfMenu.classList.add('tf-menu-close');
            setTimeout(() => { 
                tfMenu.style.display = 'none'; 
                tfMenu.classList.remove('tf-menu-close'); 
                tfMenu.dataset.activeId = ''; 
            }, 100); 
        }
    },

    initDragAndDropUI: (dropzone, onFileDrop) => {
        if (!dropzone) return;
        let dragCounter = 0; 

        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes('Files')) {
                dragCounter++;
                dropzone.classList.add('drag-active');
            }
        });

        window.addEventListener('dragover', (e) => e.preventDefault());

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) dropzone.classList.remove('drag-active');
        });

        window.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            dropzone.classList.remove('drag-active');

            const files = e.dataTransfer.files;
            if (files && files.length > 0) onFileDrop(files[0]);
        });
    }
};