// UI Rendering and Interaction Module

import { translate } from './translator.js';
import { convertToHondurasTime, formatHondurasDate } from './engine.js';

let activeTabId = 'tab-groups';
let currentEditingMatch = null;

/**
 * Parses scorers string from API database format.
 * Handles Postgres array format (e.g. "{“Player 9'”,”Player 67'”}"), JSON arrays, and CSV.
 * @param {string} scorersStr 
 * @returns {Array<string>} List of scorers
 */
function parseScorers(scorersStr) {
    if (!scorersStr || scorersStr === 'null' || scorersStr === 'undefined' || scorersStr.trim() === '') return [];
    
    let clean = scorersStr.trim();
    if (clean.startsWith('{') && clean.endsWith('}')) {
        clean = clean.slice(1, -1);
    }
    if (clean.startsWith('[') && clean.endsWith(']')) {
        clean = clean.slice(1, -1);
    }
    
    clean = clean.replace(/[“”"]/g, '');
    
    return clean.split(',')
        .map(s => s.trim())
        .filter(s => s && s !== 'null' && s !== 'undefined');
}

/**
 * Initializes UI Event Listeners (tabs, search, filters, modals)
 * @param {Object} appState - Global application state
 * @param {Function} onStateChange - Callback function when state changes (saves/recalculates)
 */
export function initUI(appState, onStateChange) {
    // 1. Tab Switching
    const tabButtons = document.querySelectorAll('.nav-tab');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            activeTabId = btn.getAttribute('data-tab');
            document.getElementById(activeTabId).classList.add('active');
            
            renderActiveTab(appState);
        });
    });

    // 2. Search & Filters
    document.getElementById('search-team').addEventListener('input', () => {
        if (activeTabId === 'tab-matches') renderMatches(appState);
    });
    document.getElementById('filter-phase').addEventListener('change', () => {
        if (activeTabId === 'tab-matches') renderMatches(appState);
    });
    document.getElementById('filter-group').addEventListener('change', () => {
        if (activeTabId === 'tab-matches') renderMatches(appState);
    });
    document.getElementById('filter-date').addEventListener('change', () => {
        if (activeTabId === 'tab-matches') renderMatches(appState);
    });
    document.getElementById('btn-clear-filters').addEventListener('click', () => {
        document.getElementById('search-team').value = '';
        document.getElementById('filter-phase').value = 'all';
        document.getElementById('filter-group').value = 'all';
        document.getElementById('filter-date').value = '';
        renderMatches(appState);
        showToast('Filtros limpiados 🧹');
    });

    // 3. Theme Toggle
    const themeBtn = document.getElementById('theme-toggle');
    const sunIcon = themeBtn.querySelector('.theme-icon-light');
    const moonIcon = themeBtn.querySelector('.theme-icon-dark');
    
    // Load theme
    const savedTheme = localStorage.getItem('wc26_theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }

    themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        if (isDark) {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
            localStorage.setItem('wc26_theme', 'light');
        } else {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
            localStorage.setItem('wc26_theme', 'dark');
        }
    });

    // 4. Modal Handlers
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-score').addEventListener('click', closeModal);
    
    // Auto-select penalty choice visually when checked
    document.querySelectorAll('input[name="penalty-winner"]').forEach(input => {
        input.addEventListener('change', (e) => {
            document.querySelectorAll('.penalty-choice').forEach(lbl => {
                lbl.style.borderColor = 'var(--border-color)';
                lbl.style.background = 'transparent';
            });
            const selectedLabel = e.target.closest('.penalty-choice');
            if (selectedLabel) {
                selectedLabel.style.borderColor = 'var(--accent-gold)';
                selectedLabel.style.background = 'rgba(245, 158, 11, 0.08)';
            }
        });
    });

    // Save Score Button
    document.getElementById('btn-save-score').addEventListener('click', () => {
        if (!currentEditingMatch) return;
        
        const score1Val = document.getElementById('modal-score1').value;
        const score2Val = document.getElementById('modal-score2').value;
        const scorers1Val = document.getElementById('modal-scorers1').value;
        const scorers2Val = document.getElementById('modal-scorers2').value;

        if (score1Val === '' || score2Val === '') {
            alert('Por favor, ingresa los goles para ambos equipos.');
            return;
        }

        const s1 = parseInt(score1Val);
        const s2 = parseInt(score2Val);
        
        // Handle penalty shootout if knockout draw
        let penaltyWinner = null;
        if (currentEditingMatch.type !== 'group' && s1 === s2) {
            const selectedRadio = document.querySelector('input[name="penalty-winner"]:checked');
            if (!selectedRadio) {
                alert('En eliminatorias, debe seleccionar un equipo que avance por penales.');
                return;
            }
            penaltyWinner = selectedRadio.value;
        }

        // Apply changes to match
        currentEditingMatch.home_score = String(s1);
        currentEditingMatch.away_score = String(s2);
        
        // Format scorers for storing in match
        const list1 = scorers1Val.split(',').map(s => s.trim()).filter(Boolean);
        const list2 = scorers2Val.split(',').map(s => s.trim()).filter(Boolean);
        
        currentEditingMatch.home_scorers = list1.length > 0 ? `{${list1.map(s => `“${s}”`).join(',')}}` : 'null';
        currentEditingMatch.away_scorers = list2.length > 0 ? `{${list2.map(s => `“${s}”`).join(',')}}` : 'null';

        currentEditingMatch.finished = 'TRUE';
        currentEditingMatch.penalty_winner = penaltyWinner;
        currentEditingMatch.isSimulated = true;

        onStateChange(); // Notify engine to update standings/bracket
        closeModal();
        showToast('Marcador guardado y simulado.');
    });

    // Helper to toggle sync status visibility depending on mode
    const toggleSyncStatusVisibility = (mode) => {
        const statusEl = document.getElementById('sync-status');
        if (statusEl) {
            if (mode === 'simulator') {
                statusEl.classList.add('hidden');
            } else {
                statusEl.classList.remove('hidden');
            }
        }
    };

    // 5. Mode Toggle (Official vs Simulator)
    const modeToggle = document.getElementById('mode-toggle');
    modeToggle.checked = appState.mode === 'simulator';
    toggleSyncStatusVisibility(appState.mode);
    
    modeToggle.addEventListener('change', (e) => {
        appState.mode = e.target.checked ? 'simulator' : 'official';
        localStorage.setItem('wc26_app_mode', appState.mode);
        
        toggleSyncStatusVisibility(appState.mode);
        
        const resetBtn = document.getElementById('btn-reset');
        if (appState.mode === 'simulator') {
            resetBtn.classList.remove('hidden');
        } else {
            resetBtn.classList.add('hidden');
        }
        
        onStateChange(true); // reload state to match mode (e.g. loads simulated matches or resets to official)
        showToast(appState.mode === 'simulator' ? 'Modo Simulador activado. Haz clic en partidos para editarlos.' : 'Modo Oficial activado. Mostrando datos reales.');
    });

    // Reset button
    const resetBtn = document.getElementById('btn-reset');
    if (appState.mode === 'simulator') {
        resetBtn.classList.remove('hidden');
    }
    resetBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas restablecer todas tus predicciones? Volverás a los resultados oficiales.')) {
            appState.clearSimulations();
            onStateChange(true);
            showToast('Predicciones restablecidas.');
        }
    });

    // Manual Live Sync Button
    const syncBtn = document.getElementById('btn-sync-now');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            appState.syncLiveScores(() => renderActiveTab(appState));
        });
    }

    // Show initial content
    document.getElementById('loader').classList.add('hidden');
    renderActiveTab(appState);
}

