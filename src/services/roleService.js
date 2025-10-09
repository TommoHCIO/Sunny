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
    try {
        // Check if role is self-assignable
        if (!SELF_ASSIGNABLE_ROLES.includes(roleName)) {
            console.log(`❌ Role ${roleName} is not self-assignable`);
            return {
                success: false,
                error: `${roleName} is not a self-assignable role`
            };
        }

        // Find role (case-insensitive)
        let role = member.guild.roles.cache.find(
            r => r.name.toLowerCase() === roleName.toLowerCase()
        );

        // If role doesn't exist, try to create it
        if (!role) {
            console.log(`⚠️  Role ${roleName} not found, attempting to create it`);
            try {
                role = await member.guild.roles.create({
                    name: roleName,
                    color: getRoleColor(roleName),
                    reason: `Auto-created by Sunny for member ${member.user.tag}`
                });
                console.log(`✅ Created role: ${roleName}`);
            } catch (createError) {
                console.error(`❌ Failed to create role ${roleName}:`, createError);
                return {
                    success: false,
                    error: `Role ${roleName} doesn't exist and I couldn't create it. Ask the server owner to create it first!`
                };
            }
        }

        // Check if member already has role
        if (member.roles.cache.has(role.id)) {
            console.log(`ℹ️  ${member.user.tag} already has role ${roleName}`);
            return {
                success: false,
                error: `You already have the ${roleName} role!`
            };
        }

        // Add role
        await member.roles.add(role);
        console.log(`✅ Added role ${roleName} to ${member.user.tag}`);

        return {
            success: true,
            role: role,
            emoji: getRoleEmoji(roleName),
            channelSuggestion: getChannelSuggestion(roleName)
        };
    } catch (error) {
        console.error(`❌ Error in addRole for ${roleName}:`, error);
        return {
            success: false,
            error: `Failed to add role: ${error.message}`
        };
    }
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

function getRoleColor(roleName) {
    const colorMap = {
        'Artist': '#E91E63',        // Pink
        'Gamer': '#9C27B0',         // Purple
        'Reader/Writer': '#3F51B5', // Indigo
        'Music Lover': '#2196F3',   // Blue
        'Movie Buff': '#00BCD4',    // Cyan
        'Night Owl': '#673AB7',     // Deep Purple
        'Early Bird': '#FFEB3B',    // Yellow
        'Photographer': '#FF9800',  // Orange
        'Crafter': '#8BC34A',       // Light Green
        'she/her': '#F48FB1',       // Light Pink
        'he/him': '#64B5F6',        // Light Blue
        'they/them': '#AED581',     // Light Green
        'any pronouns': '#FFD54F'   // Light Yellow
    };
    return colorMap[roleName] || '#FF6B35'; // Default autumn orange
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
