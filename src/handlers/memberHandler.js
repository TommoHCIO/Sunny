// src/handlers/memberHandler.js

/**
 * Handle new member joining
 */
async function onMemberJoin(client, member) {
    console.log(`New member joined: ${member.user.tag}`);
    
    // Find welcome channel (adjust channel name as needed)
    const welcomeChannel = member.guild.channels.cache.find(
        ch => ch.name === 'introductions' || ch.name === 'welcome-mat'
    );
    
    if (welcomeChannel) {
        await welcomeChannel.send(
            `Welcome to The Nook, ${member}! 🍂 We're thrilled to have you here! ` +
            `Grab some roles in #roles and introduce yourself! Need anything? Just ask me! 🌻`
        );
    }
    
    // Send welcome DM if enabled
    if (process.env.AUTO_WELCOME === 'true') {
        try {
            const dm = await member.createDM();
            await dm.send(
                `Hey there! 🍂 Welcome to The Nook! I'm Sunny, your friendly AI admin.\n\n` +
                `Need help finding your way around? Just mention me anywhere or drop by #sunny-chat. ` +
                `I'm here to make The Nook feel like home!\n\n` +
                `Head to #introductions to say hi to everyone! ☕🧡`
            );
        } catch (error) {
            console.log('Could not send welcome DM (user has DMs disabled)');
        }
    }
}

/**
 * Handle member leaving
 */
async function onMemberLeave(client, member) {
    console.log(`Member left: ${member.user.tag}`);
    
    // Optionally post goodbye message
    const generalChannel = member.guild.channels.cache.find(
        ch => ch.name === 'general-chat'
    );
    
    if (generalChannel) {
        await generalChannel.send(
            `${member.user.username} has left The Nook. We'll miss you! 🍁 Come back anytime! ☕`
        );
    }
}

module.exports = {
    onMemberJoin,
    onMemberLeave
};