/**
 * Renders the active tab based on state
 * @param {Object} appState 
 */
export function renderActiveTab(appState) {
    if (activeTabId === 'tab-groups') {
        renderGroups(appState);
    } else if (activeTabId === 'tab-matches') {
        renderMatches(appState);
    } else if (activeTabId === 'tab-bracket') {
        renderBracket(appState);
    } else if (activeTabId === 'tab-stats') {
        renderStats(appState);
    }
}

/**
 * Render Groups View
 * @param {Object} appState 
 */
function renderGroups(appState) {
    const container = document.getElementById('groups-container');
    container.innerHTML = '';

    appState.standings.forEach(g => {
        const card = document.createElement('div');
        card.className = 'glass-card group-card';
        
        // Group Header
        let html = `<h3>Grupo ${g.group}</h3>`;
        
        // Standings Table
        html += `
        <table class="standings-table">
            <thead>
                <tr>
                    <th class="col-team">Equipo</th>
                    <th>PJ</th>
                    <th>G</th>
                    <th>E</th>
                    <th>P</th>
                    <th>DG</th>
                    <th class="col-pts">PTS</th>
                </tr>
            </thead>
            <tbody>
        `;

        g.teams.forEach((t, idx) => {
            // Apply qualify indicator classes (1st and 2nd qualifying directly, next best thirds might qualify)
            let qualifyClass = '';
            if (idx === 0 || idx === 1) {
                qualifyClass = 'qualify-direct'; // Green line
            } else if (idx === 2) {
                qualifyClass = 'qualify-third'; // Gold line (candidate for best third)
            }

            const teamNameSp = translate(t.name);
            const teamFlag = t.flag || 'https://flagcdn.com/w80/un.png'; // fallback flag
            
            html += `
                <tr class="${qualifyClass}">
                    <td class="col-team">
                        <div class="standings-team-cell">
                            <span class="team-position">${idx + 1}</span>
                            <img class="mini-flag" src="${teamFlag}" alt="${t.name}">
                            <span class="team-name-txt" title="${teamNameSp}">${teamNameSp}</span>
                        </div>
                    </td>
                    <td>${t.mp}</td>
                    <td>${t.w}</td>
                    <td>${t.d}</td>
                    <td>${t.l}</td>
                    <td>${t.gd > 0 ? '+' + t.gd : t.gd}</td>
                    <td class="col-pts">${t.pts}</td>
                </tr>
            `;
        });

        html += `
            </tbody>
        </table>
        `;
        
        card.innerHTML = html;
        container.appendChild(card);
    });
}

