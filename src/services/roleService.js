// src/services/roleService.js

const SELF_ASSIGNABLE_ROLES = [
    'Artist', 'Gamer', 'Reader/Writer', 'Music Lover',
    'Movie Buff', 'Night Owl', 'Early Bird', 'Photographer', 'Crafter',
    'she/her', 'he/him', 'they/them', 'any pronouns'
];

/**
 * Add a role to a member
 */
async function addRole(member, roleName) {
    // Check if role is self-assignable
    if (!SELF_ASSIGNABLE_ROLES.includes(roleName)) {
        throw new Error(`${roleName} is not a self-assignable role`);
    }
    
    // Find role
    const role = member.guild.roles.cache.find(
        r => r.name.toLowerCase() === roleName.toLowerCase()
    );
    
    if (!role) {
        throw new Error(`Role ${roleName} not found`);
    }
    
    // Check if member already has role
    if (member.roles.cache.has(role.id)) {
        throw new Error(`You already have the ${roleName} role!`);
    }
    
    // Add role
    await member.roles.add(role);
    
    return {
        success: true,
        role: role,
        emoji: getRoleEmoji(roleName),
        channelSuggestion: getChannelSuggestion(roleName)
    };
}

/**
 * Remove a role from a member
 */
async function removeRole(member, roleName) {
    // Check if role is self-assignable
    if (!SELF_ASSIGNABLE_ROLES.includes(roleName)) {
        throw new Error(`${roleName} is not a self-assignable role`);
    }
    
    // Find role
    const role = member.guild.roles.cache.find(
        r => r.name.toLowerCase() === roleName.toLowerCase()
    );
    
    if (!role) {
        throw new Error(`Role ${roleName} not found`);
    }
    
    // Check if member has role
    if (!member.roles.cache.has(role.id)) {
        throw new Error(`You don't have the ${roleName} role!`);
    }
    
    // Remove role
    await member.roles.remove(role);
    
    return {
        success: true,
        role: role
    };
}

function getRoleEmoji(roleName) {
    const emojiMap = {
        'Artist': '🎨',
        'Gamer': '🎮',
        'Reader/Writer': '📚',
        'Music Lover': '🎵',
        'Movie Buff': '🎬',
        'Night Owl': '🌙',
        'Early Bird': '☀️',
        'Photographer': '📸',
        'Crafter': '🧶'
    };
    return emojiMap[roleName] || '🍂';
}

function getChannelSuggestion(roleName) {
    const suggestions = {
        'Artist': 'Check out #art-gallery to share your work!',
        'Gamer': 'Head to #gaming-lounge to find teammates!',
        'Reader/Writer': 'Visit #writers-nook to share your stories!',
        'Music Lover': 'Share your favorite tunes in #music-sharing!',
        'Movie Buff': 'Discuss films in #movie-nights!',
        'Photographer': 'Post your shots in #photography!',
        'Crafter': 'Show off your projects in #crafts-and-diy!'
    };
    return suggestions[roleName] || 'Explore The Nook and find your favorite channels!';
}

module.exports = {
    addRole,
    removeRole,
    SELF_ASSIGNABLE_ROLES
};
