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
// Removed discord-trivia dependency - using custom implementation
const UserMemory = require('../models/UserMemory');
const Anthropic = require('@anthropic-ai/sdk');
const { getRandomQuestion, getRandomQuestions } = require('../data/triviaQuestions');

// Initialize Anthropic client for generating trivia questions
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Store Discord client instance (will be set on initialization)
let discordClient = null;

// Store active games per channel to prevent multiple games
const activeGames = new Map();

// Store active polls to track results
const activePolls = new Map();

// Mini-game state tracking
const activeMiniGames = new Map();

/**
 * Initialize the game service with Discord client
 * @param {Client} client - Discord.js client instance
 */
function initialize(client) {
    discordClient = client;
    console.log('🎮 Game service initialized with Discord client');
}

/**
 * Generate a trivia question using AI
 * Always uses AI generation for unlimited variety and no repeats
 * @param {string} category - Category for the question
 * @param {string} difficulty - Difficulty level (easy, medium, hard)
 * @returns {Promise<Object>} Generated trivia question
 */
async function generateTriviaQuestion(category = 'general', difficulty = 'medium') {
    // Always use AI generation for unlimited variety and no repeats
    try {
        // Map categories to more specific topics for better questions
        const categoryPrompts = {
            'general': 'general knowledge across various topics',
            'science': 'science (physics, chemistry, biology, astronomy, mathematics)',
            'history': 'world history, historical events, and important figures',
            'geography': 'world geography, countries, capitals, landmarks, and physical features',
            'entertainment': 'movies, TV shows, music, celebrities, and pop culture',
            'sports': 'sports, athletics, championships, and famous athletes',
            'art': 'art, famous artists, art movements, paintings, and sculptures',
            'music': 'music, musicians, bands, albums, and musical theory',
            'literature': 'books, authors, poetry, and literary works',
            'technology': 'technology, computers, internet, and innovations',
            'food': 'cuisine, cooking, ingredients, and culinary traditions',
            'nature': 'nature, ecosystems, plants, and natural phenomena',
            'animals': 'animals, wildlife, zoology, and animal behavior',
            'vehicles': 'cars, planes, trains, boats, and transportation',
            'comics': 'comic books, superheroes, manga, and graphic novels',
            'games': 'video games, board games, and gaming history',
            'movies': 'cinema, films, directors, and movie history',
            'anime': 'anime, manga, and Japanese animation',
            'mythology': 'mythology, legends, and ancient stories'
        };

        // Add randomization to ensure unique questions each time
        const uniqueSeed = Date.now() + Math.random();
        
        const prompt = `Generate a ${difficulty} trivia question about ${categoryPrompts[category] || category}.
Generation seed: ${uniqueSeed}

Return ONLY a JSON object in this exact format (no markdown, no extra text):
{
  "question": "The trivia question here",
  "answers": ["Answer A", "Answer B", "Answer C", "Answer D"],
  "correct": 0,
  "category": "${category}",
  "explanation": "Brief explanation of why this is the correct answer"
}

Rules:
- The question should be appropriate for all ages but intellectually challenging
- Make exactly 4 answer options
- The correct answer index (0-3) should be randomized
- All answers should be highly plausible to make it challenging
- ${difficulty === 'easy' ? 'Make the question accessible but interesting - something most people could figure out with general knowledge, but not completely obvious' : difficulty === 'hard' ? 'Make the question very challenging, requiring specialized knowledge or careful thinking. Include subtle details, specific dates, lesser-known facts, or complex concepts. This should stump most people!' : 'Make the question moderately challenging, requiring good general knowledge or some reasoning'}
- The question should be factual and verifiable
- Don't use "all of the above" or "none of the above" as options
- Avoid overly simple questions that everyone would know immediately
- Focus on interesting, engaging facts that make players think
- IMPORTANT: Generate a completely UNIQUE question - do not repeat common trivia questions`;

        const response = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 500,
            temperature: 0.8,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        // Parse the response
        const content = response.content[0].text;
        
        // Try to extract JSON from the response
        let triviaData;
        try {
            // Remove any markdown code blocks if present
            const jsonStr = content.replace(/```json\n?|```\n?/g, '').trim();
            triviaData = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error('Failed to parse AI response:', content);
            throw new Error('Failed to generate valid trivia question');
        }

        // Validate the response has required fields
        if (!triviaData.question || !Array.isArray(triviaData.answers) || 
            triviaData.answers.length !== 4 || typeof triviaData.correct !== 'number') {
            throw new Error('Invalid trivia question format from AI');
        }

        return triviaData;
    } catch (error) {
        console.error('Error generating trivia question:', error);
        
        // Fallback to a default question if generation fails
        const fallbackQuestions = [
            {
                question: "What is the capital of France?",
                answers: ["Paris", "London", "Berlin", "Madrid"],
                correct: 0,
                category: category,
                explanation: "Paris is the capital and largest city of France."
            },
            {
                question: "What is 2 + 2?",
                answers: ["3", "4", "5", "6"],
                correct: 1,
                category: category,
                explanation: "2 + 2 equals 4."
            }
        ];
        
        return fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
    }
}