/**
 * Render Matches/Calendario View
 * @param {Object} appState 
 */
function renderMatches(appState) {
    const container = document.getElementById('matches-container');
    container.innerHTML = '';

    const searchTerm = document.getElementById('search-team').value.toLowerCase();
    const filterPhase = document.getElementById('filter-phase').value;
    const filterGroup = document.getElementById('filter-group').value;
    const filterDate = document.getElementById('filter-date').value;

    const filteredMatches = appState.matches.filter(m => {
        const hTeam = appState.teamsMap[m.home_team_id];
        const aTeam = appState.teamsMap[m.away_team_id];

        const hNameSp = hTeam ? translate(hTeam.name_en) : translate(m.home_team_label);
        const aNameSp = aTeam ? translate(aTeam.name_en) : translate(m.away_team_label);

        // Search term filter
        const matchesSearch = hNameSp.toLowerCase().includes(searchTerm) || 
                              aNameSp.toLowerCase().includes(searchTerm) ||
                              m.group.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;

        // Phase filter
        if (filterPhase === 'group' && m.type !== 'group') return false;
        if (filterPhase === 'knockout' && m.type === 'group') return false;

        // Group filter
        if (filterGroup !== 'all' && m.group !== filterGroup) return false;

        // Date filter
        if (filterDate) {
            const hDate = convertToHondurasTime(m.local_date, m.stadium_id);
            // Format to YYYY-MM-DD
            const y = hDate.getUTCFullYear();
            const mMonth = String(hDate.getUTCMonth() + 1).padStart(2, '0');
            const d = String(hDate.getUTCDate()).padStart(2, '0');
            const dateStr = `${y}-${mMonth}-${d}`;
            if (dateStr !== filterDate) return false;
        }

        return true;
    });

    // Sort matches chronologically in Honduras Time (UTC-6)
    filteredMatches.sort((a, b) => {
        const dateA = convertToHondurasTime(a.local_date, a.stadium_id);
        const dateB = convertToHondurasTime(b.local_date, b.stadium_id);
        
        const diff = dateA.getTime() - dateB.getTime();
        if (diff !== 0) return diff;
        
        // Secondary sort by ID to ensure stable sorting order
        return parseInt(a.id) - parseInt(b.id);
    });

    if (filteredMatches.length === 0) {
        container.innerHTML = '<div class="no-results-msg">No se encontraron partidos para los filtros seleccionados.</div>';
        return;
    }

    filteredMatches.forEach(m => {
        const card = document.createElement('div');
        card.className = 'glass-card match-card';
        if (appState.mode === 'simulator') {
            card.classList.add('editable-match');
        }
        if (m.isSimulated) {
            card.classList.add('simulated-match');
        }

        // Teams lookup
        const hTeam = appState.teamsMap[m.home_team_id];
        const aTeam = appState.teamsMap[m.away_team_id];

        const hNameSp = hTeam ? translate(hTeam.name_en) : translate(m.home_team_label);
        const aNameSp = aTeam ? translate(aTeam.name_en) : translate(m.away_team_label);

        const hFlag = hTeam ? hTeam.flag : 'https://flagcdn.com/w80/un.png';
        const aFlag = aTeam ? aTeam.flag : 'https://flagcdn.com/w80/un.png';

        // Timezone conversion to Honduras Time
        const hDate = convertToHondurasTime(m.local_date, m.stadium_id);
        const dateStr = formatHondurasDate(hDate);

        // Stadium details
        const stadium = appState.stadiumsMap[m.stadium_id];
        const venueName = stadium ? `${stadium.name_en}, ${stadium.city_en}` : `Estadio ${m.stadium_id}`;

        // Status Badge
        let statusClass = 'not-started';
        let statusText = 'NO INICIADO';
        const isLive = m.time_elapsed && m.time_elapsed !== 'notstarted' && m.time_elapsed !== 'finished';
        const isFinished = m.finished === 'TRUE' || m.finished === true;

        if (isFinished) {
            statusClass = 'finished';
            statusText = 'FINALIZADO';
        } else if (isLive) {
            statusClass = 'live';
            statusText = m.time_elapsed === 'live' ? 'EN CURSO' : `EN CURSO - ${m.time_elapsed}`;
        }

        const isKnockout = m.type !== 'group';
        const showScore = isFinished || isLive;
        let scoreDisplayHtml = '';
        
        if (showScore) {
            // Show score
            scoreDisplayHtml = `
                <div class="match-score-display ${isLive ? 'live-score-badge' : ''}">
                    <span>${m.home_score}</span>
                    <span class="score-divider">-</span>
                    <span>${m.away_score}</span>
                </div>
            `;
        } else {
            // Show date and time
            const h = hDate.getUTCHours();
            const mMin = hDate.getUTCMinutes();
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayHours = h % 12 || 12;
            const displayMinutes = String(mMin).padStart(2, '0');
            const timeStr = `${displayHours}:${displayMinutes} ${ampm}`;
            const dateShort = `${hDate.getUTCDate()} de ${hDate.toLocaleString('es-ES', { month: 'short', timeZone: 'UTC' })}`;
            
            scoreDisplayHtml = `
                <div class="match-time-display">
                    <span class="time">${timeStr}</span>
                    <span class="date-short">${dateShort}</span>
                </div>
            `;
        }

        // Goalscorers timeline display
        const homeScorers = parseScorers(m.home_scorers);
        const awayScorers = parseScorers(m.away_scorers);
        const hasScorers = homeScorers.length > 0 || awayScorers.length > 0;
        
        let scorersHtml = '';
        if (hasScorers) {
            scorersHtml = `
                <div class="match-scorers-container">
                    <div class="home-scorers-list">
                        ${homeScorers.map(s => `<div class="scorer-item">⚽ ${s}</div>`).join('')}
                    </div>
                    <div class="scorers-spacer"></div>
                    <div class="away-scorers-list">
                        ${awayScorers.map(s => `<div class="scorer-item">${s} ⚽</div>`).join('')}
                    </div>
                </div>
            `;
        }

        // Render card
        card.innerHTML = `
            <div class="match-header">
                <span class="match-id-badge">Partido ${m.id}</span>
                <span class="match-phase-name">${m.type === 'group' ? 'Grupo ' + m.group : translate(m.group)}</span>
                <span class="match-status-badge ${statusClass}">${statusText}</span>
            </div>
            
            <div class="match-body-grid">
                <!-- Home Team -->
                <div class="match-team team-home">
                    <span class="match-team-name" title="${hNameSp}">${hNameSp}</span>
                    <img class="match-flag" src="${hFlag}" alt="${hNameSp}">
                </div>
                
                <!-- Score or Time -->
                ${scoreDisplayHtml}
                
                <!-- Away Team -->
                <div class="match-team team-away">
                    <img class="match-flag" src="${aFlag}" alt="${aNameSp}">
                    <span class="match-team-name" title="${aNameSp}">${aNameSp}</span>
                </div>
            </div>
            
            ${scorersHtml}
            
            <div class="match-footer">
                <span class="match-stadium" title="${venueName}">📍 ${venueName}</span>
                ${appState.mode === 'simulator' ? '<span class="match-score-display-hint match-indicator-hint">Simular ✍️</span>' : ''}
            </div>
        `;

        if (appState.mode === 'simulator') {
            card.addEventListener('click', () => openScoreModal(m, appState));
        }

        container.appendChild(card);
    });
}

