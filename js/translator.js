// Team names translator to Spanish

const teamTranslations = {
    "Mexico": "México",
    "South Africa": "Sudáfrica",
    "South Korea": "Corea del Sur",
    "Czech Republic": "República Checa",
    "Canada": "Canadá",
    "Bosnia and Herzegovina": "Bosnia y Herzegovina",
    "Bosnia & Herzegovina": "Bosnia y Herzegovina",
    "Qatar": "Catar",
    "Switzerland": "Suiza",
    "United States": "Estados Unidos",
    "USA": "EE. UU.",
    "England": "Inglaterra",
    "Argentina": "Argentina",
    "Brazil": "Brasil",
    "France": "Francia",
    "Spain": "España",
    "Germany": "Alemania",
    "Italy": "Italia",
    "Portugal": "Portugal",
    "Netherlands": "Países Bajos",
    "Belgium": "Bélgica",
    "Croatia": "Croacia",
    "Uruguay": "Uruguay",
    "Colombia": "Colombia",
    "Morocco": "Marruecos",
    "Senegal": "Senegal",
    "Japan": "Japón",
    "Australia": "Australia",
    "Ecuador": "Ecuador",
    "Denmark": "Dinamarca",
    "Poland": "Polonia",
    "Ukraine": "Ucrania",
    "Sweden": "Suecia",
    "Norway": "Noruega",
    "Austria": "Austria",
    "Scotland": "Escocia",
    "Wales": "Gales",
    "Turkey": "Turquía",
    "Iran": "Irán",
    "Saudi Arabia": "Arabia Saudita",
    "Egypt": "Egipto",
    "Nigeria": "Nigeria",
    "Cameroon": "Camerún",
    "Ghana": "Ghana",
    "Ivory Coast": "Costa de Marfil",
    "Costa Rica": "Costa Rica",
    "Panama": "Panamá",
    "Jamaica": "Jamaica",
    "Honduras": "Honduras",
    "Peru": "Perú",
    "Chile": "Chile",
    "Paraguay": "Paraguay",
    "Venezuela": "Venezuela",
    "New Zealand": "Nueva Zelanda",
    "Algeria": "Argelia",
    "Tunisia": "Túnez",
    "Mali": "Malí",
    "Iraq": "Irak",
    "Uzbekistan": "Uzbekistán",
    "China": "China",
    "Oman": "Omán",
    "Jordan": "Jordania",
    "United Arab Emirates": "Emiratos Árabes Unidos",
    "UAE": "EAU"
};

const labelTranslations = {
    "Winner Group A": "Ganador Grupo A",
    "Winner Group B": "Ganador Grupo B",
    "Winner Group C": "Ganador Grupo C",
    "Winner Group D": "Ganador Grupo D",
    "Winner Group E": "Ganador Grupo E",
    "Winner Group F": "Ganador Grupo F",
    "Winner Group G": "Ganador Grupo G",
    "Winner Group H": "Ganador Grupo H",
    "Winner Group I": "Ganador Grupo I",
    "Winner Group J": "Ganador Grupo J",
    "Winner Group K": "Ganador Grupo K",
    "Winner Group L": "Ganador Grupo L",
    
    "Runner-up Group A": "Segundo Grupo A",
    "Runner-up Group B": "Segundo Grupo B",
    "Runner-up Group C": "Segundo Grupo C",
    "Runner-up Group D": "Segundo Grupo D",
    "Runner-up Group E": "Segundo Grupo E",
    "Runner-up Group F": "Segundo Grupo F",
    "Runner-up Group G": "Segundo Grupo G",
    "Runner-up Group H": "Segundo Grupo H",
    "Runner-up Group I": "Segundo Grupo I",
    "Runner-up Group J": "Segundo Grupo J",
    "Runner-up Group K": "Segundo Grupo K",
    "Runner-up Group L": "Segundo Grupo L",
    
    "3rd Group A/B/C/D/F": "Tercero A/B/C/D/F",
    "3rd Group C/E/F/H/I": "Tercero C/E/F/H/I",
    "3rd Group C/D/E/G/H": "Tercero C/D/E/G/H",
    "3rd Group F/G/H/I/J": "Tercero F/G/H/I/J",
    "3rd Group A/B/C/G/H": "Tercero A/B/C/G/H",
    "3rd Group A/B/D/E/F": "Tercero A/B/D/E/F",
    "3rd Group E/F/G/H/J": "Tercero E/F/G/H/J",
    "3rd Group A/B/C/D/E": "Tercero A/B/C/D/E",
    "3rd Group G/H/I/J/K": "Tercero G/H/I/J/K",
    "3rd Group B/C/D/E/F": "Tercero B/C/D/E/F",
    "3rd Group I/J/K/L/A": "Tercero I/J/K/L/A",
    "3rd Group C/D/E/F/G": "Tercero C/D/E/F/G",
    "3rd Group H/I/J/K/L": "Tercero H/I/J/K/L",
    "3rd Group A/D/E/H/I": "Tercero A/D/E/H/I",
    "3rd Group B/E/F/G/I": "Tercero B/E/F/G/I",
    "3rd Group C/F/G/H/J": "Tercero C/F/G/H/J"
};

/**
 * Translates a team name or placeholder label to Spanish.
 * @param {string} name - English team name or placeholder label
 * @returns {string} Translated string in Spanish
 */
export function translate(name) {
    if (!name) return "";
    
    // Check if it's a team name translation
    if (teamTranslations[name]) {
        return teamTranslations[name];
    }
    
    // Check if it's a label translation
    if (labelTranslations[name]) {
        return labelTranslations[name];
    }
    
    // Check for Winner/Runner-up Match labels (e.g., "Winner Match 73")
    const winnerMatchReg = /Winner Match (\d+)/i;
    if (winnerMatchReg.test(name)) {
        const match = name.match(winnerMatchReg);
        return `Ganador Partido ${match[1]}`;
    }
    
    const runnerupMatchReg = /Runner-up Match (\d+)/i;
    if (runnerupMatchReg.test(name)) {
        const match = name.match(runnerupMatchReg);
        return `Perdedor Partido ${match[1]}`;
    }

    return name;
}
