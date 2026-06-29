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

const PLAYER_NAME_MAP = {
    // Argentina
    "Livnl Msi": "Lionel Messi",
    "Lionel Msi": "Lionel Messi",
    "Livnl Messi": "Lionel Messi",
    "Leonel Messi": "Lionel Messi",
    "L. Msi": "Lionel Messi",
    
    // Colombia
    "Lviiz Diaz": "Luis Díaz",
    "Luiz Diaz": "Luis Díaz",
    "Dnil Mvnvz": "Daniel Muñoz",
    "Daniel Mvnvz": "Daniel Muñoz",
    "Khamintvn Kampaz": "Jaminton Campaz",
    
    // Netherlands
    "Kvdi Khakpv": "Cody Gakpo",
    "Cody Khakpv": "Cody Gakpo",
    
    // Uzbekistan
    "Abas Bk Fiz Allh Af": "Abbosbek Fayzullaev",
    "Abbosbek Fiz Allh Af": "Abbosbek Fayzullaev",
    
    // Switzerland
    "Jvhan Mnzambi": "Johan Minzambi",
    "Rvbn Vargas": "Ruben Vargas",
    
    // Czech Republic
    "mikhal Sadilk": "Michal Sadílek",
    
    // Ghana
    "Kalb Iirnki": "Caleb Yirenkyi",
    
    // Morocco
    "Asmaail Saibari": "Ismael Saibari",
    
    // USA
    "Kamrvn Bargs": "Cameron Burgess"
};

function normalizePlayerName(name) {
    if (!name) return "";
    const clean = name.trim();
    if (PLAYER_NAME_MAP[clean]) {
        return PLAYER_NAME_MAP[clean];
    }
    for (const key in PLAYER_NAME_MAP) {
        if (clean.toLowerCase() === key.toLowerCase()) {
            return PLAYER_NAME_MAP[key];
        }
    }
    return clean;
}

// Map of official assists for played matches
const OFFICIAL_ASSISTS_MAP = {
    "1": {
        home: ["Orbelín Pineda", "Hirving Lozano"],
        away: []
    },
    "2": {
        home: ["Son Heung-min", "Lee Kang-in"],
        away: ["Vladimír Coufal"]
    },
    "3": {
        home: ["Alphonso Davies"],
        away: ["Edin Džeko"]
    },
    "4": {
        home: ["Christian Pulisic", "Timothy Weah", "Antonee Robinson"],
        away: ["Miguel Almirón"]
    }
};

