// src/services/gameService.js
/**
 * Game Service - Interactive games, polls, and entertainment features
 * Implements trivia, mini-games, and Discord native polls
 */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    PollLayoutType
} = require('discord.js');
const { GameManager } = require('discord-trivia');
const UserMemory = require('../models/UserMemory');

// Initialize trivia manager with custom settings
const triviaManager = new GameManager({
    theme: 'autumn', // Custom theme matching The Nook
    showAnswers: true,
    displayScore: true,
    startDelay: 10000, // 10 second delay before starting
    questionTime: 20000, // 20 seconds per question
    cooldown: 5000 // 5 second cooldown between questions
});

// Store active games per channel to prevent multiple games
const activeGames = new Map();

// Store active polls to track results
const activePolls = new Map();

// Mini-game state tracking
const activeMiniGames = new Map();

/**
 * Start a trivia game in a channel
 * @param {TextChannel} channel - Discord channel to start game in
 * @param {Object} options - Game options
 * @returns {Promise<Object>} Game result
 */
async function startTrivia(channel, options = {}) {
    try {
        // Check if a game is already active in this channel
        if (activeGames.has(channel.id)) {
            return {
                success: false,
                error: 'A game is already in progress in this channel!'
            };
        }

        // Set default options
        const gameOptions = {
            category: options.category || 'general',
            difficulty: options.difficulty || 'medium',
            questionCount: options.questionCount || 10,
            ...options
        };

        // Mark channel as having active game
        activeGames.set(channel.id, true);

        // Create and start the trivia game
        const game = triviaManager.createGame(channel, gameOptions);

        // Handle game events
        game.on('gameEnd', async (results) => {
            activeGames.delete(channel.id);
            await handleTriviaResults(channel, results);
        });

        game.on('error', (error) => {
            console.error('Trivia game error:', error);
            activeGames.delete(channel.id);
        });

        await game.start();

        return {
            success: true,
            message: 'Trivia game started! Get ready for the first question...'
        };
    } catch (error) {
        activeGames.delete(channel.id);
        console.error('Error starting trivia:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Handle trivia game results and update leaderboards
 * @param {TextChannel} channel - Discord channel
 * @param {Object} results - Game results
 */
async function handleTriviaResults(channel, results) {
    try {
        // Sort players by score
        const sortedPlayers = Object.entries(results.scores)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10); // Top 10 players

        // Create results embed
        const embed = new EmbedBuilder()
            .setColor('#FF6B35')
            .setTitle('🏆 Trivia Game Results!')
            .setDescription('Great game everyone! Here are the final scores:')
            .setTimestamp();

        // Add player scores
        sortedPlayers.forEach(([userId, score], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            embed.addFields({
                name: `${medal} #${index + 1}`,
                value: `<@${userId}> - **${score}** points`,
                inline: true
            });
        });

        // Update user stats in memory
        for (const [userId, score] of sortedPlayers) {
            await updateGameStats(userId, channel.guild.id, 'trivia', score);
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error handling trivia results:', error);
    }
}

/**
 * Create a native Discord poll
 * @param {Object} options - Poll options
 * @returns {Promise<Object>} Poll creation result
 */
async function createPoll(options) {
    try {
        const {
            question,
            answers,
            duration = 86400, // 24 hours default
            allowMultiselect = false,
            layoutType = PollLayoutType.Default
        } = options;

        // Create poll object for Discord API
        const pollData = {
            question: { text: question },
            answers: answers.map((answer, index) => ({
                answer_id: index + 1,
                poll_media: { text: answer }
            })),
            duration: Math.min(duration, 604800), // Max 7 days
            allow_multiselect: allowMultiselect,
            layout_type: layoutType
        };

        return {
            success: true,
            poll: pollData
        };
    } catch (error) {
        console.error('Error creating poll:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Start a rock-paper-scissors game
 * @param {Interaction} interaction - Discord interaction
 * @param {User} opponent - Opponent user (null for vs bot)
 * @returns {Promise<void>}
 */
async function startRockPaperScissors(interaction, opponent = null) {
    try {
        const gameId = `rps_${interaction.user.id}_${Date.now()}`;
        const choices = ['rock', 'paper', 'scissors'];
        const emojis = { rock: '🪨', paper: '📰', scissors: '✂️' };

        // Create game state
        const gameState = {
            player1: interaction.user,
            player2: opponent || 'bot',
            player1Choice: null,
            player2Choice: null,
            gameId
        };

        activeMiniGames.set(gameId, gameState);

        // Create buttons for choices
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`rps_rock_${gameId}`)
                    .setLabel('Rock')
                    .setEmoji('🪨')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`rps_paper_${gameId}`)
                    .setLabel('Paper')
                    .setEmoji('📰')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`rps_scissors_${gameId}`)
                    .setLabel('Scissors')
                    .setEmoji('✂️')
                    .setStyle(ButtonStyle.Primary)
            );

        const embed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle('🎮 Rock Paper Scissors!')
            .setDescription(opponent
                ? `${interaction.user} vs ${opponent}\nBoth players, make your choice!`
                : `${interaction.user} vs Sunny Bot\nMake your choice!`)
            .setFooter({ text: 'You have 30 seconds to choose' });

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });

        // Set timeout to clean up game
        setTimeout(() => {
            if (activeMiniGames.has(gameId)) {
                activeMiniGames.delete(gameId);
                interaction.editReply({
                    content: 'Game timed out!',
                    components: [],
                    embeds: []
                });
            }
        }, 30000);
    } catch (error) {
        console.error('Error starting RPS game:', error);
        await interaction.reply({
            content: 'Failed to start Rock Paper Scissors game.',
            ephemeral: true
        });
    }
}

