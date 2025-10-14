// Test script for message complexity analyzer
const messageComplexity = require('./src/utils/messageComplexity');

// Test messages
const testMessages = [
    // Greetings
    "hi",
    "hello sunny",
    "thanks",
    "bye",

    // Simple
    "what's my role?",
    "can you help me?",
    "is the server active?",

    // Moderate
    "create a new channel called announcements",
    "assign me the gamer role please",
    "delete the old test channel",

    // Complex
    "set up a verification system with reaction roles and hide all channels from unverified users",
    "create a welcome message and add a reaction role for new members to get verified",

    // Technical
    "how do reaction roles work in discord and can you explain the permission system",
    "I'm getting an error when trying to create a sticker, it says invalid file stream",
    "explain how the moderation system works and what tools you have for managing the server"
];

console.log('Testing Message Complexity Analyzer\n' + '='.repeat(50));

testMessages.forEach(msg => {
    const summary = messageComplexity.getComplexitySummary(msg);
    console.log(`\nMessage: "${msg}"`);
    console.log(`Complexity: ${summary.complexity}`);
    console.log(`Max Sentences: ${summary.maxSentences}`);
    console.log(`Guideline: ${summary.guidelines}`);
    console.log('-'.repeat(50));
});

console.log('\n✅ Test complete!');