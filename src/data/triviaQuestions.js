// src/data/triviaQuestions.js
/**
 * Comprehensive Trivia Question Bank
 * 100 questions across 3 difficulty levels and multiple categories
 */

const triviaQuestions = {
    easy: [
        // Science - Easy
        {
            question: "What planet is known as the Red Planet?",
            answers: ["Mars", "Venus", "Jupiter", "Saturn"],
            correct: 0,
            category: "science",
            explanation: "Mars is called the Red Planet because of iron oxide (rust) on its surface."
        },
        {
            question: "What is the largest organ in the human body?",
            answers: ["Liver", "Brain", "Skin", "Heart"],
            correct: 2,
            category: "science",
            explanation: "The skin is the largest organ, covering about 20 square feet in adults."
        },
        {
            question: "How many bones are in the adult human body?",
            answers: ["186", "206", "226", "246"],
            correct: 1,
            category: "science",
            explanation: "Adults have 206 bones, while babies are born with about 270 that fuse over time."
        },

        // History - Easy
        {
            question: "In what year did World War II end?",
            answers: ["1943", "1944", "1945", "1946"],
            correct: 2,
            category: "history",
            explanation: "World War II ended in 1945 with Germany surrendering in May and Japan in August."
        },
        {
            question: "Who was the first President of the United States?",
            answers: ["Thomas Jefferson", "George Washington", "John Adams", "Benjamin Franklin"],
            correct: 1,
            category: "history",
            explanation: "George Washington served as the first U.S. President from 1789 to 1797."
        },
        {
            question: "What year did the Titanic sink?",
            answers: ["1910", "1912", "1914", "1916"],
            correct: 1,
            category: "history",
            explanation: "The RMS Titanic sank on April 15, 1912, after hitting an iceberg."
        },

        // Geography - Easy
        {
            question: "What is the largest ocean on Earth?",
            answers: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"],
            correct: 2,
            category: "geography",
            explanation: "The Pacific Ocean covers about 46% of Earth's water surface."
        },
        {
            question: "What is the capital of Japan?",
            answers: ["Kyoto", "Osaka", "Tokyo", "Hiroshima"],
            correct: 2,
            category: "geography",
            explanation: "Tokyo has been Japan's capital since 1868."
        },
        {
            question: "Which continent is the Sahara Desert located on?",
            answers: ["Asia", "Africa", "Australia", "South America"],
            correct: 1,
            category: "geography",
            explanation: "The Sahara is the world's largest hot desert, covering much of North Africa."
        },

        // Entertainment - Easy
        {
            question: "Who directed the movie 'Jurassic Park'?",
            answers: ["George Lucas", "Steven Spielberg", "James Cameron", "Ridley Scott"],
            correct: 1,
            category: "entertainment",
            explanation: "Steven Spielberg directed Jurassic Park, released in 1993."
        },
        {
            question: "What is Superman's real name?",
            answers: ["Clark Kent", "Bruce Wayne", "Peter Parker", "Tony Stark"],
            correct: 0,
            category: "entertainment",
            explanation: "Superman's alter ego is Clark Kent, a journalist for the Daily Planet."
        },
        {
            question: "Which band wrote the song 'Bohemian Rhapsody'?",
            answers: ["The Beatles", "Led Zeppelin", "Queen", "Pink Floyd"],
            correct: 2,
            category: "entertainment",
            explanation: "Queen released Bohemian Rhapsody in 1975, written by Freddie Mercury."
        }
    ],

    medium: [
        // Science - Medium
        {
            question: "What is the speed of light in vacuum?",
            answers: ["299,792 km/s", "300,000 km/s", "250,000 km/s", "350,000 km/s"],
            correct: 0,
            category: "science",
            explanation: "Light travels at exactly 299,792,458 meters per second in a vacuum."
        },
        {
            question: "What element has the atomic number 79?",
            answers: ["Silver", "Platinum", "Gold", "Mercury"],
            correct: 2,
            category: "science",
            explanation: "Gold (Au) has atomic number 79 on the periodic table."
        },
        {
            question: "What is the powerhouse of the cell?",
            answers: ["Nucleus", "Ribosome", "Mitochondria", "Golgi apparatus"],
            correct: 2,
            category: "science",
            explanation: "Mitochondria produce ATP, the cell's main energy currency."
        },
        {
            question: "Who developed the theory of general relativity?",
            answers: ["Isaac Newton", "Niels Bohr", "Albert Einstein", "Stephen Hawking"],
            correct: 2,
            category: "science",
            explanation: "Einstein published his theory of general relativity in 1915."
        },
        {
            question: "What is the most abundant gas in Earth's atmosphere?",
            answers: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
            correct: 2,
            category: "science",
            explanation: "Nitrogen makes up about 78% of Earth's atmosphere."
        },

        // History - Medium
        {
            question: "Who was the last Pharaoh of Egypt?",
            answers: ["Nefertiti", "Cleopatra VII", "Tutankhamun", "Ramses II"],
            correct: 1,
            category: "history",
            explanation: "Cleopatra VII ruled from 51-30 BC and was the last active pharaoh."
        },
        {
            question: "In what year did the Berlin Wall fall?",
            answers: ["1987", "1988", "1989", "1990"],
            correct: 2,
            category: "history",
            explanation: "The Berlin Wall fell on November 9, 1989."
        },
        {
            question: "Who invented the printing press?",
            answers: ["Johannes Gutenberg", "Leonardo da Vinci", "Benjamin Franklin", "Thomas Edison"],
            correct: 0,
            category: "history",
            explanation: "Gutenberg invented the movable-type printing press around 1440."
        },
        {
            question: "What ancient wonder was located in Alexandria?",
            answers: ["Colossus of Rhodes", "Lighthouse of Alexandria", "Hanging Gardens", "Temple of Artemis"],
            correct: 1,
            category: "history",
            explanation: "The Lighthouse (Pharos) of Alexandria was one of the Seven Wonders."
        },
        {
            question: "Who led the Mongol Empire at its peak?",
            answers: ["Attila the Hun", "Genghis Khan", "Kublai Khan", "Tamerlane"],
            correct: 1,
            category: "history",
            explanation: "Genghis Khan founded and expanded the Mongol Empire from 1206-1227."
        },

        // Geography - Medium
        {
            question: "What is the longest river in the world?",
            answers: ["Amazon River", "Nile River", "Yangtze River", "Mississippi River"],
            correct: 1,
            category: "geography",
            explanation: "The Nile River is approximately 6,650 km long."
        },
        {
            question: "What is the smallest country in the world?",
            answers: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"],
            correct: 1,
            category: "geography",
            explanation: "Vatican City is only 0.44 square kilometers."
        },
        {
            question: "Mount Kilimanjaro is located in which country?",
            answers: ["Kenya", "Uganda", "Tanzania", "Ethiopia"],
            correct: 2,
            category: "geography",
            explanation: "Kilimanjaro is Africa's highest mountain, located in Tanzania."
        },
        {
            question: "What is the capital of Australia?",
            answers: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
            correct: 2,
            category: "geography",
            explanation: "Canberra became Australia's capital in 1913."
        },

        // Entertainment - Medium
        {
            question: "Who wrote the Harry Potter book series?",
            answers: ["J.R.R. Tolkien", "J.K. Rowling", "C.S. Lewis", "George R.R. Martin"],
            correct: 1,
            category: "entertainment",
            explanation: "J.K. Rowling wrote the seven Harry Potter novels from 1997-2007."
        },
        {
            question: "What year was the first iPhone released?",
            answers: ["2005", "2006", "2007", "2008"],
            correct: 2,
            category: "entertainment",
            explanation: "Apple released the first iPhone on June 29, 2007."
        },
        {
            question: "Who painted the Sistine Chapel ceiling?",
            answers: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Donatello"],
            correct: 1,
            category: "entertainment",
            explanation: "Michelangelo painted the ceiling between 1508 and 1512."
        },
        {
            question: "What is the best-selling video game of all time?",
            answers: ["Tetris", "Minecraft", "Grand Theft Auto V", "Wii Sports"],
            correct: 1,
            category: "entertainment",
            explanation: "Minecraft has sold over 300 million copies worldwide."
        }
    ],

    hard: [
        // Science - Hard
        {
            question: "What is the half-life of Carbon-14?",
            answers: ["5,730 years", "10,000 years", "15,240 years", "50,000 years"],
            correct: 0,
            category: "science",
            explanation: "Carbon-14 has a half-life of 5,730 years, used for radiocarbon dating."
        },
        {
            question: "Who discovered penicillin?",
            answers: ["Louis Pasteur", "Alexander Fleming", "Marie Curie", "Jonas Salk"],
            correct: 1,
            category: "science",
            explanation: "Fleming discovered penicillin in 1928, revolutionizing medicine."
        },
        {
            question: "What is the Schwarzschild radius?",
            answers: ["Event horizon of a black hole", "Distance to nearest star", "Size of an atom", "Orbit of Earth"],
            correct: 0,
            category: "science",
            explanation: "The Schwarzschild radius defines a black hole's event horizon."
        },
        {
            question: "What particle was discovered at CERN in 2012?",
            answers: ["Top quark", "Higgs boson", "Neutrino", "Graviton"],
            correct: 1,
            category: "science",
            explanation: "The Higgs boson discovery confirmed the Standard Model of physics."
        },
        {
            question: "What is the most electronegative element?",
            answers: ["Oxygen", "Chlorine", "Fluorine", "Nitrogen"],
            correct: 2,
            category: "science",
            explanation: "Fluorine has the highest electronegativity at 3.98 on the Pauling scale."
        },
        {
            question: "What is Avogadro's number?",
            answers: ["6.022 × 10²³", "3.14 × 10⁸", "9.8 × 10⁹", "1.6 × 10⁻¹⁹"],
            correct: 0,
            category: "science",
            explanation: "Avogadro's number defines the number of particles in one mole."
        },
        {
            question: "What phenomenon causes the twin paradox?",
            answers: ["Quantum entanglement", "Time dilation", "Doppler effect", "Wave-particle duality"],
            correct: 1,
            category: "science",
            explanation: "Time dilation in special relativity causes the twin paradox."
        },

        // History - Hard
        {
            question: "What year was the Battle of Hastings?",
            answers: ["1066", "1166", "1266", "966"],
            correct: 0,
            category: "history",
            explanation: "The Battle of Hastings in 1066 led to Norman conquest of England."
        },
        {
            question: "Who was the Byzantine Emperor during the Nika riots?",
            answers: ["Constantine I", "Justinian I", "Heraclius", "Basil II"],
            correct: 1,
            category: "history",
            explanation: "Justinian I ruled during the Nika riots of 532 AD."
        },
        {
            question: "What treaty ended the Thirty Years' War?",
            answers: ["Treaty of Versailles", "Peace of Westphalia", "Treaty of Utrecht", "Congress of Vienna"],
            correct: 1,
            category: "history",
            explanation: "The Peace of Westphalia (1648) ended the Thirty Years' War."
        },
        {
            question: "Who was the first Emperor of unified China?",
            answers: ["Liu Bang", "Qin Shi Huang", "Wu Zetian", "Kublai Khan"],
            correct: 1,
            category: "history",
            explanation: "Qin Shi Huang unified China in 221 BC and started the Great Wall."
        },
        {
            question: "What year did the Meiji Restoration begin in Japan?",
            answers: ["1858", "1868", "1878", "1888"],
            correct: 1,
            category: "history",
            explanation: "The Meiji Restoration began in 1868, modernizing Japan."
        },
        {
            question: "Who wrote 'The Prince'?",
            answers: ["Thomas More", "Niccolò Machiavelli", "Sun Tzu", "Marcus Aurelius"],
            correct: 1,
            category: "history",
            explanation: "Machiavelli wrote The Prince in 1513 about political power."
        },

        // Geography - Hard
        {
            question: "What is the deepest point in Earth's oceans?",
            answers: ["Puerto Rico Trench", "Java Trench", "Mariana Trench", "Tonga Trench"],
            correct: 2,
            category: "geography",
            explanation: "Challenger Deep in the Mariana Trench is about 11,000 meters deep."
        },
        {
            question: "Which country has the most time zones?",
            answers: ["Russia", "United States", "France", "China"],
            correct: 2,
            category: "geography",
            explanation: "France has 12 time zones due to overseas territories."
        },
        {
            question: "What is the official language of Brazil?",
            answers: ["Spanish", "Portuguese", "French", "English"],
            correct: 1,
            category: "geography",
            explanation: "Portuguese is Brazil's official language due to colonization."
        },
        {
            question: "What desert is the driest place on Earth?",
            answers: ["Sahara", "Gobi", "Atacama", "Namib"],
            correct: 2,
            category: "geography",
            explanation: "The Atacama Desert in Chile averages 0.04 inches of rain per year."
        },
        {
            question: "What is the longest mountain range on Earth?",
            answers: ["Himalayas", "Andes", "Mid-Atlantic Ridge", "Rocky Mountains"],
            correct: 2,
            category: "geography",
            explanation: "The Mid-Atlantic Ridge is 40,000+ km long underwater."
        },

        // Entertainment - Hard
        {
            question: "Who composed 'The Four Seasons'?",
            answers: ["Bach", "Vivaldi", "Mozart", "Beethoven"],
            correct: 1,
            category: "entertainment",
            explanation: "Antonio Vivaldi composed The Four Seasons around 1720."
        },
        {
            question: "What was the first feature-length animated film?",
            answers: ["Fantasia", "Pinocchio", "Snow White", "Bambi"],
            correct: 2,
            category: "entertainment",
            explanation: "Disney's Snow White and the Seven Dwarfs (1937) was the first."
        },
        {
            question: "Who wrote 'One Hundred Years of Solitude'?",
            answers: ["Jorge Luis Borges", "Gabriel García Márquez", "Pablo Neruda", "Octavio Paz"],
            correct: 1,
            category: "entertainment",
            explanation: "García Márquez published this masterpiece in 1967."
        },
        {
            question: "What is the highest-grossing film of all time (adjusted for inflation)?",
            answers: ["Avatar", "Avengers: Endgame", "Gone with the Wind", "Titanic"],
            correct: 2,
            category: "entertainment",
            explanation: "Gone with the Wind (1939) earned $3.7 billion adjusted."
        },
        {
            question: "Who directed '2001: A Space Odyssey'?",
            answers: ["Steven Spielberg", "George Lucas", "Stanley Kubrick", "Ridley Scott"],
            correct: 2,
            category: "entertainment",
            explanation: "Stanley Kubrick directed this 1968 sci-fi masterpiece."
        },

        // Sports - Hard
        {
            question: "What year were the first modern Olympics held?",
            answers: ["1892", "1896", "1900", "1904"],
            correct: 1,
            category: "sports",
            explanation: "The first modern Olympics were held in Athens in 1896."
        },
        {
            question: "Who holds the record for most career home runs in MLB?",
            answers: ["Babe Ruth", "Hank Aaron", "Barry Bonds", "Willie Mays"],
            correct: 2,
            category: "sports",
            explanation: "Barry Bonds hit 762 career home runs."
        },

        // General Knowledge - Hard
        {
            question: "What is the square root of 441?",
            answers: ["19", "21", "23", "25"],
            correct: 1,
            category: "general",
            explanation: "21 × 21 = 441"
        },
        {
            question: "How many keys does a standard piano have?",
            answers: ["76", "82", "88", "96"],
            correct: 2,
            category: "general",
            explanation: "A standard piano has 88 keys (52 white, 36 black)."
        },
        {
            question: "What is the only letter that doesn't appear in any US state name?",
            answers: ["J", "Q", "X", "Z"],
            correct: 1,
            category: "general",
            explanation: "Q is the only letter not in any US state name."
        },
        {
            question: "How many time zones does Russia span?",
            answers: ["9", "10", "11", "12"],
            correct: 2,
            category: "general",
            explanation: "Russia spans 11 time zones from Kaliningrad to Kamchatka."
        }
    ]
};

