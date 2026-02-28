/**
 * Stingray Boats - Boat Builder / Configurator Logic
 * Replicates the Chaparral boat builder functionality
 */

(function() {
    'use strict';

    console.log('[Configurator] Script loaded');

    // ============================================
    // CONFIGURATION DATA
    // ============================================
    const BASE_IMAGE_PATH = 'https://www.chaparralboats.com/images/builder';

    const MODELS = {
        '19ssiob': {
            name: '19 SSi OB',
            folder: 'ssi19ob_25',
            basePrice: 49955,
            msrp: 64130,
            defaultEngine: 'eng-yamaha-115',
            specs: { length: '19\'3"', beam: '8\'0"', maxHP: 150 }
        },
        '21ssiob': {
            name: '21 SSi OB',
            folder: 'ssi19ob_25', // Using same images as proof of concept
            basePrice: 59455,
            msrp: 76230,
            defaultEngine: 'eng-yamaha-115',
            specs: { length: '21\'5"', beam: '8\'6"', maxHP: 200 }
        },
        '23ssiob': {
            name: '23 SSi OB',
            folder: 'ssi19ob_25', // Using same images as proof of concept
            basePrice: 72455,
            msrp: 92130,
            defaultEngine: 'eng-yamaha-115',
            specs: { length: '23\'0"', beam: '8\'6"', maxHP: 250 }
        }
    };

    // Layer mapping: graphic name -> layer element ID
    const LAYER_MAP = {
        'deckacc_black': 'layer-deckacc',
        'deckacc_blue': 'layer-deckacc',
        'deckacc_alloy': 'layer-deckacc',
        'deckacc_atlas': 'layer-deckacc',
        'deckacc_steel': 'layer-deckacc',
        'hullside_black': 'layer-hullside',
        'hullside_blue': 'layer-hullside',
        'hullside_alloy': 'layer-hullside',
        'hullside_steel': 'layer-hullside',
        'hullside_atlas': 'layer-hullside',
        'vxsport_whtgray': 'layer-vxsport',
        'vxsport_whtred': 'layer-vxsport',
        'vxsport_blkgray': 'layer-vxsport',
        'vxsport_blkred': 'layer-vxsport',
        'interior_cayenne': 'layer-interior',
        'yamaha_grayXB': 'layer-engine',
        'yamaha_grayXC': 'layer-engine',
        'std_trailer': 'layer-trailer',
        'alm_trailer_single': 'layer-trailer',
        'alm_trailer_dual': 'layer-trailer',
        'blk_trailer': 'layer-trailer',
        'std_trailer_spare': 'layer-trailer-spare',
        'alm_trailer_single_spare': 'layer-trailer-spare',
        'blk_trailer_spare': 'layer-trailer-spare',
        'alm_trailer_dual_spare': 'layer-trailer-spare',
        'side_guides': 'layer-side-guides'
    };

    // Arch mapping depends on hull color
    const ARCH_MAP = {
        'white': 'arch_white',
        'black': 'arch_black'
    };

    // ============================================
    // STATE
    // ============================================
    let currentModel = null;
    let currentSection = 'exterior';
    let showMSRP = true;

    let selectedOptions = {
        whiteHull: 'wh-black',
        hullSide: null,
        vxSport: null,
        engine: 'eng-yamaha-115',
        interior: 'int-sterling',
        canvasColor: 'canvas-black',
        trailer: 'trailer-std',
        checkboxes: {}
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        console.log('[Configurator] Initializing...');
        try {
            // Detect model from URL
            const urlParams = new URLSearchParams(window.location.search);
            const modelKey = urlParams.get('model') || '19ssiob';
            currentModel = MODELS[modelKey] || MODELS['19ssiob'];

            // Set model names
            document.getElementById('model-name').textContent = currentModel.name;
            document.getElementById('model-name-mobile').textContent = currentModel.name;

            // Setup event listeners
            setupDropdown();
            setupSwatches();
            setupEngineOptions();
            setupCheckboxOptions();
            setupTrailerOptions();
            setupNavigation();
            setupMSRPToggle();
            setupModals();
            setupCookieNotice();

            // Apply default selections
            applyInitialState();
            updatePrice();
            updateBoatImage();

            // Show ready indicator
            showStatus('Builder Ready - ' + currentModel.name);
            console.log('[Configurator] Initialized successfully for model:', currentModel.name);
        } catch (e) {
            console.error('[Configurator] Init error:', e);
            showStatus('Error initializing: ' + e.message, true);
        }
    }

    // Status toast for visual feedback
    function showStatus(msg, isError) {
        let toast = document.getElementById('status-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'status-toast';
            toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:4px;font-family:Montserrat,sans-serif;font-size:0.75rem;font-weight:500;letter-spacing:1px;z-index:9999;transition:opacity 0.4s;pointer-events:none;';
            document.body.appendChild(toast);
        }
        toast.style.background = isError ? 'rgba(220,50,50,0.9)' : 'rgba(20,20,20,0.85)';
        toast.style.color = '#fff';
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(function() { toast.style.opacity = '0'; }, 2000);
    }

    // ============================================
    // SECTION DROPDOWN
    // ============================================
    function setupDropdown() {
        const dropdown = document.getElementById('section-dropdown');
        const trigger = document.getElementById('dropdown-trigger');
        const menu = document.getElementById('dropdown-menu');
        const items = menu.querySelectorAll('.dropdown-item');

        trigger.addEventListener('click', function() {
            dropdown.classList.toggle('open');
        });

        items.forEach(function(item) {
            item.addEventListener('click', function() {
                const section = this.dataset.section;
                switchSection(section);

                // Update active state
                items.forEach(i => i.classList.remove('active'));
                this.classList.add('active');

                // Update dropdown label
                document.getElementById('current-section-name').textContent = this.textContent;

                // Close dropdown
                dropdown.classList.remove('open');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }

    function switchSection(sectionId) {
        currentSection = sectionId;
        const sections = document.querySelectorAll('.option-section');
        sections.forEach(function(section) {
            section.classList.remove('active');
        });
        const target = document.getElementById('section-' + sectionId);
        if (target) {
            target.classList.add('active');
        }
    }

    // ============================================
    // SWATCH SELECTIONS (White Hull, Hull Side, VX Sport, Interior, Canvas)
    // ============================================
    function setupSwatches() {
        const swatchGroups = document.querySelectorAll('.option-swatches');
        console.log('[Configurator] Setting up', swatchGroups.length, 'swatch groups');

        swatchGroups.forEach(function(group) {
            const groupName = group.dataset.group;
            const type = group.dataset.type; // radio or single
            const swatches = group.querySelectorAll('.swatch');
            console.log('[Configurator] Group:', groupName, 'type:', type, 'swatches:', swatches.length);

            swatches.forEach(function(swatch) {
                swatch.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Configurator] Swatch clicked:', this.dataset.id, 'in group:', groupName);

                    if (type === 'radio') {
                        // Radio: deselect all in group, select this one
                        swatches.forEach(s => s.classList.remove('selected'));
                        this.classList.add('selected');
                    } else if (type === 'single') {
                        // Toggle: can select/deselect one at a time
                        if (this.classList.contains('selected')) {
                            this.classList.remove('selected');
                        } else {
                            swatches.forEach(s => s.classList.remove('selected'));
                            this.classList.add('selected');
                        }
                    }

                    // Update group label to show selected option
                    var label = this.querySelector('.swatch-label');
                    var header = group.closest('.option-group').querySelector('.option-group-label');
                    if (header && label) {
                        header.textContent = label.textContent.toUpperCase();
                    }

                    // Flash the swatch briefly
                    this.style.boxShadow = '0 0 12px rgba(127,184,0,0.8)';
                    var self = this;
                    setTimeout(function() { self.style.boxShadow = ''; }, 300);

                    // Update state
                    updateSwatchState(groupName, group);
                    updatePrice();
                    updateBoatImage();

                    // Status message
                    var name = label ? label.textContent : this.dataset.id;
                    showStatus(groupName.replace(/-/g, ' ').toUpperCase() + ': ' + name);
                });
            });
        });
    }

    function updateSwatchState(groupName, group) {
        const selected = group.querySelector('.swatch.selected');

        switch (groupName) {
            case 'white-hull':
                selectedOptions.whiteHull = selected ? selected.dataset.id : null;
                break;
            case 'hull-side':
                selectedOptions.hullSide = selected ? selected.dataset.id : null;
                break;
            case 'vx-sport':
                selectedOptions.vxSport = selected ? selected.dataset.id : null;
                break;
            case 'interior-color':
                selectedOptions.interior = selected ? selected.dataset.id : null;
                break;
            case 'canvas-color':
                selectedOptions.canvasColor = selected ? selected.dataset.id : null;
                break;
        }
    }

    // ============================================
    // ENGINE OPTIONS
    // ============================================
    function setupEngineOptions() {
        const engineGroups = document.querySelectorAll('.engine-options[data-group="engine"]');
        console.log('[Configurator] Engine groups found:', engineGroups.length);

        engineGroups.forEach(function(group) {
            const options = group.querySelectorAll('.engine-option');

            options.forEach(function(option) {
                option.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('[Configurator] Engine clicked:', this.dataset.id);
                    options.forEach(o => o.classList.remove('selected'));
                    this.classList.add('selected');
                    selectedOptions.engine = this.dataset.id;

                    var engName = this.querySelector('.engine-name');
                    showStatus('ENGINE: ' + (engName ? engName.textContent : this.dataset.id));

                    // Update prop availability
                    updatePropAvailability();
                    updatePrice();
                    updateBoatImage();
                });
            });
        });
    }

    function updatePropAvailability() {
        const engineOpt = document.querySelector('.engine-option.selected[data-mfg]');
        if (!engineOpt) return;

        const engineMfg = engineOpt.dataset.mfg;
        const propOptions = document.querySelectorAll('[data-group="props"] .checkbox-option');

        propOptions.forEach(function(opt) {
            const reqMfg = opt.dataset.engineReq;
            if (reqMfg && reqMfg !== engineMfg) {
                opt.classList.add('disabled');
                opt.querySelector('input').checked = false;
            } else {
                opt.classList.remove('disabled');
            }
        });
    }

    // ============================================
    // TRAILER OPTIONS
    // ============================================
    function setupTrailerOptions() {
        const trailerGroups = document.querySelectorAll('.engine-options[data-group="trailer"]');
        console.log('[Configurator] Trailer groups found:', trailerGroups.length);

        trailerGroups.forEach(function(group) {
            const options = group.querySelectorAll('.engine-option');

            options.forEach(function(option) {
                option.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('[Configurator] Trailer clicked:', this.dataset.id);
                    options.forEach(o => o.classList.remove('selected'));
                    this.classList.add('selected');
                    selectedOptions.trailer = this.dataset.id;

                    var tName = this.querySelector('.engine-name');
                    showStatus('TRAILER: ' + (tName ? tName.textContent : this.dataset.id));

                    updatePrice();
                    updateBoatImage();
                });
            });
        });
    }

    // ============================================
    // CHECKBOX OPTIONS
    // ============================================
    function setupCheckboxOptions() {
        const items = document.querySelectorAll('.checkbox-option');
        console.log('[Configurator] Checkbox options found:', items.length);

        items.forEach(function(item) {
            item.addEventListener('click', function() {
                if (this.classList.contains('disabled')) return;

                var cb = this.querySelector('input[type="checkbox"]');
                if (!cb) return;

                cb.checked = !cb.checked;

                var optId = this.dataset.id;
                selectedOptions.checkboxes[optId] = cb.checked;
                console.log('[Configurator] Checkbox', optId, ':', cb.checked);

                var optText = this.querySelector('.option-text');
                showStatus((cb.checked ? 'Added' : 'Removed') + ': ' + (optText ? optText.textContent : optId));

                updatePrice();
                updateBoatImage();
            });
        });
    }

    // ============================================
    // NAVIGATION ARROWS
    // ============================================
    function setupNavigation() {
        const sections = ['exterior', 'power', 'interior', 'canvas', 'electronics', 'accessories', 'trailer'];

        document.getElementById('nav-prev').addEventListener('click', function() {
            const idx = sections.indexOf(currentSection);
            if (idx > 0) {
                const newSection = sections[idx - 1];
                switchSection(newSection);
                updateDropdownActive(newSection);
            }
        });

        document.getElementById('nav-next').addEventListener('click', function() {
            const idx = sections.indexOf(currentSection);
            if (idx < sections.length - 1) {
                const newSection = sections[idx + 1];
                switchSection(newSection);
                updateDropdownActive(newSection);
            }
        });
    }

    function updateDropdownActive(sectionId) {
        const items = document.querySelectorAll('.dropdown-item');
        items.forEach(function(item) {
            item.classList.remove('active');
            if (item.dataset.section === sectionId) {
                item.classList.add('active');
                document.getElementById('current-section-name').textContent = item.textContent;
            }
        });
    }

    // ============================================
    // MSRP TOGGLE
    // ============================================
    function setupMSRPToggle() {
        const toggle = document.getElementById('show-msrp');
        toggle.addEventListener('change', function() {
            showMSRP = this.checked;
            updatePriceDisplay();
        });
    }

    // ============================================
    // PRICING
    // ============================================
    function updatePrice() {
        let totalOptions = 0;
        let totalMSRP = 0;

        // Engine price
        const engine = document.querySelector('.engine-options[data-group="engine"] .engine-option.selected');
        if (engine) {
            totalOptions += parseInt(engine.dataset.price) || 0;
        }

        // Trailer price
        const trailer = document.querySelector('.engine-options[data-group="trailer"] .engine-option.selected');
        if (trailer) {
            totalOptions += parseInt(trailer.dataset.price) || 0;
        }

        // VX Sport
        const vxSwatch = document.querySelector('[data-group="vx-sport"] .swatch.selected');
        if (vxSwatch) {
            totalOptions += parseInt(vxSwatch.dataset.price) || 0;
        }

        // Interior
        const intSwatch = document.querySelector('[data-group="interior-color"] .swatch.selected');
        if (intSwatch) {
            totalOptions += parseInt(intSwatch.dataset.price) || 0;
        }

        // Checkbox options
        const checkedBoxes = document.querySelectorAll('.checkbox-option input:checked');
        checkedBoxes.forEach(function(cb) {
            const parentLabel = cb.closest('.checkbox-option');
            if (!parentLabel.classList.contains('disabled')) {
                totalOptions += parseInt(parentLabel.dataset.price) || 0;
            }
        });

        // Calculate final prices
        // The "as built" price is a bundled price that's lower than MSRP
        const asBuiltPrice = currentModel.basePrice + (totalOptions - 48895); // Subtract default engine price
        const msrpPrice = currentModel.msrp + (totalOptions - 48895);

        updatePriceDisplay(asBuiltPrice, msrpPrice);
    }

    function updatePriceDisplay(asBuilt, msrp) {
        const priceEl = document.getElementById('price-as-built');
        const msrpEl = document.getElementById('msrp-value');
        const msrpContainer = document.getElementById('price-msrp');

        if (asBuilt !== undefined) {
            var newText = '$' + asBuilt.toLocaleString();
            if (priceEl.textContent !== newText) {
                priceEl.textContent = newText;
                // Flash price change
                priceEl.style.color = '#7fb800';
                priceEl.style.transform = 'scale(1.08)';
                setTimeout(function() {
                    priceEl.style.color = '';
                    priceEl.style.transform = '';
                }, 400);
                console.log('[Configurator] Price updated:', newText);
            }
        }
        if (msrp !== undefined) {
            msrpEl.textContent = '$' + msrp.toLocaleString();
        }

        if (msrpContainer) {
            msrpContainer.style.display = showMSRP ? 'block' : 'none';
        }
    }

    // ============================================
    // BOAT IMAGE UPDATE
    // ============================================
    function setLayerImage(layerId, url) {
        var el = document.getElementById(layerId);
        if (!el) { console.warn('[Configurator] Layer not found:', layerId); return; }
        if (url) {
            // Preload then swap with fade transition
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function() {
                el.src = url;
                el.style.display = 'block';
                el.style.opacity = '1';
                console.log('[Configurator] Layer loaded:', layerId, url.split('/').pop());
            };
            img.onerror = function() {
                console.warn('[Configurator] Failed to load:', url);
                el.style.display = 'none';
            };
            // Fade out first
            el.style.opacity = '0.3';
            img.src = url;
        } else {
            el.style.opacity = '0';
            setTimeout(function() {
                el.style.display = 'none';
                el.src = '';
                el.style.opacity = '1';
            }, 350);
        }
    }

    function updateBoatImage() {
        if (!currentModel) return;
        var folder = currentModel.folder;
        var gfx = BASE_IMAGE_PATH + '/graphics/' + folder + '/';
        var hullPath = BASE_IMAGE_PATH + '/hulls/' + folder + '/';
        console.log('[Configurator] === Updating boat image ===');

        // 1. Hull base (always white hull)
        setLayerImage('layer-hull', hullPath + 'white_hull.png');

        // 2. Arch (always visible)
        setLayerImage('layer-arch', gfx + 'arch_black.png');

        // 3. Deck accent (from White Hull swatch group)
        var whSwatch = document.querySelector('[data-group="white-hull"] .swatch.selected');
        if (whSwatch && whSwatch.dataset.graphic) {
            setLayerImage('layer-deckacc', gfx + whSwatch.dataset.graphic + '.png');
            console.log('[Configurator] Deck accent:', whSwatch.dataset.graphic);
        } else {
            setLayerImage('layer-deckacc', gfx + 'deckacc_black.png');
        }

        // 4. Hull side
        var hsSwatch = document.querySelector('[data-group="hull-side"] .swatch.selected');
        if (hsSwatch && hsSwatch.dataset.graphic) {
            setLayerImage('layer-hullside', gfx + hsSwatch.dataset.graphic + '.png');
            console.log('[Configurator] Hull side:', hsSwatch.dataset.graphic);
        } else {
            setLayerImage('layer-hullside', null);
        }

        // 5. VX Sport
        var vxSwatch = document.querySelector('[data-group="vx-sport"] .swatch.selected');
        if (vxSwatch && vxSwatch.dataset.graphic) {
            setLayerImage('layer-vxsport', gfx + vxSwatch.dataset.graphic + '.png');
            console.log('[Configurator] VX Sport:', vxSwatch.dataset.graphic);
        } else {
            setLayerImage('layer-vxsport', null);
        }

        // 6. Interior
        var intSwatch = document.querySelector('[data-group="interior-color"] .swatch.selected');
        if (intSwatch && intSwatch.dataset.graphic) {
            setLayerImage('layer-interior', gfx + intSwatch.dataset.graphic + '.png');
        } else {
            setLayerImage('layer-interior', null);
        }

        // 7. Engine
        var engOpt = document.querySelector('.engine-options[data-group="engine"] .engine-option.selected');
        if (engOpt && engOpt.dataset.graphic) {
            setLayerImage('layer-engine', gfx + engOpt.dataset.graphic + '.png');
            console.log('[Configurator] Engine:', engOpt.dataset.graphic);
        } else {
            setLayerImage('layer-engine', null);
        }

        // 8. Trailer
        var trailerOpt = document.querySelector('.engine-options[data-group="trailer"] .engine-option.selected');
        if (trailerOpt && trailerOpt.dataset.graphic) {
            setLayerImage('layer-trailer', gfx + trailerOpt.dataset.graphic + '.png');
            console.log('[Configurator] Trailer:', trailerOpt.dataset.graphic);
        } else {
            setLayerImage('layer-trailer', null);
        }

        // 9. Spare tire
        var spareCb = document.querySelector('[data-id="spare-tire"] input');
        if (spareCb && spareCb.checked && trailerOpt && trailerOpt.dataset.graphic) {
            setLayerImage('layer-trailer-spare', gfx + trailerOpt.dataset.graphic + '_spare.png');
        } else {
            setLayerImage('layer-trailer-spare', null);
        }

        // 10. Side guides
        var guidesCb = document.querySelector('[data-id="side-guides"] input');
        if (guidesCb && guidesCb.checked) {
            setLayerImage('layer-side-guides', gfx + 'side_guides.png');
        } else {
            setLayerImage('layer-side-guides', null);
        }
    }

    // ============================================
    // INITIAL STATE
    // ============================================
    function applyInitialState() {
        // Default: White Hull Black is selected (already set in HTML)
        // Default: Engine - Yamaha 115 is selected (already set in HTML)
        // Default: Interior - Sterling is selected (already set in HTML)
        // Default: Canvas - Black is selected (already set in HTML)
        // Default: Trailer - Standard is selected (already set in HTML)

        // Set initial prop availability
        updatePropAvailability();
    }

    // ============================================
    // MODALS
    // ============================================
    function setupModals() {
        // Close button goes back to models page
        document.getElementById('close-configurator').addEventListener('click', function() {
            window.location.href = 'index.html';
        });

        // Save build buttons
        const saveBtns = [
            document.getElementById('btn-save-build'),
            document.getElementById('btn-save-build-bottom')
        ];

        saveBtns.forEach(function(btn) {
            if (btn) {
                btn.addEventListener('click', function() {
                    openSaveModal();
                });
            }
        });

        // Close modals
        document.getElementById('modal-close').addEventListener('click', function() {
            document.getElementById('standards-modal').style.display = 'none';
        });

        document.getElementById('save-modal-close').addEventListener('click', function() {
            document.getElementById('save-modal').style.display = 'none';
        });

        // Close on overlay click
        document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.style.display = 'none';
                }
            });
        });

        // Form submit
        document.getElementById('save-build-form').addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you! Your build has been saved. A Stingray Boats dealer will contact you shortly.');
            document.getElementById('save-modal').style.display = 'none';
        });
    }

    function openSaveModal() {
        // Populate build summary
        const summary = document.getElementById('build-summary');
        let html = '<h4>YOUR BUILD SUMMARY</h4>';
        html += '<div class="summary-line"><span>Model</span><span>' + currentModel.name + '</span></div>';

        // Engine
        const engine = document.querySelector('.engine-options[data-group="engine"] .engine-option.selected');
        if (engine) {
            const name = engine.querySelector('.engine-name').textContent;
            html += '<div class="summary-line"><span>' + name + '</span><span>$' + parseInt(engine.dataset.price).toLocaleString() + '</span></div>';
        }

        // VX Sport
        const vxSwatch = document.querySelector('[data-group="vx-sport"] .swatch.selected');
        if (vxSwatch) {
            html += '<div class="summary-line"><span>VX Sport Graphics</span><span>$' + parseInt(vxSwatch.dataset.price).toLocaleString() + '</span></div>';
        }

        // Interior
        const intSwatch = document.querySelector('[data-group="interior-color"] .swatch.selected');
        if (intSwatch && parseInt(intSwatch.dataset.price) > 0) {
            html += '<div class="summary-line"><span>Interior: ' + intSwatch.querySelector('.swatch-label').textContent + '</span><span>$' + parseInt(intSwatch.dataset.price).toLocaleString() + '</span></div>';
        }

        // Trailer
        const trailer = document.querySelector('.engine-options[data-group="trailer"] .engine-option.selected');
        if (trailer && parseInt(trailer.dataset.price) > 0) {
            const tName = trailer.querySelector('.engine-name').textContent;
            html += '<div class="summary-line"><span>' + tName + '</span><span>$' + parseInt(trailer.dataset.price).toLocaleString() + '</span></div>';
        }

        // Checkbox options
        const checked = document.querySelectorAll('.checkbox-option input:checked');
        checked.forEach(function(cb) {
            const parent = cb.closest('.checkbox-option');
            if (!parent.classList.contains('disabled')) {
                const text = parent.querySelector('.option-text').textContent;
                const price = parseInt(parent.dataset.price) || 0;
                html += '<div class="summary-line"><span>' + text + '</span><span>$' + price.toLocaleString() + '</span></div>';
            }
        });

        // Total
        const totalEl = document.getElementById('price-as-built');
        html += '<div class="summary-total"><span>STINGRAY ONE PRICE</span><span>' + totalEl.textContent + '</span></div>';

        summary.innerHTML = html;
        document.getElementById('save-modal').style.display = 'flex';
    }

    // ============================================
    // COOKIE NOTICE
    // ============================================
    function setupCookieNotice() {
        const notice = document.getElementById('cookie-notice');
        const btn = document.getElementById('cookie-accept');

        if (btn) {
            btn.addEventListener('click', function() {
                notice.classList.add('hidden');
                localStorage.setItem('cookieAccepted', 'true');
            });
        }

        if (localStorage.getItem('cookieAccepted') === 'true') {
            notice.classList.add('hidden');
        }
    }

    // ============================================
    // BOOT
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded (e.g., script loaded async or deferred)
        init();
    }

    // Global error handler for debugging
    window.addEventListener('error', function(e) {
        console.error('[Configurator] Global error:', e.message, 'at', e.filename, ':', e.lineno);
    });

})();
