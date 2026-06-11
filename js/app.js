// Main Application Coordinator (App Controller)

import { 
    loadOfficialData, 
    getAppMode, 
    loadSimulatedMatches, 
    saveSimulatedMatches, 
    saveSimulatedStandings, 
    clearSimulatedData,
    fetchLiveMatchesOnly
} from './api.js';

import { 
    calculateStandings, 
    propagateKnockout 
} from './engine.js';

import { 
    initUI, 
    renderActiveTab 
} from './ui.js';

// Global Application State Class
class AppState {
    constructor() {
        this.mode = getAppMode(); // 'official' or 'simulator'
        this.teams = [];
        this.matches = [];
        this.stadiums = [];
        this.standings = [];
        
        // Lookup tables
        this.teamsMap = {};
        this.stadiumsMap = {};
        
        // Cache for official data reset
        this.officialData = null;

        // Background polling
        this.pollingInterval = null;
    }

    /**
     * Initializes the state with fetched data
     */
    async initialize() {
        // Fetch data (handles live vs local fallback)
        this.officialData = await loadOfficialData();
        
        this.teams = this.officialData.teams;
        this.stadiums = this.officialData.stadiums;

        // Build lookup maps
        this.teamsMap = {};
        this.teams.forEach(t => { this.teamsMap[t.id] = t; });

        this.stadiumsMap = {};
        this.stadiums.forEach(s => { this.stadiumsMap[s.id] = s; });

        this.loadStateForCurrentMode();
    }

    /**
     * Configures the matches and standings based on the current mode
     */
    loadStateForCurrentMode() {
        if (this.mode === 'simulator') {
            // Try to load user simulated matches from localStorage
            const savedSimulated = loadSimulatedMatches();
            if (savedSimulated) {
                this.matches = savedSimulated;
            } else {
                // Clone official matches to start simulator
                this.matches = JSON.parse(JSON.stringify(this.officialData.matches));
            }
        } else {
            // Load official matches
            this.matches = JSON.parse(JSON.stringify(this.officialData.matches));
        }

        this.recalculate();
    }

    /**
     * Runs standings calculations and knockout stage winner propagation
     */
    recalculate() {
        // 1. Recalculate group stage tables
        this.standings = calculateStandings(this.matches, this.teams);

        // 2. Propagate teams and winners through knockout stage
        propagateKnockout(this.matches, this.teams, this.standings);
    }

    /**
     * Wipes user predictions and resets to official data
     */
    clearSimulations() {
        clearSimulatedData();
        this.loadStateForCurrentMode();
    }

    /**
     * Starts background live scores synchronization if in official mode
     * @param {Function} onUIUpdate - UI update callback
     */
    startLivePolling(onUIUpdate) {
        if (this.mode !== 'official') return;
        if (this.pollingInterval) clearInterval(this.pollingInterval);

        // Poll every 60 seconds
        this.pollingInterval = setInterval(() => {
            this.syncLiveScores(onUIUpdate);
        }, 60000);
    }

    /**
     * Stops background live scores synchronization
     */
    stopLivePolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Fetches and syncs live scores from GitHub
     * @param {Function} onUIUpdate - UI update callback
     */
    async syncLiveScores(onUIUpdate) {
        if (this.mode !== 'official') return;
        
        const syncDot = document.querySelector('.sync-dot');
        const syncText = document.getElementById('sync-text');
        const syncBtn = document.getElementById('btn-sync-now');

        // Update UI to syncing state
        if (syncDot && syncText) {
            syncDot.className = 'sync-dot syncing';
            syncText.innerText = 'Sincronizando...';
        }
        if (syncBtn) syncBtn.classList.add('spinning');

        try {
            const liveMatches = await fetchLiveMatchesOnly();
            
            // Compare if anything changed
            let changed = false;
            liveMatches.forEach(lm => {
                const current = this.matches.find(m => m.id === lm.id);
                if (current) {
                    if (current.home_score !== lm.home_score || 
                        current.away_score !== lm.away_score || 
                        current.finished !== lm.finished) {
                        
                        current.home_score = lm.home_score;
                        current.away_score = lm.away_score;
                        current.finished = lm.finished;
                        current.home_scorers = lm.home_scorers;
                        current.away_scorers = lm.away_scorers;
                        current.time_elapsed = lm.time_elapsed;
                        changed = true;
                    }
                }
            });

            if (changed) {
                this.recalculate();
                
                // Update official cache to preserve updates in localStorage
                this.officialData.matches = JSON.parse(JSON.stringify(this.matches));
                localStorage.setItem('wc26_official_cache', JSON.stringify(this.officialData));
                
                onUIUpdate(); // Refresh UI
                console.log('Live scores synchronized and UI updated!');
            }

            // Update UI to online state
            setTimeout(() => {
                if (syncDot && syncText) {
                    syncDot.className = 'sync-dot online';
                    syncText.innerText = 'Sincronizado';
                }
                if (syncBtn) syncBtn.classList.remove('spinning');
            }, 500); // minimal delay for visual feedback

        } catch (err) {
            console.error('Error syncing live scores:', err);
            // Update UI to offline state
            if (syncDot && syncText) {
                syncDot.className = 'sync-dot offline';
                syncText.innerText = 'Modo offline';
            }
            if (syncBtn) syncBtn.classList.remove('spinning');
        }
    }
}

// Instantiate Global State
const appState = new AppState();

// Start App
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await appState.initialize();

        // Initialize UI and hook state changes
        initUI(appState, (shouldReloadMode = false) => {
            if (shouldReloadMode) {
                appState.loadStateForCurrentMode();
                if (appState.mode === 'official') {
                    appState.startLivePolling(() => renderActiveTab(appState));
                } else {
                    appState.stopLivePolling();
                }
            } else {
                // If in simulator mode, save predictions
                if (appState.mode === 'simulator') {
                    appState.recalculate();
                    saveSimulatedMatches(appState.matches);
                    saveSimulatedStandings(appState.standings);
                } else {
                    appState.recalculate();
                }
            }
            
            // Rerender the active view
            renderActiveTab(appState);
        });

        // Start initial polling if mode is official
        if (appState.mode === 'official') {
            appState.startLivePolling(() => renderActiveTab(appState));
        }
    } catch (err) {
        console.error('Critical initialization error:', err);
        document.getElementById('loader').innerHTML = `
            <div style="color: #ef4444; font-size: 1.2rem; font-weight: 700; text-align: center; padding: 2rem;">
                ❌ Error al inicializar la aplicación.<br>
                <span style="font-size: 0.9rem; font-weight: 400; color: var(--text-secondary);">
                    Por favor verifica tu conexión de internet o intenta recargar.
                </span>
            </div>
        `;
    }
});