/**
 * Start a trivia game in a channel
 * @param {TextChannel} channel - Discord channel to start game in
 * @param {Object} options - Game options
 * @returns {Promise<Object>} Game result
 */
async function startTrivia(channel, options = {}) {
    // Default to 5 questions if not specified, support up to 10
    const questionCount = Math.min(options.questionCount || 5, 10);
    
    // Always use session mode for consistency (even for 1 question)
    return startTriviaSession(channel, { ...options, questionCount });
}

/**
 * Start a multi-question trivia session with progressive message deletion
 * @param {TextChannel} channel - Discord channel
 * @param {Object} options - Game options
 * @returns {Promise<Object>} Session result
 */
async function startTriviaSession(channel, options = {}) {
    try {
        // Check if a game is already active
        if (activeGames.has(channel.id)) {
            return {
                success: false,
                error: 'A game is already in progress in this channel!'
            };
        }
        
        // Check if bot has permission to manage messages (for deletion)
        const botMember = channel.guild.members.me;
        const canDeleteMessages = channel.permissionsFor(botMember)?.has('ManageMessages');
        if (!canDeleteMessages) {
            console.warn('Bot does not have ManageMessages permission in this channel - message cleanup disabled');
        }

        const questionCount = Math.min(options.questionCount || 5, 10);
        const category = options.category || 'general';
        const difficulty = options.difficulty || 'hard'; // Default to hard for more challenge
        const sessionScores = new Map(); // Track scores across questions
        const messagesToDelete = []; // Track messages to clean up
        
        // Announce the session
        const startEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎮 Trivia Session Starting!')
            .setDescription(`Get ready for ${questionCount} questions!`)
            .addFields(
                { name: 'Category', value: category, inline: true },
                { name: 'Difficulty', value: difficulty, inline: true },
                { name: 'Questions', value: questionCount.toString(), inline: true }
            )
            .setFooter({ text: 'First question coming up in 5 seconds...' });
        
        const startMsg = await channel.send({ embeds: [startEmbed] });
        messagesToDelete.push(startMsg);
        
        // Mark channel as having active game
        activeGames.set(channel.id, { type: 'trivia_session' });
        
        // Wait before starting
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Delete the start message if we have permission
        if (canDeleteMessages) {
            try {
                await startMsg.delete();
            } catch (err) {
                console.error('Could not delete start message:', err.message);
            }
        }
        
        // Run through questions
        for (let i = 0; i < questionCount; i++) {
            // Check if session was cancelled
            if (!activeGames.has(channel.id)) break;
            
            // Clear old messages from previous question (only if we have permission)
            if (messagesToDelete.length > 0 && canDeleteMessages) {
                for (const msg of messagesToDelete) {
                    try {
                        await msg.delete();
                    } catch (err) {
                        console.error(`Failed to delete message: ${err.message}`);
                    }
                }
                messagesToDelete.length = 0; // Clear the array
            }
            
            // Generate and show question
            const question = await generateTriviaQuestion(category, difficulty);
            const gameId = `trivia_${channel.id}_${Date.now()}`;
            
            // Create running score display
            let scoreDisplay = '';
            if (i > 0 && sessionScores.size > 0) {
                const topScorers = Array.from(sessionScores.entries())
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3)
                    .map(([userId, score]) => `<@${userId}>: ${score}`)
                    .join(' | ');
                scoreDisplay = `\n🏆 **Current Leaders:** ${topScorers}`;
            }
            
            // Create embed with question
            const embed = new EmbedBuilder()
                .setColor('#00CED1')
                .setTitle(`🧠 Question ${i + 1} of ${questionCount}`)
                .setDescription(question.question + scoreDisplay)
                .addFields(
                    question.answers.map((answer, index) => ({
                        name: `${['A', 'B', 'C', 'D'][index]}`,
                        value: answer,
                        inline: true
                    }))
                )
                .setFooter({ text: `${question.category} | ${difficulty} | 20 seconds to answer!` });

            // Create answer buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    ['A', 'B', 'C', 'D'].map(letter => 
                        new ButtonBuilder()
                            .setCustomId(`trivia_${letter}_${gameId}`)
                            .setLabel(letter)
                            .setStyle(ButtonStyle.Primary)
                    )
                );

            const triviaMessage = await channel.send({ embeds: [embed], components: [row] });
            messagesToDelete.push(triviaMessage); // Track for deletion
            
            // Store game state
            const gameState = {
                type: 'trivia',
                channelId: channel.id,
                question: question,
                messageId: triviaMessage.id,
                startTime: Date.now(),
                participants: new Map(),
                ended: false
            };
            activeGames.set(gameId, gameState);
            
            // Wait for answers (20 seconds per question)
            await new Promise(resolve => {
                setTimeout(async () => {
                    gameState.ended = true;
                    
                    // Disable buttons
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            row.components.map(button => 
                                ButtonBuilder.from(button).setDisabled(true)
                            )
                        );
                    
                    try {
                        await triviaMessage.edit({ components: [disabledRow] });
                    } catch (err) {}
                    
                    // Update session scores FIRST
                    const correctUsers = [];
                    for (const [userId, answer] of gameState.participants) {
                        if (answer === question.correct) {
                            sessionScores.set(userId, (sessionScores.get(userId) || 0) + 1);
                            correctUsers.push(`<@${userId}>`);
                        }
                    }
                    
                    // Build compact results message
                    const correctLetter = ['A', 'B', 'C', 'D'][question.correct];
                    const correctAnswer = question.answers[question.correct];
                    
                    const resultsEmbed = new EmbedBuilder()
                        .setColor(correctUsers.length > 0 ? '#00FF00' : '#FF0000')
                        .setTitle(`✅ Answer: ${correctLetter}. ${correctAnswer}`)
                        .setDescription(
                            (question.explanation ? `💡 ${question.explanation}\n\n` : '') +
                            (correctUsers.length > 0 
                                ? `**Got it right:** ${correctUsers.join(', ')}` 
                                : gameState.participants.size > 0 
                                    ? '**Nobody got this one!**' 
                                    : '**Nobody answered!**')
                        );
                    
                    // Show current standings if not last question
                    if (i < questionCount - 1 && sessionScores.size > 0) {
                        const standings = Array.from(sessionScores.entries())
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 5)
                            .map(([userId, score], idx) => `${idx + 1}. <@${userId}>: **${score}** pts`)
                            .join('\n');
                        
                        resultsEmbed.addFields({
                            name: '📊 Current Standings',
                            value: standings,
                            inline: false
                        });
                        
                        resultsEmbed.setFooter({ text: `Next question in 5 seconds...` });
                    }
                    
                    const resultMsg = await channel.send({ embeds: [resultsEmbed] });
                    messagesToDelete.push(resultMsg);
                    
                    // Clean up this game
                    activeGames.delete(gameId);
                    
                    resolve();
                }, 20000);
            });
            
            // Wait between questions (longer to read results)
            if (i < questionCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        // Clean up remaining messages before showing final results (if we have permission)
        if (canDeleteMessages) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            for (const msg of messagesToDelete) {
                try {
                    await msg.delete();
                } catch (err) {
                    console.error('Could not delete message:', err.message);
                }
            }
        }
        
        // Show final results
        if (sessionScores.size > 0) {
            const sortedScores = Array.from(sessionScores.entries())
                .sort(([,a], [,b]) => b - a);
            
            const resultsEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 Trivia Session Complete!')
                .setDescription(`**Final Results - ${questionCount} Questions**\n${sortedScores.length} participant${sortedScores.length === 1 ? '' : 's'} competed!`);
            
            // Add winner announcement
            if (sortedScores.length > 0) {
                const [winnerId, winnerScore] = sortedScores[0];
                const percentage = Math.round((winnerScore / questionCount) * 100);
                resultsEmbed.addFields({
                    name: '🎉 Winner!',
                    value: `<@${winnerId}> with **${winnerScore}/${questionCount}** correct (${percentage}%)`,
                    inline: false
                });
            }
            
            // Add complete participant leaderboard (all participants)
            const leaderboardText = sortedScores.map(([userId, score], index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                const percentage = Math.round((score / questionCount) * 100);
                return `${medal} <@${userId}> - **${score}/${questionCount}** (${percentage}%)`;
            }).join('\n');
            
            resultsEmbed.addFields({
                name: '📊 Participant Leaderboard',
                value: leaderboardText,
                inline: false
            });
            
            // Add session statistics
            const totalAnswers = sortedScores.reduce((sum, [, score]) => sum + score, 0);
            const avgScore = (totalAnswers / sortedScores.length).toFixed(1);
            const avgPercentage = Math.round((avgScore / questionCount) * 100);
            
            resultsEmbed.addFields({
                name: '📈 Session Stats',
                value: `**Average Score:** ${avgScore}/${questionCount} (${avgPercentage}%)\n**Total Participants:** ${sortedScores.length}`,
                inline: false
            });
            
            resultsEmbed.setFooter({ text: 'Thanks for playing!' });
            resultsEmbed.setTimestamp();
            
            // Update user stats
            for (const [userId, score] of sortedScores) {
                await updateGameStats(userId, channel.guild.id, 'trivia', score);
            }
            
            await channel.send({ embeds: [resultsEmbed] });
        } else {
            await channel.send('📊 **Trivia session complete!** Nobody participated in this session.');
        }
        
        // Clean up
        activeGames.delete(channel.id);
        
        return {
            success: true,
            message: `Completed trivia session with ${questionCount} questions`
        };
    } catch (error) {
        activeGames.delete(channel.id);
        console.error('Error in trivia session:', error);
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
 * @param {TextChannel} channel - Discord channel
 * @param {User} user - User who started the game
 * @param {User} opponent - Opponent user (null for vs bot)
 * @returns {Promise<Object>}
 */
async function startRockPaperScissors(channel, user, opponent = null) {
    try {
        const gameId = `rps_${user.id}_${Date.now()}`;
        const choices = ['rock', 'paper', 'scissors'];
        const emojis = { rock: '🪨', paper: '📰', scissors: '✂️' };

        // Create game state
        const gameState = {
            type: 'rps',
            players: [{ id: user.id, name: user.username }],
            player1Choice: null,
            player2Choice: null,
            gameId,
            channelId: channel.id,
            messageId: null
        };

        activeGames.set(gameId, gameState);

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
                ? `${user.username} vs ${opponent}\nBoth players, make your choice!`
                : `${user.username} vs Sunny Bot\nMake your choice!`)
            .setFooter({ text: 'You have 30 seconds to choose' });

        const message = await channel.send({
            embeds: [embed],
            components: [row]
        });

        // Store message ID for later reference
        gameState.messageId = message.id;
        activeGames.set(gameId, gameState);

        // Set timeout to clean up game
        setTimeout(async () => {
            if (activeGames.has(gameId)) {
                activeGames.delete(gameId);
                try {
                    await message.edit({
                        content: 'Game timed out!',
                        components: [],
                        embeds: []
                    });
                } catch (err) {
                    // Message might be deleted
                }
            }
        }, 30000);
        
        return {
            success: true,
            message: 'Rock Paper Scissors game started!',
            gameId
        };
    } catch (error) {
        console.error('Error starting RPS game:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Process a Rock Paper Scissors choice
 * @param {Interaction} interaction - Button interaction
 * @param {String} gameId - Game ID
 * @param {String} choice - Player's choice (rock/paper/scissors)
 */
async function processRPSChoice(interaction, gameId, choice) {
    try {
        const game = activeGames.get(gameId);
        if (!game || game.type !== 'rps') return;
        
        // Bot makes a random choice
        const choices = ['rock', 'paper', 'scissors'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        
        // Determine winner
        let result;
        if (choice === botChoice) {
            result = "It's a tie! 🤝";
        } else if (
            (choice === 'rock' && botChoice === 'scissors') ||
            (choice === 'paper' && botChoice === 'rock') ||
            (choice === 'scissors' && botChoice === 'paper')
        ) {
            result = 'You win! 🎉';
            // Update user stats
            await updateGameStats(interaction.user.id, interaction.guild.id, 'rps', 1);
        } else {
            result = 'Sunny wins! 🤖';
        }
        
        const emojis = { rock: '🪨', paper: '📰', scissors: '✂️' };
        
        const embed = new EmbedBuilder()
            .setColor(result.includes('win!') ? '#00FF00' : result.includes('tie') ? '#FFFF00' : '#FF0000')
            .setTitle('🎮 Rock Paper Scissors - Results!')
            .setDescription(
                `**Your choice:** ${emojis[choice]} ${choice}\n` +
                `**Sunny's choice:** ${emojis[botChoice]} ${botChoice}\n\n` +
                `**${result}**`
            )
            .setTimestamp();
        
        // Disable all buttons
        const disabledRow = new ActionRowBuilder()
            .addComponents(
                ...interaction.message.components[0].components.map(button =>
                    ButtonBuilder.from(button).setDisabled(true)
                )
            );
        
        await interaction.update({
            embeds: [embed],
            components: [disabledRow]
        });
        
        // Clean up game state
        activeGames.delete(gameId);
    } catch (error) {
        console.error('Error processing RPS choice:', error);
        await interaction.reply({
            content: '❌ An error occurred processing your choice.',
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
    initialize,
    startTrivia,
    createPoll,
    startRockPaperScissors,
    processRPSChoice,
    handleRPSChoice,
    startNumberGuessing,
    processNumberGuess,
    getLeaderboard,
    activeGames,
    activePolls,
    activeMiniGames
};