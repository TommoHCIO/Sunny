// src/handlers/memberHandler.js
const autoMessageService = require('../services/autoMessageService');

/**
 * Handle new member joining
 */
async function onMemberJoin(client, member) {
    console.log(`New member joined: ${member.user.tag}`);
    
    // Use autoMessageService for welcome messages
    await autoMessageService.sendWelcomeMessage(member);
    
    // Check milestone after member join
    await autoMessageService.checkMilestone(member.guild);
}

/**
 * Handle member leaving
 */
async function onMemberLeave(client, member) {
    console.log(`Member left: ${member.user.tag}`);
    
    // Use autoMessageService for goodbye messages
    await autoMessageService.sendGoodbyeMessage(member);
}

module.exports = {
    onMemberJoin,
    onMemberLeave
};
