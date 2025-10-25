/**
 * Tribal Wars - Attack Tracker & Unit Detector
 * Self-contained in-game script για ανίχνευση και καταγραφή επιθέσεων
 * 
 * Χρήση: Copy-paste αυτόν τον κώδικα στο Tribal Wars Script feature
 */

(function() {
    'use strict';
    
    // Έλεγχος αν ήδη τρέχει
    if (window.AttackTracker) {
        console.log('Attack Tracker ήδη τρέχει!');
        return;
    }
    
    // ==================== CONFIGURATION ====================
    
    const CONFIG = {
        version: '2.1',
        worldSpeed: parseFloat(localStorage.getItem('TW_worldSpeed')) || 1.0,
        unitSpeed: parseFloat(localStorage.getItem('TW_unitSpeed')) || 1.0,
        updateInterval: 2000,
        maxAttacks: 100,
        debug: false
    };
    
    // Script info (όπως στο Incomings Overview)
    const scriptInfo = {
        name: 'Attack Tracker',
        version: CONFIG.version,
        author: 'AI Assistant',
        prefix: 'attackTracker'
    };
    
    // Debug logging (όπως στο Incomings Overview)
    function debugLog(message, data = null) {
        if (CONFIG.debug) {
            console.log(`[${scriptInfo.name}] ${message}`, data);
        }
    }
    
    // Ταχύτητες μονάδων (βάση)
    const UNIT_SPEEDS = {
        'spear': 18, 'sword': 22, 'axe': 18, 'archer': 18,
        'scout': 9, 'light': 10, 'marcher': 10, 'heavy': 11,
        'ram': 30, 'catapult': 30, 'knight': 10, 'snob': 35
    };
    
    const UNIT_NAMES = {
        'spear': 'Δορυφόρος', 'sword': 'Ξιφομάχος', 'axe': 'Πελεκυφόρος',
        'archer': 'Τοξότης', 'scout': 'Ανιχνευτής', 'light': 'Ελαφρύ Ιππικό',
        'marcher': 'Ιππότοξότης', 'heavy': 'Βαρύ Ιππικό', 'ram': 'Κριός',
        'catapult': 'Καταπέλτης', 'knight': 'Παλαδίνος', 'snob': 'Ευγενής'
    };
    
    // ==================== ATTACK STORAGE ====================
    
    class AttackTracker {
        constructor() {
            this.attacks = this.loadAttacks();
            this.trackedIds = new Set(this.attacks.map(a => a.id));
            window.AttackTracker = this;
        }
        
        loadAttacks() {
            try {
                const stored = localStorage.getItem('TW_attackList');
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                return [];
            }
        }
        
        saveAttacks() {
            try {
                localStorage.setItem('TW_attackList', JSON.stringify(this.attacks));
            } catch (e) {
                console.error('Error saving attacks:', e);
            }
        }
        
        addAttack(attackData) {
            if (!this.trackedIds.has(attackData.id)) {
                this.attacks.unshift(attackData);
                this.trackedIds.add(attackData.id);
                
                if (this.attacks.length > CONFIG.maxAttacks) {
                    const removed = this.attacks.pop();
                    this.trackedIds.delete(removed.id);
                }
                
                this.saveAttacks();
                return true;
            }
            return false;
        }
        
        getActiveAttacks() {
            const now = Date.now();
            return this.attacks.filter(a => a.arrivalTime > now);
        }
        
        clearAll() {
            this.attacks = [];
            this.trackedIds.clear();
            this.saveAttacks();
        }
    }
    
    // ==================== CALCULATIONS ====================
    
    function getAdjustedSpeed(baseSpeed) {
        return baseSpeed / (CONFIG.worldSpeed * CONFIG.unitSpeed);
    }
    
    function parseTimeToMinutes(timeString) {
        const parts = timeString.trim().split(':').map(p => parseInt(p, 10));
        if (parts.length === 3) {
            return parts[0] * 60 + parts[1] + parts[2] / 60;
        } else if (parts.length === 2) {
            return parts[0] + parts[1] / 60;
        }
        return 0;
    }
    
    function formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = Math.round((minutes % 1) * 60);
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    
    function getPossibleUnits(arrivalMinutes, tolerance = 2) {
        const possibleUnits = [];
        
        for (const [unitKey, baseSpeed] of Object.entries(UNIT_SPEEDS)) {
            const adjustedSpeed = getAdjustedSpeed(baseSpeed);
            const calculatedDistance = arrivalMinutes / adjustedSpeed;
            
            if (calculatedDistance >= 0.5 && calculatedDistance <= 150) {
                const roundedDistance = Math.round(calculatedDistance);
                const exactTime = roundedDistance * adjustedSpeed;
                const difference = Math.abs(arrivalMinutes - exactTime);
                
                if (difference <= tolerance) {
                    possibleUnits.push({
                        unit: unitKey,
                        distance: roundedDistance,
                        exactTime: exactTime,
                        difference: difference,
                        isExact: difference < 0.5
                    });
                }
            }
        }
        
        return possibleUnits.sort((a, b) => a.difference - b.difference);
    }
    
    // ==================== UI STYLES ====================
    
    const styles = `
        <style id="attack-tracker-styles">
            #attackTrackerPanel {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 420px;
                max-height: 75vh;
                background: linear-gradient(135deg, rgba(15, 15, 15, 0.95) 0%, rgba(25, 25, 35, 0.95) 100%);
                border: 1px solid #444;
                border-radius: 6px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                backdrop-filter: blur(10px);
            }
            
            #attackTrackerPanel.minimized {
                height: auto;
            }
            
            .tracker-header {
                background: linear-gradient(to bottom, #2a2a2a 0%, #1a1a1a 100%);
                padding: 12px 16px;
                border-bottom: 1px solid #333;
                border-radius: 6px 6px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
                color: #fff;
                font-weight: 600;
                font-size: 14px;
            }
            
            .tracker-title {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .tracker-controls {
                display: flex;
                gap: 5px;
            }
            
            .tracker-btn {
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #fff;
                padding: 3px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s;
            }
            
            .tracker-btn:hover {
                background: rgba(141, 85, 36, 0.6);
                border-color: #8d5524;
            }
            
            .tracker-config {
                padding: 10px;
                background: rgba(0, 0, 0, 0.3);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }
            
            .config-item {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            
            .config-item label {
                font-size: 10px;
                color: #ddd;
                font-weight: bold;
            }
            
            .config-item input {
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #8d5524;
                color: #fff;
                padding: 5px;
                border-radius: 3px;
                font-size: 11px;
            }
            
            .tracker-content {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
                max-height: calc(75vh - 150px);
                background: rgba(0, 0, 0, 0.2);
            }
            
            .attack-card {
                background: rgba(25, 25, 25, 0.8);
                border: 1px solid #333;
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 8px;
                transition: all 0.3s ease;
            }
            
            .attack-card:hover {
                background: rgba(35, 35, 35, 0.9);
                border-color: #555;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            .attack-card.past {
                opacity: 0.5;
            }
            
            .attack-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
            }
            
            .attack-player {
                font-weight: bold;
                color: #ff6b6b;
                font-size: 12px;
            }
            
            .attack-time {
                font-family: monospace;
                font-size: 12px;
                color: #ffd700;
                font-weight: bold;
            }
            
            .attack-coords {
                font-size: 10px;
                color: #64b5f6;
                margin-bottom: 6px;
                font-family: monospace;
            }
            
            .attack-units {
                display: flex;
                flex-wrap: wrap;
                gap: 3px;
                margin-top: 6px;
            }
            
            .unit-icon {
                width: 22px;
                height: 22px;
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                border-radius: 3px;
                transition: all 0.2s;
                cursor: help;
            }
            
            .unit-icon.exact {
                border: 2px solid #22c55e;
                box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
                animation: pulse-exact 2s infinite;
            }
            
            .unit-icon.possible {
                border: 2px solid #ffc107;
                box-shadow: 0 0 6px rgba(255, 193, 7, 0.5);
            }
            
            .unit-icon:hover {
                transform: scale(1.4);
            }
            
            @keyframes pulse-exact {
                0%, 100% { box-shadow: 0 0 8px rgba(34, 197, 94, 0.6); }
                50% { box-shadow: 0 0 15px rgba(34, 197, 94, 0.9); }
            }
            
            .tracker-stats {
                padding: 8px 10px;
                background: rgba(0, 0, 0, 0.4);
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                font-size: 10px;
                color: #aaa;
                text-align: center;
            }
            
            .no-attacks {
                text-align: center;
                padding: 30px;
                color: #888;
                font-size: 12px;
            }
            
            .distance-badge {
                display: inline-block;
                background: rgba(100, 181, 246, 0.3);
                color: #64b5f6;
                padding: 2px 5px;
                border-radius: 3px;
                font-size: 9px;
                font-weight: bold;
                margin-left: 5px;
            }
            
            .tracker-content::-webkit-scrollbar {
                width: 8px;
            }
            
            .tracker-content::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
            }
            
            .tracker-content::-webkit-scrollbar-thumb {
                background: #8d5524;
                border-radius: 4px;
            }
            
            .tracker-content::-webkit-scrollbar-thumb:hover {
                background: #ad7534;
            }
        </style>
    `;
    
    // ==================== UI PANEL ====================
    
    function createPanel() {
        // Αφαίρεση παλιού
        $('#attackTrackerPanel, #attack-tracker-styles').remove();
        
        // Styles
        $('head').append(styles);
        
        // Panel HTML (όπως στο Incomings Overview)
        const panelHTML = `
            <div id="attackTrackerPanel">
                <div class="tracker-header">
                    <div class="tracker-title">
                        <span style="color: #4CAF50;">⚔️</span> Attack Tracker 
                        <span style="font-size: 11px; color: #888; margin-left: 8px;">v${CONFIG.version}</span>
                        <span style="font-size: 10px; color: #ccc; margin-left: 8px;">(${tracker.attacks.length})</span>
                    </div>
                    <div class="tracker-controls">
                        <button class="tracker-btn" id="trackerMinimize" title="Minimize">−</button>
                        <button class="tracker-btn" id="trackerClear" title="Clear All">🗑</button>
                        <button class="tracker-btn" id="trackerClose" title="Close">✕</button>
                    </div>
                </div>
                <div class="tracker-config">
                    <div class="config-item">
                        <label>World Speed:</label>
                        <input type="number" id="worldSpeedInput" value="${CONFIG.worldSpeed}" step="0.1" min="0.1" max="10">
                    </div>
                    <div class="config-item">
                        <label>Unit Speed:</label>
                        <input type="number" id="unitSpeedInput" value="${CONFIG.unitSpeed}" step="0.1" min="0.1" max="10">
                    </div>
                </div>
                <div class="tracker-content" id="trackerContent">
                    <div class="no-attacks">Loading attacks...</div>
                </div>
                <div class="tracker-stats" id="trackerStats">Initializing...</div>
            </div>
        `;
        
        $('body').append(panelHTML);
        
        // Make draggable
        makeDraggable();
        
        // Event listeners
        $('#trackerMinimize').click(function() {
            $('#attackTrackerPanel').toggleClass('minimized');
            if ($('#attackTrackerPanel').hasClass('minimized')) {
                $('#trackerContent, .tracker-config, #trackerStats').hide();
            } else {
                $('#trackerContent, .tracker-config, #trackerStats').show();
            }
        });
        
        $('#trackerClear').click(function() {
            if (confirm('Διαγραφή όλων των καταγεγραμμένων επιθέσεων;')) {
                tracker.clearAll();
                updatePanel();
                UI.SuccessMessage('Όλες οι επιθέσεις διαγράφηκαν!', 2000);
            }
        });
        
        $('#trackerClose').click(function() {
            $('#attackTrackerPanel').fadeOut();
        });
        
        $('#worldSpeedInput').change(function() {
            CONFIG.worldSpeed = parseFloat($(this).val()) || 1.0;
            localStorage.setItem('TW_worldSpeed', CONFIG.worldSpeed);
            updatePanel();
        });
        
        $('#unitSpeedInput').change(function() {
            CONFIG.unitSpeed = parseFloat($(this).val()) || 1.0;
            localStorage.setItem('TW_unitSpeed', CONFIG.unitSpeed);
            updatePanel();
        });
        
        updatePanel();
    }
    
    function makeDraggable() {
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        
        $('.tracker-header').on('mousedown', function(e) {
            isDragging = true;
            const offset = $('#attackTrackerPanel').offset();
            initialX = e.clientX - offset.left;
            initialY = e.clientY - offset.top;
        });
        
        $(document).on('mousemove', function(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                $('#attackTrackerPanel').css({
                    left: currentX + 'px',
                    top: currentY + 'px',
                    right: 'auto'
                });
            }
        });
        
        $(document).on('mouseup', function() {
            isDragging = false;
        });
    }
    
    function updatePanel() {
        const activeAttacks = tracker.getActiveAttacks();
        const pastAttacks = tracker.attacks.filter(a => a.arrivalTime <= Date.now());
        
        if (tracker.attacks.length === 0) {
            $('#trackerContent').html('<div class="no-attacks">Καμία καταγεγραμμένη επίθεση<br>🛡️</div>');
        } else {
            const html = tracker.attacks.map(attack => renderAttackCard(attack)).join('');
            $('#trackerContent').html(html);
        }
        
        $('#trackerStats').text(`Ενεργές: ${activeAttacks.length} | Παρελθούσες: ${pastAttacks.length} | Σύνολο: ${tracker.attacks.length}`);
        $('.tracker-title span').text(`(${tracker.attacks.length})`);
    }
    
    function renderAttackCard(attack) {
        const now = Date.now();
        const isPast = attack.arrivalTime <= now;
        const timeRemaining = Math.max(0, (attack.arrivalTime - now) / 1000 / 60);
        
        const unitsHtml = attack.possibleUnits.slice(0, 6).map(u => {
            const imgSrc = image_base + `unit/unit_${u.unit}.png`;
            const className = u.isExact ? 'exact' : 'possible';
            return `<div class="unit-icon ${className}" 
                         style="background-image: url('${imgSrc}')"
                         title="${UNIT_NAMES[u.unit]} (~${u.distance} πεδία)"></div>`;
        }).join('');
        
        const primaryUnit = attack.possibleUnits[0];
        const distanceBadge = primaryUnit ? `<span class="distance-badge">~${primaryUnit.distance} πεδία</span>` : '';
        
        return `
            <div class="attack-card ${isPast ? 'past' : ''}">
                <div class="attack-header">
                    <div class="attack-player">${attack.playerName}</div>
                    <div class="attack-time">${isPast ? 'Έφτασε' : formatTime(timeRemaining)}</div>
                </div>
                <div class="attack-coords">
                    ${attack.sourceCoords} → ${attack.targetCoords}
                    ${distanceBadge}
                </div>
                <div class="attack-units">
                    ${unitsHtml || '<span style="color: #888; font-size: 10px;">Καμία αντιστοιχία</span>'}
                </div>
            </div>
        `;
    }
    
    // ==================== ATTACK DETECTION ====================
    
    function detectAttacks() {
        // Εύρεση του incomings_table (όπως στο Incomings Overview script)
        const $incomingsTable = $('#incomings_table');
        
        if ($incomingsTable.length === 0) {
            console.log('📋 Incomings table not found - not on attacks page');
            return;
        }
        
        const $rows = $incomingsTable.find('tbody tr');
        console.log(`📊 Found ${$rows.length} incoming attacks`);
        
        if ($rows.length === 0) {
            console.log('📋 No incoming attacks found');
            return;
        }
        
        let foundAttacks = false;
        
        $rows.each(function(index) {
            try {
                const $row = $(this);
                const $cells = $row.find('td');
                
                if ($cells.length < 8) {
                    console.log(`⚠️ Row ${index} has insufficient cells (${$cells.length})`);
                    return;
                }
                
                // Extract data from table cells (όπως στο Incomings Overview)
                const targetVillage = $cells.eq(2).text().trim();        // 3rd td - village being attacked
                const sourceVillage = $cells.eq(3).text().trim();       // 4th td - attacker's village
                const attackerName = $cells.eq(4).text().trim();        // 5th td - attacker username
                const distanceText = $cells.eq(5).text().trim();        // 6th td - distance in fields
                const arrivalTimeText = $cells.eq(6).text().trim();     // 7th td - arrival time
                const countdownText = $cells.eq(7).text().trim();       // 8th td - countdown timer
                
                console.log(`🔍 Processing attack ${index + 1}:`, {
                    targetVillage,
                    sourceVillage,
                    attackerName,
                    distanceText,
                    arrivalTimeText,
                    countdownText
                });
                
                // Parse distance
                const distance = parseInt(distanceText.replace(/[^\d]/g, '')) || 0;
                if (distance <= 0) {
                    console.log(`⚠️ Invalid distance for attack ${index + 1}: ${distanceText}`);
                    return;
                }
                
                // Parse countdown time
                const arrivalMinutes = parseTimeToMinutes(countdownText);
                if (arrivalMinutes <= 0) {
                    console.log(`⚠️ Invalid countdown for attack ${index + 1}: ${countdownText}`);
                    return;
                }
                
                // Calculate possible units based on distance and time
                const possibleUnits = getPossibleUnitsFromDistance(arrivalMinutes, distance);
                
                // Create unique attack ID
                const attackId = `attack_${sourceVillage}_${targetVillage}_${Date.now()}_${index}`;
                
                if (tracker.trackedIds.has(attackId)) {
                    console.log(`⏭️ Attack ${index + 1} already tracked`);
                    return;
                }
                
                const attackData = {
                    id: attackId,
                    detectedAt: Date.now(),
                    initialDuration: arrivalMinutes,
                    arrivalTime: Date.now() + (arrivalMinutes * 60 * 1000),
                    playerName: attackerName || 'Άγνωστος',
                    sourceCoords: sourceVillage,
                    targetCoords: targetVillage,
                    distance: distance,
                    arrivalTimeText: arrivalTimeText,
                    countdownText: countdownText,
                    possibleUnits: possibleUnits,
                    worldSpeed: CONFIG.worldSpeed,
                    unitSpeed: CONFIG.unitSpeed,
                    status: 'active'
                };
                
                if (tracker.addAttack(attackData)) {
                    console.log('🎯 Νέα επίθεση καταγράφηκε:', attackData);
                    foundAttacks = true;
                    updatePanel();
                    UI.InfoMessage(`Νέα επίθεση από ${attackData.playerName}!`, 2000, 'success');
                }
                
            } catch (error) {
                console.error(`Error processing attack row ${index}:`, error);
            }
        });
        
        if (foundAttacks) {
            console.log('✅ Attacks detected and added to tracker');
        } else {
            console.log('ℹ️ No new attacks to add');
        }
    }
    
    // ==================== UNIT CALCULATION FROM DISTANCE ====================
    
    function getPossibleUnitsFromDistance(arrivalMinutes, distance) {
        const possibleUnits = [];
        
        for (const [unitKey, baseSpeed] of Object.entries(UNIT_SPEEDS)) {
            const adjustedSpeed = getAdjustedSpeed(baseSpeed);
            const calculatedTime = distance * adjustedSpeed;
            const difference = Math.abs(arrivalMinutes - calculatedTime);
            
            // Tolerance of 2 minutes for unit matching
            if (difference <= 2) {
                possibleUnits.push({
                    unit: unitKey,
                    distance: distance,
                    calculatedTime: calculatedTime,
                    difference: difference,
                    isExact: difference < 0.5
                });
            }
        }
        
        // Sort by accuracy (most exact first)
        return possibleUnits.sort((a, b) => a.difference - b.difference);
    }
    
    // ==================== NAVIGATION & STATE ====================
    
    let isListening = false;
    let updateInterval = null;
    
    function navigateToIncomings() {
        // Βρες το current village ID
        const villageId = game_data.village.id || window.location.href.match(/village=(\d+)/)?.[1];
        
        if (!villageId) {
            UI.ErrorMessage('Δεν μπόρεσα να βρω το village ID!', 3000);
            return;
        }
        
        const incomingUrl = `/game.php?village=${villageId}&screen=overview_villages&mode=incomings&type=unignored&subtype=all`;
        
        console.log('🧭 Navigating to incomings:', incomingUrl);
        
        // Store flag that we're navigating to incomings
        localStorage.setItem('TW_navigatingToIncomings', 'true');
        
        window.location.href = incomingUrl;
    }
    
    function startListening() {
        if (isListening) {
            console.log('👂 Already listening for attacks');
            return;
        }
        
        isListening = true;
        console.log('👂 Started listening for attacks...');
        
        // Start auto-update (όπως στο Incomings Overview)
        updateInterval = setInterval(() => {
            detectAttacks();
            updatePanel();
        }, CONFIG.updateInterval);
        
        // Initial detection
        setTimeout(detectAttacks, 1000);
        
        // Add DOM mutation observer (όπως στο Incomings Overview)
        if (window.MutationObserver) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        // Check if new attacks were added to the table
                        const $newRows = $(mutation.addedNodes).filter('tr');
                        if ($newRows.length > 0) {
                            console.log('🔄 DOM mutation detected - checking for new attacks');
                            setTimeout(detectAttacks, 500);
                        }
                    }
                });
            });
            
            // Observe the incomings table for changes
            const $incomingsTable = $('#incomings_table');
            if ($incomingsTable.length > 0) {
                observer.observe($incomingsTable[0], {
                    childList: true,
                    subtree: true
                });
                console.log('👁️ DOM mutation observer started');
            }
        }
        
        // Add event listeners for table updates (όπως στο Incomings Overview)
        $(document).on('DOMNodeInserted', '#incomings_table tbody', function() {
            console.log('🔄 Table updated - checking for new attacks');
            setTimeout(detectAttacks, 500);
        });
        
        UI.SuccessMessage('Attack Tracker v' + CONFIG.version + ' activated! 🎯', 3000);
    }
    
    function stopListening() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
        isListening = false;
        console.log('🔇 Stopped listening for attacks');
    }
    
    // ==================== INITIALIZATION ====================
    
    const tracker = new AttackTracker();
    
    // Δημιουργία UI
    createPanel();
    
    // Check if we're already on incomings page
    const currentUrl = window.location.href;
    const isOnIncomings = currentUrl.includes('mode=incomings') || currentUrl.includes('screen=overview_villages');
    const hasIncomingsTable = $('#incomings_table').length > 0;
    const wasNavigating = localStorage.getItem('TW_navigatingToIncomings') === 'true';
    
    if (isOnIncomings && hasIncomingsTable) {
        // Already on incomings with table - start listening immediately
        console.log('✅ On incomings page with table - starting immediately');
        
        // Clear navigation flag
        localStorage.removeItem('TW_navigatingToIncomings');
        
        startListening();
    } else if (wasNavigating) {
        // We just navigated here but table might not be loaded yet
        console.log('⏳ Just navigated to incomings - waiting for table to load...');
        UI.InfoMessage('Waiting for attacks table to load...', 2000);
        
        // Wait a bit for the table to load, then check again
        setTimeout(() => {
            const $table = $('#incomings_table');
            if ($table.length > 0) {
                console.log('✅ Table loaded - starting listening');
                localStorage.removeItem('TW_navigatingToIncomings');
                startListening();
            } else {
                console.log('⚠️ Table still not found - manual restart needed');
                UI.ErrorMessage('Table not found. Please run the script again.', 3000);
            }
        }, 2000);
    } else {
        // Not on incomings - auto-navigate immediately
        console.log('🧭 Not on incomings page - auto-navigating...');
        UI.InfoMessage('Auto-navigating to incomings page...', 2000);
        
        // Auto-navigate after a short delay to show the message
        setTimeout(() => {
            navigateToIncomings();
        }, 1000);
    }
    
    console.log('%c🎯 Attack Tracker Ready!', 'color: #22c55e; font-size: 16px; font-weight: bold;');
    console.log('Version:', CONFIG.version);
    console.log('Καταγεγραμμένες επιθέσεις:', tracker.attacks.length);
    console.log('On incomings page:', isOnIncomings);
    
    // Cleanup on page unload
    $(window).on('beforeunload', function() {
        stopListening();
    });
    
})();