/**
 * Render Knockout Stage Bracket View
 * @param {Object} appState 
 */
function renderBracket(appState) {
    const container = document.getElementById('bracket-container');
    container.innerHTML = '';

    // We filter the matches for each round of the knockout stage
    const r32Matches = appState.matches.filter(m => m.type === 'r32');
    const r16Matches = appState.matches.filter(m => m.type === 'r16');
    const qfMatches = appState.matches.filter(m => m.type === 'qf');
    const sfMatches = appState.matches.filter(m => m.type === 'sf');
    const finalMatch = appState.matches.find(m => m.type === 'final');
    const thirdMatch = appState.matches.find(m => m.type === 'third');

    // Create rounds structure
    const roundData = [
        { name: 'Dieciseisavos (R32)', matches: r32Matches },
        { name: 'Octavos de Final', matches: r16Matches },
        { name: 'Cuartos de Final', matches: qfMatches },
        { name: 'Semifinales', matches: sfMatches },
        { name: 'Final', matches: finalMatch ? [finalMatch] : [], isFinal: true },
        { name: 'Tercer Lugar', matches: thirdMatch ? [thirdMatch] : [], isThirdPlace: true }
    ];

    // Append columns for rounds
    roundData.forEach((r, roundIdx) => {
        const col = document.createElement('div');
        col.className = 'bracket-round';
        if (r.isFinal) col.classList.add('final-round-col');
        if (r.isThirdPlace) col.classList.add('third-place-col');
        
        let matchesHtml = '';

        r.matches.forEach(m => {
            const hTeam = appState.teamsMap[m.home_team_id];
            const aTeam = appState.teamsMap[m.away_team_id];

            const hNameSp = hTeam ? translate(hTeam.name_en) : translate(m.home_team_label);
            const aNameSp = aTeam ? translate(aTeam.name_en) : translate(m.away_team_label);

            const hFlag = hTeam ? hTeam.flag : 'https://flagcdn.com/w80/un.png';
            const aFlag = aTeam ? aTeam.flag : 'https://flagcdn.com/w80/un.png';

            const hScore = (m.finished === 'TRUE' || m.finished === true) ? m.home_score : '';
            const aScore = (m.finished === 'TRUE' || m.finished === true) ? m.away_score : '';

            // Check winner classes
            let hWinnerClass = '';
            let aWinnerClass = '';
            if (m.finished === 'TRUE' || m.finished === true) {
                const s1 = parseInt(m.home_score) || 0;
                const s2 = parseInt(m.away_score) || 0;
                if (s1 > s2 || (s1 === s2 && m.penalty_winner === '1')) {
                    hWinnerClass = 'winner';
                } else if (s2 > s1 || (s1 === s2 && m.penalty_winner === '2')) {
                    aWinnerClass = 'winner';
                }
            }

            const hDate = convertToHondurasTime(m.local_date, m.stadium_id);
            const bh = hDate.getUTCHours();
            const bm = hDate.getUTCMinutes();
            const bAmpm = bh >= 12 ? 'PM' : 'AM';
            const bHours = bh % 12 || 12;
            const bMinutes = String(bm).padStart(2, '0');
            const bTimeStr = `${bHours}:${bMinutes} ${bAmpm}`;
            const dateShort = `${hDate.getUTCDate()} ${hDate.toLocaleString('es-ES', { month: 'short', timeZone: 'UTC' })} ${bTimeStr}`;

            const simulatedClass = m.isSimulated ? 'simulated-match' : '';
            const editableClass = appState.mode === 'simulator' ? 'editable-match' : '';
            const finalClass = r.isFinal ? 'final-match-card' : '';
            const finalBadge = r.isFinal ? '<div class="final-badge">🏆 GRAN FINAL</div>' : '';

            matchesHtml += `
                <div class="bracket-match ${simulatedClass} ${editableClass} ${finalClass}" data-match-id="${m.id}">
                    ${finalBadge}
                    <div class="bracket-match-meta">
                        <span>P. ${m.id}</span>
                        <span>${dateShort}</span>
                    </div>
                    
                    <!-- Home Team -->
                    <div class="bracket-match-team ${hWinnerClass}" data-team-id="${m.home_team_id}">
                        <div class="bracket-team-info">
                            <img class="team-flag" src="${hFlag}" alt="${hNameSp}">
                            <span class="team-name">${hNameSp}</span>
                        </div>
                        <span class="bracket-team-score">${hScore}</span>
                    </div>
                    
                    <!-- Away Team -->
                    <div class="bracket-match-team ${aWinnerClass}" data-team-id="${m.away_team_id}">
                        <div class="bracket-team-info">
                            <img class="team-flag" src="${aFlag}" alt="${aNameSp}">
                            <span class="team-name">${aNameSp}</span>
                        </div>
                        <span class="bracket-team-score">${aScore}</span>
                    </div>
                </div>
            `;
        });

        col.innerHTML = `
            <div class="bracket-round-header">${r.name}</div>
            <div class="bracket-round-matches">
                ${matchesHtml}
            </div>
        `;
        container.appendChild(col);
    });

    // 3. Attach Score Modal Click Listeners for Bracket Matches
    if (appState.mode === 'simulator') {
        const matchesElements = container.querySelectorAll('.bracket-match.editable-match');
        matchesElements.forEach(el => {
            el.addEventListener('click', () => {
                const matchId = el.getAttribute('data-match-id');
                const m = appState.matches.find(x => x.id === matchId);
                if (m) openScoreModal(m, appState);
            });
        });
    }

    // 4. Attach Path Highlighting Hover Events
    const teamRows = container.querySelectorAll('.bracket-match-team');
    teamRows.forEach(row => {
        const teamId = row.getAttribute('data-team-id');
        // Do not highlight TBD team (id 0)
        if (!teamId || teamId === '0') return;

        row.addEventListener('mouseenter', () => {
            const matchesOfTeam = container.querySelectorAll(`.bracket-match-team[data-team-id="${teamId}"]`);
            matchesOfTeam.forEach(r => {
                r.classList.add('highlight-team-row');
                const parentMatch = r.closest('.bracket-match');
                if (parentMatch) parentMatch.classList.add('highlight-path');
            });
        });

        row.addEventListener('mouseleave', () => {
            const matchesOfTeam = container.querySelectorAll(`.bracket-match-team[data-team-id="${teamId}"]`);
            matchesOfTeam.forEach(r => {
                r.classList.remove('highlight-team-row');
                const parentMatch = r.closest('.bracket-match');
                if (parentMatch) parentMatch.classList.remove('highlight-path');
            });
        });
    });

    // 5. Setup Drag to Scroll on Desktop
    setupDragToScroll(document.querySelector('.bracket-outer-wrapper'));
}