/**
 * Handle rock-paper-scissors button clicks
 * @param {Interaction} interaction - Button interaction
 * @param {string} choice - Player's choice
 * @param {string} gameId - Game identifier
 */
async function handleRPSChoice(interaction, choice, gameId) {
    try {
        const gameState = activeMiniGames.get(gameId);
        if (!gameState) {
            return await interaction.reply({
                content: 'This game has expired.',
                ephemeral: true
            });
        }

        // Check if player is in this game
        const isPlayer1 = interaction.user.id === gameState.player1.id;
        const isPlayer2 = gameState.player2 !== 'bot' && interaction.user.id === gameState.player2.id;

        if (!isPlayer1 && !isPlayer2) {
            return await interaction.reply({
                content: 'You are not a player in this game!',
                ephemeral: true
            });
        }

        // Record choice
        if (isPlayer1 && !gameState.player1Choice) {
            gameState.player1Choice = choice;
            await interaction.reply({
                content: 'Your choice has been recorded!',
                ephemeral: true
            });
        } else if (isPlayer2 && !gameState.player2Choice) {
            gameState.player2Choice = choice;
            await interaction.reply({
                content: 'Your choice has been recorded!',
                ephemeral: true
            });
        } else {
            return await interaction.reply({
                content: 'You have already made your choice!',
                ephemeral: true
            });
        }

        // If playing against bot, make bot choice
        if (gameState.player2 === 'bot' && !gameState.player2Choice) {
            const botChoices = ['rock', 'paper', 'scissors'];
            gameState.player2Choice = botChoices[Math.floor(Math.random() * 3)];
        }

        // Check if both players have chosen
        if (gameState.player1Choice && gameState.player2Choice) {
            await resolveRPSGame(interaction, gameState);
            activeMiniGames.delete(gameId);
        }
    } catch (error) {
        console.error('Error handling RPS choice:', error);
        await interaction.reply({
            content: 'An error occurred processing your choice.',
            ephemeral: true
        });
    }
}

/**
 * Resolve rock-paper-scissors game
 * @param {Interaction} interaction - Discord interaction
 * @param {Object} gameState - Game state
 */
async function resolveRPSGame(interaction, gameState) {
    const emojis = { rock: '🪨', paper: '📰', scissors: '✂️' };
    const p1Choice = gameState.player1Choice;
    const p2Choice = gameState.player2Choice;

    let result;
    let winner;

    // Determine winner
    if (p1Choice === p2Choice) {
        result = "It's a tie!";
        winner = null;
    } else if (
        (p1Choice === 'rock' && p2Choice === 'scissors') ||
        (p1Choice === 'paper' && p2Choice === 'rock') ||
        (p1Choice === 'scissors' && p2Choice === 'paper')
    ) {
        result = `${gameState.player1} wins!`;
        winner = gameState.player1.id;
    } else {
        result = gameState.player2 === 'bot'
            ? 'Sunny Bot wins!'
            : `${gameState.player2} wins!`;
        winner = gameState.player2 === 'bot' ? 'bot' : gameState.player2.id;
    }

    const embed = new EmbedBuilder()
        .setColor(winner === gameState.player1.id ? '#00FF00' : winner ? '#FF0000' : '#FFFF00')
        .setTitle('🎮 Rock Paper Scissors - Results!')
        .addFields(
            {
                name: gameState.player1.username,
                value: `${emojis[p1Choice]} ${p1Choice}`,
                inline: true
            },
            {
                name: 'VS',
                value: '⚔️',
                inline: true
            },
            {
                name: gameState.player2 === 'bot' ? 'Sunny Bot' : gameState.player2.username,
                value: `${emojis[p2Choice]} ${p2Choice}`,
                inline: true
            }
        )
        .setDescription(`**${result}**`)
        .setTimestamp();

    // Update game stats
    if (winner && winner !== 'bot') {
        await updateGameStats(winner, interaction.guild.id, 'rps', 1);
    }

    await interaction.message.edit({
        embeds: [embed],
        components: []
    });
}

/**
 * Start a number guessing game
 * @param {Channel} channel - Discord channel
 * @param {User} user - User starting the game
 * @param {Object} options - Game options
 */