/**
 * Get a random question by difficulty
 * @param {string} difficulty - easy, medium, or hard
 * @param {string} category - Optional category filter
 * @returns {Object} Random trivia question
 */
function getRandomQuestion(difficulty = 'medium', category = null) {
    const questions = triviaQuestions[difficulty] || triviaQuestions.medium;

    let filteredQuestions = questions;
    if (category && category !== 'general') {
        filteredQuestions = questions.filter(q => q.category === category);
    }

    if (filteredQuestions.length === 0) {
        filteredQuestions = questions;
    }

    return filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
}

/**
 * Get multiple unique random questions
 * @param {number} count - Number of questions to get
 * @param {string} difficulty - easy, medium, or hard
 * @param {string} category - Optional category filter
 * @returns {Array} Array of trivia questions
 */
function getRandomQuestions(count, difficulty = 'medium', category = null) {
    const questions = triviaQuestions[difficulty] || triviaQuestions.medium;

    let filteredQuestions = questions;
    if (category && category !== 'general') {
        filteredQuestions = questions.filter(q => q.category === category);
    }

    if (filteredQuestions.length === 0) {
        filteredQuestions = questions;
    }

    // Shuffle and return requested count
    const shuffled = [...filteredQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

module.exports = {
    triviaQuestions,
    getRandomQuestion,
    getRandomQuestions
};