/**
 * Enable drag to scroll for bracket columns (Desktop UX)
 * @param {HTMLElement} slider 
 */
function setupDragToScroll(slider) {
    if (!slider) return;
    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.style.cursor = 'grabbing';
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    
    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.style.cursor = 'grab';
    });
    
    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.style.cursor = 'grab';
    });
    
    slider.addEventListener('mousemove', (e) => {
        if(!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // scroll speed
        slider.scrollLeft = scrollLeft - walk;
    });
}

/**
 * Open score editor modal
 * @param {Object} match - Match object to edit
 * @param {Object} appState 
 */
function openScoreModal(match, appState) {
    currentEditingMatch = match;

    const hTeam = appState.teamsMap[match.home_team_id];
    const aTeam = appState.teamsMap[match.away_team_id];

    // Team names and flags
    const hNameSp = hTeam ? translate(hTeam.name_en) : translate(match.home_team_label);
    const aNameSp = aTeam ? translate(aTeam.name_en) : translate(match.away_team_label);

    const hFlag = hTeam ? hTeam.flag : 'https://flagcdn.com/w80/un.png';
    const aFlag = aTeam ? aTeam.flag : 'https://flagcdn.com/w80/un.png';

    document.getElementById('modal-name1').innerText = hNameSp;
    document.getElementById('modal-name2').innerText = aNameSp;
    document.getElementById('modal-flag1').src = hFlag;
    document.getElementById('modal-flag2').src = aFlag;

    // Scores
    document.getElementById('modal-score1').value = (match.finished === 'TRUE' || match.finished === true) ? match.home_score : '';
    document.getElementById('modal-score2').value = (match.finished === 'TRUE' || match.finished === true) ? match.away_score : '';

    // Scorers
    const homeScorersList = parseScorers(match.home_scorers);
    const awayScorersList = parseScorers(match.away_scorers);
    document.getElementById('modal-scorers1').value = homeScorersList.join(', ');
    document.getElementById('modal-scorers2').value = awayScorersList.join(', ');

    // Metadata
    const hDate = convertToHondurasTime(match.local_date, match.stadium_id);
    const dateStr = formatHondurasDate(hDate);
    const stadium = appState.stadiumsMap[match.stadium_id];
    const venueName = stadium ? `${stadium.name_en}, ${stadium.city_en}` : `Estadio ${match.stadium_id}`;

    document.getElementById('modal-match-meta').innerText = `Partido ${match.id} • ${match.type === 'group' ? 'Grupo ' + match.group : translate(match.group)}`;
    document.getElementById('modal-match-venue').innerText = `${dateStr} | 📍 ${venueName}`;

    // Setup penalties selector if knockout match
    const penaltyContainer = document.getElementById('penalty-container');
    if (match.type !== 'group') {
        penaltyContainer.classList.remove('hidden');
        document.getElementById('penalty-label-1').innerText = `Avanza ${hNameSp}`;
        document.getElementById('penalty-label-2').innerText = `Avanza ${aNameSp}`;
        
        // Reset radio buttons
        document.querySelectorAll('input[name="penalty-winner"]').forEach(radio => {
            radio.checked = false;
            if (match.penalty_winner === radio.value) {
                radio.checked = true;
            }
        });

        // Trigger visual border update
        const selectedRadio = document.querySelector('input[name="penalty-winner"]:checked');
        document.querySelectorAll('.penalty-choice').forEach(lbl => {
            lbl.style.borderColor = 'var(--border-color)';
            lbl.style.background = 'transparent';
        });
        if (selectedRadio) {
            const selectedLabel = selectedRadio.closest('.penalty-choice');
            if (selectedLabel) {
                selectedLabel.style.borderColor = 'var(--accent-gold)';
                selectedLabel.style.background = 'rgba(245, 158, 11, 0.08)';
            }
        }

        // Toggle penalty visibility based on scores entered
        const scoreInputHandler = () => {
            const s1 = parseInt(document.getElementById('modal-score1').value) || 0;
            const s2 = parseInt(document.getElementById('modal-score2').value) || 0;
            if (s1 === s2) {
                penaltyContainer.classList.remove('hidden');
            } else {
                penaltyContainer.classList.add('hidden');
            }
        };

        document.getElementById('modal-score1').addEventListener('input', scoreInputHandler);
        document.getElementById('modal-score2').addEventListener('input', scoreInputHandler);
    } else {
        penaltyContainer.classList.add('hidden');
    }

    // Show modal
    document.getElementById('modal-score').classList.add('active');
}