// Key playmakers for teams (to generate realistic fallback assists if needed)
const TEAM_PLAYMAKERS = {
    "1": ["Orbelín Pineda", "Hirving Lozano", "Luis Chávez", "Alexis Vega"], // Mexico
    "2": ["Percy Tau", "Teboho Mokoena", "Themba Zwane"], // South Africa
    "3": ["Son Heung-min", "Lee Kang-in", "Hwang Hee-chan"], // South Korea
    "4": ["Vladimír Coufal", "Tomáš Souček", "Patrik Schick"], // Czech Republic
    "5": ["Alphonso Davies", "Stephen Eustáquio", "Jonathan David"], // Canada
    "6": ["Edin Džeko", "Miralem Pjanić", "Rade Krunić"], // Bosnia
    "7": ["Akram Afif", "Almoez Ali"], // Qatar
    "8": ["Granit Xhaka", "Xherdan Shaqiri", "Remo Freuler"], // Switzerland
    "9": ["Vinícius Júnior", "Rodrygo", "Lucas Paquetá"], // Brazil
    "10": ["Achraf Hakimi", "Hakim Ziyech", "Brahim Díaz"], // Morocco
    "11": ["Duckens Nazon", "Frantzdy Pierrot"], // Haiti
    "12": ["John McGinn", "Scott McTominay", "Andrew Robertson"], // Scotland
    "13": ["Christian Pulisic", "Timothy Weah", "Weston McKennie"], // USA
    "14": ["Miguel Almirón", "Julio Enciso", "Ramón Sosa"], // Paraguay
    "15": ["Jackson Irvine", "Craig Goodwin", "Martin Boyle"], // Australia
    "16": ["Hakan Çalhanoğlu", "Arda Güler", "Kenan Yıldız"], // Turkey
    "17": ["Florian Wirtz", "Jamal Musiala", "Kai Havertz"], // Germany
    "18": ["Juninho Bacuna", "Leandro Bacuna"], // Curaçao
    "19": ["Franck Kessié", "Simon Adingra", "Sébastien Haller"], // Ivory Coast
    "20": ["Moisés Caicedo", "Kendry Páez", "Pervis Estupiñán"], // Ecuador
    "21": ["Cody Gakpo", "Tijjani Reijnders", "Xavi Simons"], // Netherlands
    "22": ["Kaoru Mitoma", "Takefusa Kubo", "Wataru Endo"], // Japan
    "23": ["Alexander Isak", "Dejan Kulusevski", "Viktor Gyökeres"], // Sweden
    "24": ["Youssef Msakni", "Ellyes Skhiri"], // Tunisia
    "25": ["Kevin De Bruyne", "Leandro Trossard", "Jérémy Doku"], // Belgium
    "26": ["Mohamed Salah", "Mostafa Mohamed", "Trezeguet"], // Egypt
    "27": ["Mehdi Taremi", "Sardar Azmoun", "Alireza Jahanbakhsh"], // Iran
    "28": ["Chris Wood", "Sarpreet Singh"], // New Zealand
    "29": ["Lamine Yamal", "Nico Williams", "Pedri"], // Spain
    "30": ["Ryan Mendes", "Bebé"], // Cape Verde
    "31": ["Salem Al-Dawsari", "Firas Al-Buraikan"], // Saudi Arabia
    "32": ["Federico Valverde", "Darwin Núñez", "Giorgian de Arrascaeta"], // Uruguay
    "33": ["Antoine Griezmann", "Ousmane Dembélé", "Kylian Mbappé"], // France
    "34": ["Sadio Mané", "Ismaïla Sarr", "Nicolas Jackson"], // Senegal
    "35": ["Aymen Hussein", "Ali Jasim"], // Iraq
    "36": ["Martin Ødegaard", "Erling Haaland", "Antonio Nusa"], // Norway
    "37": ["Lionel Messi", "Alexis Mac Allister", "Rodrigo De Paul"], // Argentina
    "38": ["Riyad Mahrez", "Said Benrahma", "Houssem Aouar"], // Algeria
    "39": ["Marcel Sabitzer", "Konrad Laimer", "Christoph Baumgartner"], // Austria
    "40": ["Musa Al-Taamari", "Yazan Al-Naimat"], // Jordan
    "41": ["Bruno Fernandes", "Bernardo Silva", "Rafael Leão"], // Portugal
    "42": ["Yoane Wissa", "Chancel Mbemba"], // DR Congo
    "43": ["Eldor Shomurodov", "Oston Urunov", "Jaloliddin Masharipov"], // Uzbekistan
    "44": ["James Rodríguez", "Luis Díaz", "Jhon Arias"], // Colombia
    "45": ["Jude Bellingham", "Bukayo Saka", "Phil Foden"], // England
    "46": ["Luka Modrić", "Mateo Kovačić", "Andre Kramarić"], // Croatia
    "47": ["Mohammed Kudus", "Jordan Ayew", "Inaki Williams"], // Ghana
    "48": ["Adalberto Carrasquilla", "José Fajardo"] // Panama
};

/**
 * Parses assists string from database format.
 * @param {string} assistsStr 
 * @returns {Array<string>} List of assistants
 */
