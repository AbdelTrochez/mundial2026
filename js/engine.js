// Tournament Logic and Timezone Engine

/**
 * Maps each stadium_id to its UTC timezone offset in June/July (Daylight Saving Time in US/Canada)
 * - Mexico City, Guadalajara, Monterrey: UTC-6 (No DST in Mexico)
 * - Dallas, Houston, Kansas City: UTC-5 (CDT)
 * - Toronto, Atlanta, Miami, Boston, NY/NJ, Philadelphia: UTC-4 (EDT)
 * - Vancouver, Seattle, San Francisco, Los Angeles: UTC-7 (PDT)
 */
const STADIUM_OFFSETS = {
    '1': -6,  // Estadio Azteca (Mexico City)
    '2': -6,  // Estadio Akron (Guadalajara)
    '3': -6,  // Estadio BBVA (Monterrey)
    '4': -5,  // AT&T Stadium (Dallas)
    '5': -5,  // NRG Stadium (Houston)
    '6': -5,  // Arrowhead Stadium (Kansas City)
    '7': -4,  // Mercedes-Benz Stadium (Atlanta)
    '8': -4,  // Hard Rock Stadium (Miami)
    '9': -4,  // Gillette Stadium (Boston)
    '10': -4, // Lincoln Financial Field (Philadelphia)
    '11': -4, // MetLife Stadium (NY/NJ)
    '12': -4, // BMO Field (Toronto)
    '13': -7, // BC Place (Vancouver)
    '14': -7, // Lumen Field (Seattle)
    '15': -7, // Levi's Stadium (San Francisco)
    '16': -7  // SoFi Stadium (Los Angeles)
};

/**
 * Converts match local time at the stadium to Honduras time (UTC-6)
 * @param {string} localDateStr - Date string in format "MM/DD/YYYY HH:MM"
 * @param {string|number} stadiumId - Stadium ID
 * @returns {Date} Date object adjusted to Honduras time in its UTC representation
 */
export function convertToHondurasTime(localDateStr, stadiumId) {
    const parts = localDateStr.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/);
    if (!parts) return new Date(localDateStr);
    
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const year = parseInt(parts[3]);
    const hour = parseInt(parts[4]);
    const minute = parseInt(parts[5]);

    const stadiumOffset = STADIUM_OFFSETS[String(stadiumId)] || -6; // Fallback to Honduras offset (UTC-6)
    
    // Treat the local fields as UTC milliseconds
    const localUtcTime = Date.UTC(year, month, day, hour, minute);
    
    // Subtract stadium offset to get true UTC epoch time
    const trueUtcEpoch = localUtcTime - (stadiumOffset * 60 * 60 * 1000);
    
    // Adjust to Honduras local time (UTC-6)
    const hondurasOffset = -6;
    const hondurasEpoch = trueUtcEpoch + (hondurasOffset * 60 * 60 * 1000);
    
    return new Date(hondurasEpoch);
}

/**
 * Formats a Date object in Spanish for Honduras display.
 * @param {Date} date - Date object adjusted to Honduras time (in UTC)
 * @returns {string} e.g. "Jueves 11 de Junio, 13:00"
 */