async function startNumberGuessing(channel, user, options = {}) {
    try {
        const min = options.min || 1;
        const max = options.max || 100;
        const maxGuesses = options.maxGuesses || 10;
        const secretNumber = Math.floor(Math.random() * (max - min + 1)) + min;

        const gameId = `guess_${channel.id}_${Date.now()}`;
        const gameState = {
            number: secretNumber,
            guesses: [],
            maxGuesses,
            min,
            max,
            userId: user.id,
            channelId: channel.id,
            startTime: Date.now()
        };

        activeMiniGames.set(gameId, gameState);

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🔢 Number Guessing Game!')
            .setDescription(`I'm thinking of a number between **${min}** and **${max}**!`)
            .addFields(
                { name: 'Player', value: `<@${user.id}>`, inline: true },
                { name: 'Guesses Remaining', value: `${maxGuesses}`, inline: true }
            )
            .setFooter({ text: 'Type your guess in chat!' });

        await channel.send({ embeds: [embed] });

        return {
            success: true,
            gameId
        };
    } catch (error) {
        console.error('Error starting number guessing:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Process a guess in the number guessing game
 * @param {Message} message - Discord message with guess
 * @param {string} gameId - Game identifier
 */
async function processNumberGuess(message, gameId) {
    try {
        const gameState = activeMiniGames.get(gameId);
        if (!gameState) return;

        // Check if message is from the player
        if (message.author.id !== gameState.userId) return;

        // Check if message is a number
        const guess = parseInt(message.content);
        if (isNaN(guess)) return;

        gameState.guesses.push(guess);
        const remainingGuesses = gameState.maxGuesses - gameState.guesses.length;

        let response;
        let gameOver = false;
        let won = false;

        if (guess === gameState.number) {
            // Winner!
            gameOver = true;
            won = true;
            const time = Math.floor((Date.now() - gameState.startTime) / 1000);
            response = `🎉 **Correct!** The number was **${gameState.number}**!\n` +
                      `You got it in **${gameState.guesses.length}** guesses in **${time}** seconds!`;
        } else if (remainingGuesses === 0) {
            // Out of guesses
            gameOver = true;
            response = `❌ **Game Over!** The number was **${gameState.number}**.\n` +
                      `Better luck next time!`;
        } else {
            // Give hint
            const hint = guess < gameState.number ? 'higher' : 'lower';
            const emoji = guess < gameState.number ? '⬆️' : '⬇️';
            response = `${emoji} Try **${hint}**! (${remainingGuesses} guesses left)`;
        }

        const embed = new EmbedBuilder()
            .setColor(won ? '#00FF00' : gameOver ? '#FF0000' : '#FFA500')
            .setTitle('🔢 Number Guessing Game')
            .setDescription(response)
            .addFields({
                name: 'Your Guesses',
                value: gameState.guesses.join(', ') || 'None',
                inline: false
            });

        await message.reply({ embeds: [embed] });

        if (gameOver) {
            activeMiniGames.delete(gameId);
            if (won) {
                await updateGameStats(
                    message.author.id,
                    message.guild.id,
                    'number_guess',
                    gameState.maxGuesses - gameState.guesses.length + 1
                );
            }
        }
    } catch (error) {
        console.error('Error processing number guess:', error);
    }
}

/**
 * Update user game statistics
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} gameType - Type of game
 * @param {number} score - Score or points earned
 */
async function updateGameStats(userId, guildId, gameType, score) {
    try {
        const update = {
            $inc: {
                [`games.${gameType}.plays`]: 1,
                [`games.${gameType}.totalScore`]: score,
                'games.totalPlays': 1
            },
            $max: {
                [`games.${gameType}.highScore`]: score
            },
            $set: {
                [`games.${gameType}.lastPlayed`]: new Date()
            }
        };

        await UserMemory.findOneAndUpdate(
            { userId, guildId },
            update,
            { upsert: true }
        );
    } catch (error) {
        console.error('Error updating game stats:', error);
    }
}

/**
 * Get game leaderboard
 * @param {string} guildId - Discord guild ID
 * @param {string} gameType - Type of game
 * @param {number} limit - Number of entries to return
 * @returns {Promise<Array>} Leaderboard entries
 */
async function getLeaderboard(guildId, gameType, limit = 10) {
    try {
        const field = gameType ? `games.${gameType}.totalScore` : 'games.totalPlays';

        const users = await UserMemory.find({
            guildId,
            [field]: { $gt: 0 }
        })
        .sort({ [field]: -1 })
        .limit(limit)
        .select(`userId ${field}`);

        return users.map((user, index) => ({
            rank: index + 1,
            userId: user.userId,
            score: gameType
                ? user.games?.[gameType]?.totalScore || 0
                : user.games?.totalPlays || 0
        }));
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        return [];
    }
}

module.exports = {
    startTrivia,
    createPoll,
    startRockPaperScissors,
    handleRPSChoice,
    startNumberGuessing,
    processNumberGuess,
    getLeaderboard,
    activeGames,
    activeMiniGames
};