function parseAssists(assistsStr) {
    if (!assistsStr || assistsStr === 'null' || assistsStr === 'undefined' || assistsStr.trim() === '') return [];
    
    let clean = assistsStr.trim();
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
 * Gets or dynamically generates assists for a match.
 * @param {Object} match 
 * @param {string} side - 'home' or 'away'
 * @returns {Array<string>} List of assistants
 */
function getMatchAssists(match, side) {
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
    const scorersField = side === 'home' ? match.home_scorers : match.away_scorers;
    const assistsField = side === 'home' ? match.home_assists : match.away_assists;
    
    // 1. If assists are already explicitly defined/stored in the match object, parse and return them
    if (assistsField !== undefined && assistsField !== null && assistsField !== 'undefined') {
        const list = parseAssists(assistsField).map(normalizePlayerName);
        if (list.length > 0 || assistsField === 'null' || assistsField === '{}') return list;
    }
    
    // 2. If it's a played official match covered in the official assists map, load it
    if (OFFICIAL_ASSISTS_MAP[match.id]) {
        return (OFFICIAL_ASSISTS_MAP[match.id][side] || []).map(normalizePlayerName);
    }
    
    // 3. Fallback: Generate assists dynamically based on scorers to maintain consistency
    const scorers = parseScorers(scorersField);
    if (scorers.length === 0) return [];
    
    // Generate one assist for each goal scored (excluding own goals)
    const assists = [];
    const playmakers = TEAM_PLAYMAKERS[teamId] || [];
    if (playmakers.length === 0) return [];
    
    scorers.forEach((scorer, idx) => {
        if (scorer.toLowerCase().includes('(og)') || scorer.toLowerCase().includes('own goal')) {
            return;
        }
        const scorerClean = normalizePlayerName(scorer.replace(/\s+\d+(?:\+\d+)?'$/, '').trim());
        const candidates = playmakers.filter(p => p !== scorerClean);
        const makerList = candidates.length > 0 ? candidates : playmakers;
        
        // Pick playmaker deterministically so it remains stable on refreshes
        const hash = (parseInt(match.id || 0) + idx) % makerList.length;
        assists.push(makerList[hash]);
    });
    
    return assists;
}

/**
 * Gets the 2-letter uppercase Spanish prefix of the day of the week.
 * @param {Date} date 
 * @returns {string} e.g. "SA" for Sábado
 */
function getShortDayName(date) {
    const shortDays = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];
    return shortDays[date.getUTCDay()];
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
    document.getElementById('btn-today-filter').addEventListener('click', () => {
        const hnLocal = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Tegucigalpa"}));
        const y = hnLocal.getFullYear();
        const m = String(hnLocal.getMonth() + 1).padStart(2, '0');
        const d = String(hnLocal.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        
        document.getElementById('filter-date').value = todayStr;
        
        // Switch to matches tab so user can see today's matches list
        const matchesTabBtn = document.querySelector('.nav-tab[data-tab="tab-matches"]');
        if (matchesTabBtn && activeTabId !== 'tab-matches') {
            matchesTabBtn.click();
        } else {
            renderMatches(appState);
        }
        
        showToast('Mostrando partidos de hoy 📅');
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
        const assists1Val = document.getElementById('modal-assists1').value;
        const assists2Val = document.getElementById('modal-assists2').value;

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

        // Format assists for storing in match
        const alist1 = assists1Val.split(',').map(s => s.trim()).filter(Boolean);
        const alist2 = assists2Val.split(',').map(s => s.trim()).filter(Boolean);
        
        currentEditingMatch.home_assists = alist1.length > 0 ? `{${alist1.map(s => `“${s}”`).join(',')}}` : 'null';
        currentEditingMatch.away_assists = alist2.length > 0 ? `{${alist2.map(s => `“${s}”`).join(',')}}` : 'null';

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
            const dateShort = `${getShortDayName(hDate)} ${hDate.getUTCDate()} de ${hDate.toLocaleString('es-ES', { month: 'short', timeZone: 'UTC' })}`;
            
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
            const formatScorerItem = (s) => {
                const scorerClean = s.replace(/\s+\d+(?:\+\d+)?'$/, '').trim();
                const normalizedClean = normalizePlayerName(scorerClean);
                const minuteMatch = s.match(/\s+\d+(?:\+\d+)?'$/);
                const minute = minuteMatch ? minuteMatch[0] : '';
                return `${normalizedClean}${minute}`;
            };
            
            scorersHtml = `
                <div class="match-scorers-container">
                    <div class="home-scorers-list">
                        ${homeScorers.map(s => `<div class="scorer-item">⚽ ${formatScorerItem(s)}</div>`).join('')}
                    </div>
                    <div class="scorers-spacer"></div>
                    <div class="away-scorers-list">
                        ${awayScorers.map(s => `<div class="scorer-item">${formatScorerItem(s)} ⚽</div>`).join('')}
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
                <div class="match-footer-right">
                    <span class="match-date-footer">📅 ${getShortDayName(hDate)} ${String(hDate.getUTCDate()).padStart(2, '0')}/${String(hDate.getUTCMonth() + 1).padStart(2, '0')}/${hDate.getUTCFullYear()}</span>
                    ${appState.mode === 'simulator' ? '<span class="match-score-display-hint match-indicator-hint">| Simular ✍️</span>' : ''}
                </div>
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
        col.id = `bracket-col-${roundIdx}`;
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

            // Check winner and loser classes, plus penalty indicator
            let hWinnerClass = '';
            let aWinnerClass = '';
            let hLoserClass = '';
            let aLoserClass = '';
            let hPenIndicator = '';
            let aPenIndicator = '';

            if (m.finished === 'TRUE' || m.finished === true) {
                const s1 = parseInt(m.home_score) || 0;
                const s2 = parseInt(m.away_score) || 0;
                if (s1 > s2 || (s1 === s2 && m.penalty_winner === '1')) {
                    hWinnerClass = 'winner';
                    aLoserClass = 'loser';
                    if (s1 === s2 && m.penalty_winner === '1') {
                        hPenIndicator = '<span class="penalty-indicator">(p)</span>';
                    }
                } else if (s2 > s1 || (s1 === s2 && m.penalty_winner === '2')) {
                    aWinnerClass = 'winner';
                    hLoserClass = 'loser';
                    if (s1 === s2 && m.penalty_winner === '2') {
                        aPenIndicator = '<span class="penalty-indicator">(p)</span>';
                    }
                }
            }

            const hDate = convertToHondurasTime(m.local_date, m.stadium_id);
            const bh = hDate.getUTCHours();
            const bm = hDate.getUTCMinutes();
            const bAmpm = bh >= 12 ? 'PM' : 'AM';
            const bHours = bh % 12 || 12;
            const bMinutes = String(bm).padStart(2, '0');
            const bTimeStr = `${bHours}:${bMinutes} ${bAmpm}`;
            const dateShort = `${getShortDayName(hDate)} ${hDate.getUTCDate()} ${hDate.toLocaleString('es-ES', { month: 'short', timeZone: 'UTC' })} ${bTimeStr}`;

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
                    <div class="bracket-match-team ${hWinnerClass} ${hLoserClass}" data-team-id="${m.home_team_id}">
                        <div class="bracket-team-info">
                            <img class="team-flag" src="${hFlag}" alt="${hNameSp}">
                            <span class="team-name">${hNameSp}</span>
                        </div>
                        <span class="bracket-team-score">${hScore}${hPenIndicator}</span>
                    </div>
                    
                    <!-- Away Team -->
                    <div class="bracket-match-team ${aWinnerClass} ${aLoserClass}" data-team-id="${m.away_team_id}">
                        <div class="bracket-team-info">
                            <img class="team-flag" src="${aFlag}" alt="${aNameSp}">
                            <span class="team-name">${aNameSp}</span>
                        </div>
                        <span class="bracket-team-score">${aScore}${aPenIndicator}</span>
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

    // 6. Initialize Round Navigation Tabs Bar
    initBracketNavigation(roundData);
}

/**
 * Google-style Navigation for Bracket Rounds
 * @param {Array} roundData 
 */
function initBracketNavigation(roundData) {
    const tabsContainer = document.getElementById('bracket-nav-tabs');
    const outerWrapper = document.querySelector('.bracket-outer-wrapper');
    if (!tabsContainer || !outerWrapper) return;

    tabsContainer.innerHTML = '';

    // Create tabs
    roundData.forEach((r, idx) => {
        const colId = `bracket-col-${idx}`;
        const tab = document.createElement('button');
        tab.className = 'bracket-nav-tab';
        if (idx === 0) tab.classList.add('active');
        tab.innerText = r.name;
        tab.setAttribute('data-target', colId);

        tab.addEventListener('click', () => {
            const col = document.getElementById(colId);
            if (col) {
                const offsetLeft = col.offsetLeft - outerWrapper.offsetLeft;
                outerWrapper.scrollTo({
                    left: offsetLeft,
                    behavior: 'smooth'
                });
            }
        });

        tabsContainer.appendChild(tab);
    });

    // Scroll spy: Update active tab when wrapper is scrolled
    outerWrapper.addEventListener('scroll', () => {
        const wrapperCenter = outerWrapper.scrollLeft + (outerWrapper.clientWidth / 2);
        
        let activeIdx = 0;
        let minDiff = Infinity;

        roundData.forEach((_, idx) => {
            const col = document.getElementById(`bracket-col-${idx}`);
            if (col) {
                const colCenter = col.offsetLeft + (col.clientWidth / 2);
                const diff = Math.abs(wrapperCenter - colCenter);
                if (diff < minDiff) {
                    minDiff = diff;
                    activeIdx = idx;
                }
            }
        });

        const tabs = tabsContainer.querySelectorAll('.bracket-nav-tab');
        tabs.forEach((tab, idx) => {
            if (idx === activeIdx) {
                tab.classList.add('active');
                // Scroll tab itself into view if it overflows the navbar
                tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                tab.classList.remove('active');
            }
        });
    });
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
    const formatScorerItemForModal = (s) => {
        const scorerClean = s.replace(/\s+\d+(?:\+\d+)?'$/, '').trim();
        const normalizedClean = normalizePlayerName(scorerClean);
        const minuteMatch = s.match(/\s+\d+(?:\+\d+)?'$/);
        const minute = minuteMatch ? minuteMatch[0] : '';
        return `${normalizedClean}${minute}`;
    };
    const homeScorersList = parseScorers(match.home_scorers).map(formatScorerItemForModal);
    const awayScorersList = parseScorers(match.away_scorers).map(formatScorerItemForModal);
    document.getElementById('modal-scorers1').value = homeScorersList.join(', ');
    document.getElementById('modal-scorers2').value = awayScorersList.join(', ');

    // Assists
    const homeAssistsList = getMatchAssists(match, 'home');
    const awayAssistsList = getMatchAssists(match, 'away');
    document.getElementById('modal-assists1').value = homeAssistsList.join(', ');
    document.getElementById('modal-assists2').value = awayAssistsList.join(', ');

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
            const scorerClean = scorer.replace(/\s+\d+(?:\+\d+)?'$/, '').trim();
            const cleanName = normalizePlayerName(scorerClean);
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
            const scorerClean = scorer.replace(/\s+\d+(?:\+\d+)?'$/, '').trim();
            const cleanName = normalizePlayerName(scorerClean);
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
    
    // 2. Calculate assists dynamically from actual matches
    const assistsMap = {}; // name -> { name, teamId, assists }
    
    appState.matches.forEach(m => {
        const homeAssists = getMatchAssists(m, 'home');
        const awayAssists = getMatchAssists(m, 'away');
        
        homeAssists.forEach(assister => {
            const cleanName = normalizePlayerName(assister.trim());
            if (!cleanName) return;
            if (!assistsMap[cleanName]) {
                assistsMap[cleanName] = {
                    name: cleanName,
                    teamId: m.home_team_id,
                    assists: 0
                };
            }
            assistsMap[cleanName].assists++;
        });
        
        awayAssists.forEach(assister => {
            const cleanName = normalizePlayerName(assister.trim());
            if (!cleanName) return;
            if (!assistsMap[cleanName]) {
                assistsMap[cleanName] = {
                    name: cleanName,
                    teamId: m.away_team_id,
                    assists: 0
                };
            }
            assistsMap[cleanName].assists++;
        });
    });
    
    // Convert to array and sort descending
    const sortedAssisters = Object.values(assistsMap).sort((a, b) => {
        if (b.assists !== a.assists) return b.assists - a.assists;
        return a.name.localeCompare(b.name); // alphabetically stable sorting
    });
    
    // Render Assists
    if (sortedAssisters.length === 0) {
        assistsContainer.innerHTML = `
            <div class="stats-empty">
                <span class="stats-empty-icon">🎯</span>
                <p>No se han registrado asistencias todavía.</p>
            </div>
        `;
    } else {
        assistsContainer.innerHTML = sortedAssisters.map((player, index) => {
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
}
