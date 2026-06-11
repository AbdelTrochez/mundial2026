// Main Application Coordinator (App Controller)

import { 
    loadOfficialData, 
    getAppMode, 
    loadSimulatedMatches, 
    saveSimulatedMatches, 
    saveSimulatedStandings, 
    clearSimulatedData 
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
