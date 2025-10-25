/**
 * Tribal Wars - Attack Tracker & Unit Detector
 * In-game script για ανίχνευση και καταγραφή επιθέσεων
 * 
 * Χρήση: javascript:$.getScript('https://YOUR-URL/attackTracker.js');
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
        version: '2.0',
        worldSpeed: parseFloat(localStorage.getItem('TW_worldSpeed')) || 1.0,
        unitSpeed: parseFloat(localStorage.getItem('TW_unitSpeed')) || 1.0,
        updateInterval: 2000,
        maxAttacks: 100
    };
    
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
                background: linear-gradient(135deg, rgba(20, 20, 20, 0.98) 0%, rgba(40, 40, 60, 0.98) 100%);
                border: 2px solid #8d5524;
                border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
                z-index: 10000;
                font-family: Verdana, Arial, sans-serif;
                display: flex;
                flex-direction: column;
            }
            
            #attackTrackerPanel.minimized {
                height: auto;
            }
            
            .tracker-header {
                background: linear-gradient(to bottom, #8d5524 0%, #6d3d14 100%);
                padding: 10px 12px;
                border-bottom: 1px solid #5d2d04;
                border-radius: 6px 6px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
                color: #fff;
                font-weight: bold;
                font-size: 13px;
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
                background: rgba(30, 30, 30, 0.9);
                border: 1px solid #8d5524;
                border-radius: 5px;
                padding: 10px;
                margin-bottom: 8px;
                transition: all 0.2s;
            }
            
            .attack-card:hover {
                background: rgba(40, 40, 40, 0.9);
                border-color: #ad7534;
                transform: translateX(-2px);
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
        
        // Panel HTML
        const panelHTML = `
            <div id="attackTrackerPanel">
                <div class="tracker-header">
                    <div class="tracker-title">
                        🎯 Attack Tracker <span style="font-size: 10px; color: #ccc;">(${tracker.attacks.length})</span>
                    </div>
                    <div class="tracker-controls">
                        <button class="tracker-btn" id="trackerMinimize">−</button>
                        <button class="tracker-btn" id="trackerClear">🗑</button>
                        <button class="tracker-btn" id="trackerClose">✕</button>
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
                <div class="tracker-content" id="trackerContent"></div>
                <div class="tracker-stats" id="trackerStats">Φόρτωση...</div>
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
        // Εύρεση εισερχόμενων στο overview
        $('.quickedit-label, .quickedit-content').each(function() {
            try {
                const $row = $(this).closest('tr');
                const $timer = $row.find('span[id^="timer"]');
                
                if ($timer.length === 0) return;
                
                const timeText = $timer.text().trim();
                if (!timeText) return;
                
                const arrivalMinutes = parseTimeToMinutes(timeText);
                if (arrivalMinutes <= 0) return;
                
                const attackId = $row.attr('id') || `attack_${Date.now()}_${Math.random()}`;
                if (tracker.trackedIds.has(attackId)) return;
                
                const $coords = $row.find('a[href*="info_village"]');
                const $player = $row.find('a[href*="info_player"]');
                
                const attackData = {
                    id: attackId,
                    detectedAt: Date.now(),
                    initialDuration: arrivalMinutes,
                    arrivalTime: Date.now() + (arrivalMinutes * 60 * 1000),
                    playerName: $player.length ? $player.first().text().trim() : 'Άγνωστος',
                    sourceCoords: $coords.length > 0 ? $coords.eq(0).text().trim() : '???',
                    targetCoords: $coords.length > 1 ? $coords.eq(1).text().trim() : '???',
                    possibleUnits: getPossibleUnits(arrivalMinutes),
                    worldSpeed: CONFIG.worldSpeed,
                    unitSpeed: CONFIG.unitSpeed,
                    status: 'active'
                };
                
                if (tracker.addAttack(attackData)) {
                    console.log('🎯 Νέα επίθεση:', attackData);
                    updatePanel();
                    UI.InfoMessage(`Νέα επίθεση από ${attackData.playerName}!`, 2000, 'success');
                }
            } catch (error) {
                console.error('Error detecting attack:', error);
            }
        });
    }
    
    // ==================== INITIALIZATION ====================
    
    const tracker = new AttackTracker();
    
    // Δημιουργία UI
    createPanel();
    
    // Auto-update
    const updateInterval = setInterval(() => {
        detectAttacks();
        updatePanel();
    }, CONFIG.updateInterval);
    
    // Initial detection
    setTimeout(detectAttacks, 1000);
    
    // Success message
    UI.SuccessMessage('Attack Tracker v' + CONFIG.version + ' activated! 🎯', 3000);
    
    console.log('%c🎯 Attack Tracker Activated!', 'color: #22c55e; font-size: 16px; font-weight: bold;');
    console.log('Version:', CONFIG.version);
    console.log('Καταγεγραμμένες επιθέσεις:', tracker.attacks.length);
    
    // Cleanup on page unload
    $(window).on('beforeunload', function() {
        clearInterval(updateInterval);
    });
    
})();