export function formatHondurasDate(date) {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const dayName = days[date.getUTCDay()];
    const dayNum = date.getUTCDate();
    const monthName = months[date.getUTCMonth()];
    
    const h = date.getUTCHours();
    const m = date.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHours = h % 12 || 12;
    const displayMinutes = String(m).padStart(2, '0');
    
    return `${dayName} ${dayNum} de ${monthName}, ${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Calculates standings for all groups (A to L) based on the matches state.
 * @param {Array} matches - Current matches array
 * @param {Array} teams - Current teams array
 * @returns {Array} List of group standings tables
 */
export function calculateStandings(matches, teams) {
    const teamMap = {};
    teams.forEach(t => {
        teamMap[t.id] = {
            id: t.id,
            name: t.name_en,
            flag: t.flag,
            group: t.groups,
            mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0
        };
    });

    // Process only finished group matches
    matches.forEach(m => {
        if (m.type === 'group' && (m.finished === 'TRUE' || m.finished === true)) {
            const hId = m.home_team_id;
            const aId = m.away_team_id;
            const hScore = parseInt(m.home_score) || 0;
            const aScore = parseInt(m.away_score) || 0;

            if (teamMap[hId] && teamMap[aId]) {
                const home = teamMap[hId];
                const away = teamMap[aId];

                home.mp += 1;
                away.mp += 1;
                home.gf += hScore;
                home.ga += aScore;
                away.gf += aScore;
                away.ga += hScore;

                if (hScore > aScore) {
                    home.w += 1;
                    home.pts += 3;
                    away.l += 1;
                } else if (hScore < aScore) {
                    away.w += 1;
                    away.pts += 3;
                    home.l += 1;
                } else {
                    home.d += 1;
                    away.d += 1;
                    home.pts += 1;
                    away.pts += 1;
                }

                home.gd = home.gf - home.ga;
                away.gd = away.gf - away.ga;
            }
        }
    });

    // Group teams
    const groups = {};
    for (let charCode = 65; charCode <= 76; charCode++) { // A to L
        const grpName = String.fromCharCode(charCode);
        groups[grpName] = [];
    }

    Object.values(teamMap).forEach(team => {
        if (groups[team.group]) {
            groups[team.group].push(team);
        }
    });

    // Sort each group table
    const sortedGroups = [];
    Object.keys(groups).forEach(grpName => {
        const groupTeams = groups[grpName];
        
        groupTeams.sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.gd !== a.gd) return b.gd - a.gd;
            if (b.gf !== a.gf) return b.gf - a.gf;
            // Fallback to team name sorting to remain stable
            return a.name.localeCompare(b.name);
        });

        sortedGroups.push({
            group: grpName,
            teams: groupTeams
        });
    });

    return sortedGroups;
}

/**
 * Identifies the 8 best 3rd placed teams from the 12 sorted groups.
 * @param {Array} standings - Computed group standings
 * @returns {Array} Array of the 8 qualifying third-place team objects
 */
export function getBestThirdPlaces(standings) {
    const thirdPlaces = [];
    
    standings.forEach(g => {
        const thirdTeam = g.teams[2]; // Index 2 is the 3rd place team (0, 1, 2, 3)
        if (thirdTeam) {
            thirdPlaces.push(thirdTeam);
        }
    });

    // Sort 3rd-placed teams
    thirdPlaces.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        if (b.w !== a.w) return b.w - a.w;
        return a.name.localeCompare(b.name);
    });

    // Return the top 8
    return thirdPlaces.slice(0, 8);
}

/**
 * Matches 3rd place slots (e.g., "3rd Group A/B/C/D/F") to the 8 best thirds.
 * We use a greedy matching algorithm: for each slot, we find the highest-ranking
 * qualifying 3rd-placed team that comes from one of the allowed groups and is not yet assigned.
 * @param {Array} slots - List of slot labels
 * @param {Array} bestThirds - List of the 8 qualifying 3rd-placed team objects
 * @returns {Object} Map of slotLabel -> teamObject
 */
function allocateThirdPlaces(slots, bestThirds) {
    const allocation = {};

    // 1. Try to use the official FIFA Annex C combinations table
    const allocationHelper = globalThis.FB_THIRD_PLACE_ALLOCATION;
    if (allocationHelper) {
        const groups = bestThirds.map(t => t.group);
        const assignment = allocationHelper.resolveThirdPlaceAssignment(groups);

        if (assignment) {
            const slotToPositionMap = {
                '3rd Group A/B/C/D/F': 2,
                '3rd Group C/D/F/G/H': 5,
                '3rd Group C/E/F/H/I': 7,
                '3rd Group E/H/I/J/K': 8,
                '3rd Group B/E/F/I/J': 9,
                '3rd Group A/E/H/I/J': 10,
                '3rd Group E/F/G/I/J': 13,
                '3rd Group D/E/I/J/L': 15
            };

            slots.forEach(slotLabel => {
                const pos = slotToPositionMap[slotLabel];
                const groupLetter = assignment[pos];
                if (groupLetter) {
                    const matchedTeam = bestThirds.find(t => t.group === groupLetter);
                    if (matchedTeam) {
                        allocation[slotLabel] = matchedTeam;
                    }
                }
            });

            // Verify if all slots are allocated
            const allocatedCount = Object.keys(allocation).length;
            if (allocatedCount === slots.length) {
                return allocation;
            }
        }
    }

    // 2. Backtracking perfect matching solver (fallback / simulator custom paths)
    const assignedIds = new Set();

    function solve(slotIndex) {
        if (slotIndex === slots.length) {
            return true;
        }

        const slotLabel = slots[slotIndex];
        const match = slotLabel.match(/3rd Group (.*)/);
        if (!match) return solve(slotIndex + 1);

        const allowedGroups = match[1].split('/');

        // Find all candidates for this slot
        const candidates = bestThirds.filter(t => 
            allowedGroups.includes(t.group) && !assignedIds.has(t.id)
        );

        for (const candidate of candidates) {
            allocation[slotLabel] = candidate;
            assignedIds.add(candidate.id);

            if (solve(slotIndex + 1)) {
                return true;
            }

            // Backtrack
            delete allocation[slotLabel];
            assignedIds.delete(candidate.id);
        }

        return false;
    }

    if (solve(0)) {
        return allocation;
    }

    // 3. Last resort: greedy matching
    const assignedGreedyIds = new Set();
    const greedyAllocation = {};
    slots.forEach(slotLabel => {
        const match = slotLabel.match(/3rd Group (.*)/);
        if (!match) return;

        const allowedGroups = match[1].split('/');
        const matchedTeam = bestThirds.find(t => 
            allowedGroups.includes(t.group) && !assignedGreedyIds.has(t.id)
        );

        if (matchedTeam) {
            greedyAllocation[slotLabel] = matchedTeam;
            assignedGreedyIds.add(matchedTeam.id);
        }
    });

    return greedyAllocation;
}

/**
 * Propagates scores and teams through the knockout stage (R32, R16, QF, SF, Final).
 * Modifies the matches array in-place.
 * @param {Array} matches - Matches array
 * @param {Array} teams - Teams array
 * @param {Array} standings - Sorted group standings
 */
export function propagateKnockout(matches, teams, standings) {
    const teamsMap = {};
    teams.forEach(t => { teamsMap[t.id] = t; });

    // 1. Resolve R32 Teams (matches 73 to 88)
    const bestThirds = getBestThirdPlaces(standings);
    
    // Collect all 3rd place slot labels in R32
    const thirdPlaceSlots = [];
    matches.forEach(m => {
        if (m.type === 'r32') {
            if (m.home_team_label && m.home_team_label.startsWith('3rd Group')) {
                thirdPlaceSlots.push(m.home_team_label);
            }
            if (m.away_team_label && m.away_team_label.startsWith('3rd Group')) {
                thirdPlaceSlots.push(m.away_team_label);
            }
        }
    });

    // Allocate 3rd placed teams to slots
    const thirdAllocations = allocateThirdPlaces(thirdPlaceSlots, bestThirds);

    // Populate R32 Teams
    matches.forEach(m => {
        if (m.type === 'r32') {
            // Reset team IDs if they were previously TBD
            m.home_team_id = "0";
            m.away_team_id = "0";

            // Resolve Home Team
            if (m.home_team_label) {
                if (m.home_team_label.startsWith('Winner Group')) {
                    const grpChar = m.home_team_label.replace('Winner Group ', '');
                    const grp = standings.find(g => g.group === grpChar);
                    if (grp && grp.teams[0]) m.home_team_id = grp.teams[0].id;
                } else if (m.home_team_label.startsWith('Runner-up Group')) {
                    const grpChar = m.home_team_label.replace('Runner-up Group ', '');
                    const grp = standings.find(g => g.group === grpChar);
                    if (grp && grp.teams[1]) m.home_team_id = grp.teams[1].id;
                } else if (m.home_team_label.startsWith('3rd Group')) {
                    const allocated = thirdAllocations[m.home_team_label];
                    if (allocated) m.home_team_id = allocated.id;
                }
            }

            // Resolve Away Team
            if (m.away_team_label) {
                if (m.away_team_label.startsWith('Winner Group')) {
                    const grpChar = m.away_team_label.replace('Winner Group ', '');
                    const grp = standings.find(g => g.group === grpChar);
                    if (grp && grp.teams[0]) m.away_team_id = grp.teams[0].id;
                } else if (m.away_team_label.startsWith('Runner-up Group')) {
                    const grpChar = m.away_team_label.replace('Runner-up Group ', '');
                    const grp = standings.find(g => g.group === grpChar);
                    if (grp && grp.teams[1]) m.away_team_id = grp.teams[1].id;
                } else if (m.away_team_label.startsWith('3rd Group')) {
                    const allocated = thirdAllocations[m.away_team_label];
                    if (allocated) m.away_team_id = allocated.id;
                }
            }
        }
    });

    // 2. Propagate subsequent rounds (r16, qf, sf, third, final)
    const getWinnerId = (match) => {
        if (match.finished !== 'TRUE' && match.finished !== true) return "0";
        const hScore = parseInt(match.home_score) || 0;
        const aScore = parseInt(match.away_score) || 0;
        if (hScore > aScore) return match.home_team_id;
        if (aScore > hScore) return match.away_team_id;
        
        // If tied, check penalty shootout scores first (if present and not null/NaN)
        const hPen = parseInt(match.home_penalty_score);
        const aPen = parseInt(match.away_penalty_score);
        if (!isNaN(hPen) && !isNaN(aPen)) {
            if (hPen > aPen) return match.home_team_id;
            if (aPen > hPen) return match.away_team_id;
        }

        // Fallback to reading penalty_winner field
        if (match.penalty_winner === '1') return match.home_team_id;
        if (match.penalty_winner === '2') return match.away_team_id;
        
        return "0";
    };

    const getLoserId = (match) => {
        const winnerId = getWinnerId(match);
        if (winnerId === "0") return "0";
        return winnerId === match.home_team_id ? match.away_team_id : match.home_team_id;
    };

    const rounds = ['r16', 'qf', 'sf', 'third', 'final'];
    
    rounds.forEach(roundType => {
        matches.forEach(m => {
            if (m.type === roundType) {
                m.home_team_id = "0";
                m.away_team_id = "0";

                // Resolve Home Team
                if (m.home_team_label) {
                    if (m.home_team_label.startsWith('Winner Match')) {
                        const matchId = m.home_team_label.replace('Winner Match ', '');
                        const sourceMatch = matches.find(x => x.id === matchId);
                        if (sourceMatch) m.home_team_id = getWinnerId(sourceMatch);
                    } else if (m.home_team_label.startsWith('Runner-up Match')) {
                        const matchId = m.home_team_label.replace('Runner-up Match ', '');
                        const sourceMatch = matches.find(x => x.id === matchId);
                        if (sourceMatch) m.home_team_id = getLoserId(sourceMatch);
                    }
                }

                // Resolve Away Team
                if (m.away_team_label) {
                    if (m.away_team_label.startsWith('Winner Match')) {
                        const matchId = m.away_team_label.replace('Winner Match ', '');
                        const sourceMatch = matches.find(x => x.id === matchId);
                        if (sourceMatch) m.away_team_id = getWinnerId(sourceMatch);
                    } else if (m.away_team_label.startsWith('Runner-up Match')) {
                        const matchId = m.away_team_label.replace('Runner-up Match ', '');
                        const sourceMatch = matches.find(x => x.id === matchId);
                        if (sourceMatch) m.away_team_id = getLoserId(sourceMatch);
                    }
                }
            }
        });
    });
}
