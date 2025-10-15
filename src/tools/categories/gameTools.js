// src/tools/categories/gameTools.js
/**
 * Discord Game and Entertainment Tools
 *
 * Tools for interactive games, polls, trivia, and entertainment features.
 * Includes trivia games, mini-games, polls, and leaderboards.
 *
 * @module gameTools
 */

/**
 * Get all Discord game and entertainment tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of game tool definitions
 */
function getGameTools(guild) {
    return [
        // ===== TRIVIA GAME TOOLS =====
        {
            name: "start_trivia",
            description: "Start a trivia game in the channel. Can specify category, difficulty, and number of questions.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to start trivia game in"
                    },
                    category: {
                        type: "string",
                        description: "Trivia category - accepts ANY topic! The AI will generate questions about whatever category you specify. Examples: dinosaurs, space exploration, medieval history, cooking, anime, sports, music, technology, war, politics, philosophy, etc. Be creative!"
                    },
                    difficulty: {
                        type: "string",
                        description: "Difficulty level",
                        enum: ["easy", "medium", "hard"]
                    },
                    questionCount: {
                        type: "number",
                        description: "Number of questions (1-10, user's choice is always respected)",
                        minimum: 1,
                        maximum: 10
                    }
                },
                required: ["channelName"]
            }
        },
        {
            name: "get_trivia_leaderboard",
            description: "Get the trivia game leaderboard for the server. Shows top players and their scores.",
            input_schema: {
                type: "object",
                properties: {
                    limit: {
                        type: "number",
                        description: "Number of entries to show (default 10)",
                        minimum: 5,
                        maximum: 25
                    }
                },
                required: []
            }
        },

        // ===== POLL TOOLS =====
        {
            name: "create_poll",
            description: "Create a native Discord poll with multiple choice options. Supports up to 10 answer options.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to create poll in"
                    },
                    question: {
                        type: "string",
                        description: "Poll question"
                    },
                    answers: {
                        type: "array",
                        description: "Array of answer options (2-10 options)",
                        items: {
                            type: "string"
                        },
                        minItems: 2,
                        maxItems: 10
                    },
                    duration: {
                        type: "number",
                        description: "Poll duration in seconds (default 24 hours, max 7 days)",
                        minimum: 3600,
                        maximum: 604800
                    },
                    allowMultiselect: {
                        type: "boolean",
                        description: "Allow users to select multiple answers",
                        default: false
                    }
                },
                required: ["channelName", "question", "answers"]
            }
        },
        {
            name: "create_quick_poll",
            description: "Create a quick yes/no/maybe poll using buttons instead of native polls.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to create poll in"
                    },
                    question: {
                        type: "string",
                        description: "Poll question"
                    }
                },
                required: ["channelName", "question"]
            }
        },

        // ===== MINI-GAMES =====
        {
            name: "start_rps",
            description: "Start a rock-paper-scissors game. Can play against Sunny bot or another user.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to start game in"
                    },
                    opponent: {
                        type: "string",
                        description: "Username or mention of opponent (optional, plays vs bot if not specified)"
                    }
                },
                required: ["channelName"]
            }
        },
        {
            name: "start_number_guess",
            description: "Start a number guessing game where players guess a random number.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to start game in"
                    },
                    min: {
                        type: "number",
                        description: "Minimum number (default 1)",
                        minimum: 1
                    },
                    max: {
                        type: "number",
                        description: "Maximum number (default 100)",
                        maximum: 1000
                    },
                    maxGuesses: {
                        type: "number",
                        description: "Maximum number of guesses allowed (default 10)",
                        minimum: 5,
                        maximum: 20
                    }
                },
                required: ["channelName"]
            }
        },
        {
            name: "roll_dice",
            description: "Roll dice with custom number of sides. Can roll multiple dice at once.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to roll dice in"
                    },
                    sides: {
                        type: "number",
                        description: "Number of sides on the dice (default 6)",
                        minimum: 2,
                        maximum: 100,
                        default: 6
                    },
                    count: {
                        type: "number",
                        description: "Number of dice to roll (default 1)",
                        minimum: 1,
                        maximum: 10,
                        default: 1
                    }
                },
                required: ["channelName"]
            }
        },
        {
            name: "flip_coin",
            description: "Flip a coin (heads or tails). Simple random decision maker.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to flip coin in"
                    }
                },
                required: ["channelName"]
            }
        },

        // ===== FUN FEATURES =====
        {
            name: "magic_8ball",
            description: "Ask the magic 8-ball a yes/no question and get a mystical answer.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to ask in"
                    },
                    question: {
                        type: "string",
                        description: "Question to ask the magic 8-ball"
                    }
                },
                required: ["channelName", "question"]
            }
        },
        {
            name: "get_random_fact",
            description: "Get a random fun fact to share with the server.",
            input_schema: {
                type: "object",
                properties: {
                    channelName: {
                        type: "string",
                        description: "Channel to share fact in"
                    },
                    category: {
                        type: "string",
                        description: "Fact category",
                        enum: ["general", "science", "history", "space", "animals", "food"]
                    }
                },
                required: ["channelName"]
            }
        },

        // ===== LEADERBOARD TOOLS =====
        {
            name: "get_game_leaderboard",
            description: "Get the leaderboard for a specific game or overall games.",
            input_schema: {
                type: "object",
                properties: {
                    gameType: {
                        type: "string",
                        description: "Type of game (trivia, rps, number_guess, or 'all' for overall)",
                        enum: ["trivia", "rps", "number_guess", "all"]
                    },
                    limit: {
                        type: "number",
                        description: "Number of entries to show",
                        minimum: 5,
                        maximum: 25,
                        default: 10
                    }
                },
                required: ["gameType"]
            }
        },
        {
            name: "get_user_game_stats",
            description: "Get game statistics for a specific user.",
            input_schema: {
                type: "object",
                properties: {
                    username: {
                        type: "string",
                        description: "Username to get stats for"
                    }
                },
                required: ["username"]
            }
        }
    ];
}

module.exports = { getGameTools };