/**
 * Close score editor modal
 */
function closeModal() {
    document.getElementById('modal-score').classList.remove('active');
    currentEditingMatch = null;
}

/**
 * Launches a temporary toast message to notify user
 * @param {string} msg 
 */
function showToast(msg) {
    // Check if toast already exists
    let toast = document.querySelector('.toast-msg');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast-msg';
        document.body.appendChild(toast);
    }
    
    toast.innerText = msg;
    toast.classList.add('active');
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 2500);
}

/**
 * Render Statistics View (Top Goalscorers and Top Assists)
 * @param {Object} appState 
 */
function renderStats(appState) {
    const scorersContainer = document.getElementById('scorers-list-container');
    const assistsContainer = document.getElementById('assists-list-container');
    
    if (!scorersContainer || !assistsContainer) return;
    
    // 1. Calculate Goalscorers dynamically
    const goalsMap = {}; // name -> { name, teamId, goals }
    
    appState.matches.forEach(m => {
        // Only count if there are goals scored
        const homeScorers = parseScorers(m.home_scorers);
        const awayScorers = parseScorers(m.away_scorers);
        
        homeScorers.forEach(scorer => {
            const cleanName = scorer.replace(/\s+\d+(?:\+\d+)?'$/, '').trim();
            if (!cleanName) return;
            if (!goalsMap[cleanName]) {
                goalsMap[cleanName] = {
                    name: cleanName,
                    teamId: m.home_team_id,
                    goals: 0
                };
            }
            goalsMap[cleanName].goals++;
        });
        
        awayScorers.forEach(scorer => {
            const cleanName = scorer.replace(/\s+\d+(?:\+\d+)?'$/, '').trim();
            if (!cleanName) return;
            if (!goalsMap[cleanName]) {
                goalsMap[cleanName] = {
                    name: cleanName,
                    teamId: m.away_team_id,
                    goals: 0
                };
            }
            goalsMap[cleanName].goals++;
        });
    });
    
    // Convert to array and sort descending
    const sortedScorers = Object.values(goalsMap).sort((a, b) => {
        if (b.goals !== a.goals) return b.goals - a.goals;
        return a.name.localeCompare(b.name); // alphabetically stable sorting
    });
    
    // Render Goalscorers
    if (sortedScorers.length === 0) {
        scorersContainer.innerHTML = `
            <div class="stats-empty">
                <span class="stats-empty-icon">⚽</span>
                <p>No se han registrado goles todavía.</p>
            </div>
        `;
    } else {
        scorersContainer.innerHTML = sortedScorers.map((player, index) => {
            const rank = index + 1;
            let rankClass = '';
            if (rank === 1) rankClass = 'stats-rank-1';
            else if (rank === 2) rankClass = 'stats-rank-2';
            else if (rank === 3) rankClass = 'stats-rank-3';
            
            const team = appState.teamsMap[player.teamId];
            const teamNameSp = team ? translate(team.name_en) : 'Selección';
            const flagUrl = team ? team.flag : 'https://flagcdn.com/w80/un.png';
            
            return `
                <div class="stats-row">
                    <div class="stats-rank ${rankClass}">${rank}</div>
                    <div class="stats-player-info">
                        <div class="player-avatar-container">
                            <div class="player-avatar">👤</div>
                            <img class="player-flag-badge" src="${flagUrl}" alt="${teamNameSp}">
                        </div>
                        <div class="player-details">
                            <span class="player-name">${player.name}</span>
                            <span class="player-team">${teamNameSp}</span>
                        </div>
                    </div>
                    <div class="stats-value-badge">${player.goals}</div>
                </div>
            `;
        }).join('');
    }
    
    // 2. Render Simulated Assists
    const simulatedAssists = [
        { name: 'Kevin De Bruyne', teamId: '25', assists: 5 },
        { name: 'Lionel Messi', teamId: '37', assists: 4 },
        { name: 'Bruno Fernandes', teamId: '41', assists: 4 },
        { name: 'Antoine Griezmann', teamId: '33', assists: 3 },
        { name: 'Neymar Jr', teamId: '9', assists: 3 }
    ];
    
    // Render Assists
    assistsContainer.innerHTML = simulatedAssists.map((player, index) => {
        const rank = index + 1;
        let rankClass = '';
        if (rank === 1) rankClass = 'stats-rank-1';
        else if (rank === 2) rankClass = 'stats-rank-2';
        else if (rank === 3) rankClass = 'stats-rank-3';
        
        const team = appState.teamsMap[player.teamId];
        const teamNameSp = team ? translate(team.name_en) : 'Selección';
        const flagUrl = team ? team.flag : 'https://flagcdn.com/w80/un.png';
        
        return `
            <div class="stats-row">
                <div class="stats-rank ${rankClass}">${rank}</div>
                <div class="stats-player-info">
                    <div class="player-avatar-container">
                        <div class="player-avatar">👤</div>
                        <img class="player-flag-badge" src="${flagUrl}" alt="${teamNameSp}">
                    </div>
                    <div class="player-details">
                        <span class="player-name">${player.name}</span>
                        <span class="player-team">${teamNameSp}</span>
                    </div>
                </div>
                <div class="stats-value-badge">${player.assists}</div>
            </div>
        `;
    }).join('');
}
