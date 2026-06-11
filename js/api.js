// Data Fetching and Caching Module (API)

const GITHUB_API_URLS = {
    teams: 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.teams.json',
    matches: 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.matches.json',
    stadiums: 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.stadiums.json',
    standings: 'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.matchtables.json'
};

const LOCAL_FALLBACK_URLS = {
    teams: 'data/teams.json',
    matches: 'data/matches.json',
    stadiums: 'data/stadiums.json',
    standings: 'data/standings.json'
};

const STORAGE_KEYS = {
    MODE: 'wc26_app_mode', // 'official' or 'simulator'
    SIMULATED_MATCHES: 'wc26_simulated_matches',
    SIMULATED_STANDINGS: 'wc26_simulated_standings',
    OFFICIAL_DATA: 'wc26_official_cache'
};

/**
 * Fetches a resource with a local fallback on failure.
 * @param {string} key - The key of GITHUB_API_URLS
 * @returns {Promise<any>} Parsed JSON data
 */
async function fetchResource(key) {
    try {
        const response = await fetch(GITHUB_API_URLS[key]);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.warn(`Failed to fetch ${key} from GitHub. Falling back to local data...`, error);
        const fallbackRes = await fetch(LOCAL_FALLBACK_URLS[key]);
        if (!fallbackRes.ok) throw new Error(`Fallback HTTP error! status: ${fallbackRes.status}`);
        return await fallbackRes.json();
    }
}

/**
 * Loads all official data from the API or local fallback.
 * @returns {Promise<{teams: Array, matches: Array, stadiums: Array, standings: Array}>}
 */
export async function loadOfficialData() {
    // Try to load cached official data first to save bandwidth
    const cache = localStorage.getItem(STORAGE_KEYS.OFFICIAL_DATA);
    if (cache) {
        try {
            return JSON.parse(cache);
        } catch (e) {
            console.error("Error parsing official data cache", e);
        }
    }

    // Fetch all resources concurrently
    const [teams, matches, stadiums, standings] = await Promise.all([
        fetchResource('teams'),
        fetchResource('matches'),
        fetchResource('stadiums'),
        fetchResource('standings')
    ]);

    const data = { teams, matches, stadiums, standings };
    
    // Save to cache
    try {
        localStorage.setItem(STORAGE_KEYS.OFFICIAL_DATA, JSON.stringify(data));
    } catch (e) {
        console.warn("Could not write official cache to localStorage", e);
    }
    
    return data;
}

/**
 * Retrieves the application mode ('official' or 'simulator').
 * @returns {string}
 */
export function getAppMode() {
    return localStorage.getItem(STORAGE_KEYS.MODE) || 'official';
}

/**
 * Saves the application mode.
 * @param {string} mode - 'official' or 'simulator'
 */
export function setAppMode(mode) {
    localStorage.setItem(STORAGE_KEYS.MODE, mode);
}

/**
 * Saves simulated matches to localStorage.
 * @param {Array} matches 
 */
export function saveSimulatedMatches(matches) {
    localStorage.setItem(STORAGE_KEYS.SIMULATED_MATCHES, JSON.stringify(matches));
}

/**
 * Loads simulated matches from localStorage.
 * @returns {Array|null}
 */
export function loadSimulatedMatches() {
    const data = localStorage.getItem(STORAGE_KEYS.SIMULATED_MATCHES);
    return data ? JSON.parse(data) : null;
}

/**
 * Saves simulated standings to localStorage.
 * @param {Array} standings 
 */
export function saveSimulatedStandings(standings) {
    localStorage.setItem(STORAGE_KEYS.SIMULATED_STANDINGS, JSON.stringify(standings));
}

/**
 * Loads simulated standings from localStorage.
 * @returns {Array|null}
 */
export function loadSimulatedStandings() {
    const data = localStorage.getItem(STORAGE_KEYS.SIMULATED_STANDINGS);
    return data ? JSON.parse(data) : null;
}

/**
 * Clears all simulated predictions from localStorage.
 */
export function clearSimulatedData() {
    localStorage.removeItem(STORAGE_KEYS.SIMULATED_MATCHES);
    localStorage.removeItem(STORAGE_KEYS.SIMULATED_STANDINGS);
}
