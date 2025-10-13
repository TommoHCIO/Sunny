// src/services/ticketService.js
/**
 * Ticket Service
 * Thread-based ticketing system with transcripts and analytics
 */

const { 
    ChannelType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagBits 
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const Ticket = require('../models/Ticket');
const ServerSettings = require('../models/ServerSettings');

/**
 * Create a new support ticket
 * @param {Guild} guild - Discord guild
 * @param {GuildMember} member - Member creating the ticket
 * @param {string} category - Ticket category
 * @param {string} subject - Ticket subject
 * @param {string} description - Ticket description (optional)
 * @returns {Promise<Object>} Ticket data and thread
 */
async function createTicket(guild, member, category, subject, description = '') {
    try {
        const settings = await ServerSettings.findOne({ guildId: guild.id });
        
        if (!settings?.ticketing?.enabled) {
            throw new Error('Ticketing system is not enabled for this server');
        }
        
        const supportChannelId = settings.ticketing.supportChannelId;
        if (!supportChannelId) {
            throw new Error('No support channel configured');
        }
        
        const supportChannel = guild.channels.cache.get(supportChannelId);
        if (!supportChannel) {
            throw new Error('Support channel not found');
        }
        
        // Generate ticket number and ID
        const ticketNumber = await Ticket.getNextTicketNumber(guild.id);
        const ticketId = Ticket.generateTicketId(guild.id, ticketNumber);
        
        // Create private thread
        const threadName = `🎫 ${subject} (#${ticketNumber})`;
        const thread = await supportChannel.threads.create({
            name: threadName,
            type: ChannelType.PrivateThread,
            reason: `Ticket created by ${member.user.tag}`
        });
        
        // Add ticket creator to thread
        await thread.members.add(member.id);
        
        // Create ticket in database
        const ticket = await Ticket.create({
            ticketId,
            ticketNumber,
            guildId: guild.id,
            threadId: thread.id,
            channelId: supportChannel.id,
            creatorId: member.id,
            status: 'open',
            category,
            subject,
            description,
            participants: [{
                userId: member.id,
                joinedAt: new Date()
            }]
        });
        
        // Send initial ticket message
        const embed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle(`Ticket #${ticketNumber} - ${subject}`)
            .setDescription(description || 'No description provided')
            .addFields(
                { name: 'Category', value: category, inline: true },
                { name: 'Status', value: '🟢 Open', inline: true },
                { name: 'Priority', value: ticket.priority, inline: true },
                { name: 'Created By', value: `<@${member.id}>`, inline: true },
                { name: 'Ticket ID', value: ticketId, inline: true }
            )
            .setFooter({ text: 'Use buttons below to manage this ticket' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_claim_${ticket._id}`)
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✋'),
                new ButtonBuilder()
                    .setCustomId(`ticket_close_${ticket._id}`)
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId(`ticket_priority_${ticket._id}`)
                    .setLabel('Set Priority')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚠️')
            );
        
        await thread.send({
            content: `${member}, your ticket has been created! Staff will be with you shortly. 🍂`,
            embeds: [embed],
            components: [row]
        });
        
        // Notify staff if configured
        if (settings.ticketing.staffNotifyChannelId) {
            const staffChannel = guild.channels.cache.get(settings.ticketing.staffNotifyChannelId);
            if (staffChannel) {
                const notifyEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('🆕 New Ticket Created')
                    .addFields(
                        { name: 'Ticket', value: `#${ticketNumber} - ${subject}` },
                        { name: 'Category', value: category, inline: true },
                        { name: 'Created By', value: `<@${member.id}>`, inline: true }
                    )
                    .setDescription(`[View Ticket](https://discord.com/channels/${guild.id}/${thread.id})`)
                    .setTimestamp();
                
                await staffChannel.send({ embeds: [notifyEmbed] });
            }
        }
        
        console.log(`[Ticket] Created ticket #${ticketNumber} for ${member.user.tag}`);
        return { ticket, thread };
    } catch (error) {
        console.error('[Ticket] Failed to create ticket:', error);
        throw error;
    }
}

/**
 * Close a ticket
 * @param {string} ticketId - Ticket ID or MongoDB _id
 * @param {GuildMember} staffMember - Staff member closing the ticket
 * @param {string} reason - Reason for closing
 * @returns {Promise<Object>} Closed ticket
 */
async function closeTicket(ticketId, staffMember, reason = 'Resolved') {
    try {
        // Find ticket by ticketId or MongoDB _id
        const ticket = await Ticket.findOne({
            $or: [
                { ticketId },
                { _id: ticketId }
            ]
        });
        
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        
        if (ticket.status === 'closed') {
            throw new Error('Ticket is already closed');
        }
        
        const guild = staffMember.guild;
        const thread = guild.channels.cache.get(ticket.threadId);
        
        if (!thread) {
            throw new Error('Ticket thread not found');
        }
        
        // Calculate resolution time
        const resolutionTime = Date.now() - ticket.createdAt.getTime();
        
        // Update ticket in database
        ticket.status = 'closed';
        ticket.closedAt = new Date();
        ticket.closedBy = staffMember.id;
        ticket.closeReason = reason;
        ticket.metadata.resolutionTime = resolutionTime;
        await ticket.save();
        
        // Generate transcript if enabled
        const settings = await ServerSettings.findOne({ guildId: guild.id });
        let transcriptUrl = null;
        
        if (settings?.ticketing?.transcripts?.enabled) {
            transcriptUrl = await generateTranscript(thread, ticket, guild, settings);
            ticket.transcriptUrl = transcriptUrl;
            await ticket.save();
        }
        
        // Send closure message
        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🔒 Ticket Closed')
            .addFields(
                { name: 'Ticket', value: `#${ticket.ticketNumber} - ${ticket.subject}` },
                { name: 'Closed By', value: `<@${staffMember.id}>`, inline: true },
                { name: 'Reason', value: reason, inline: true },
                { name: 'Resolution Time', value: formatDuration(resolutionTime), inline: true }
            )
            .setFooter({ text: 'This thread will be archived in 10 seconds' })
            .setTimestamp();
        
        if (transcriptUrl) {
            embed.addFields({ name: 'Transcript', value: `[View Transcript](${transcriptUrl})` });
        }
        
        await thread.send({ embeds: [embed] });
        
        // Archive and lock thread after delay
        setTimeout(async () => {
            try {
                await thread.setArchived(true);
                await thread.setLocked(true);
            } catch (error) {
                console.error('[Ticket] Failed to archive thread:', error);
            }
        }, 10000);
        
        console.log(`[Ticket] Closed ticket #${ticket.ticketNumber} by ${staffMember.user.tag}`);
        return ticket;
    } catch (error) {
        console.error('[Ticket] Failed to close ticket:', error);
        throw error;
    }
}

/**
 * Assign a ticket to a staff member
 * @param {string} ticketId - Ticket ID or MongoDB _id
 * @param {GuildMember} staffMember - Staff member to assign
 * @returns {Promise<Object>} Updated ticket
 */
async function assignTicket(ticketId, staffMember) {
    try {
        const ticket = await Ticket.findOne({
            $or: [
                { ticketId },
                { _id: ticketId }
            ]
        });
        
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        
        const guild = staffMember.guild;
        const thread = guild.channels.cache.get(ticket.threadId);
        
        if (!thread) {
            throw new Error('Ticket thread not found');
        }
        
        // Update ticket
        const wasUnassigned = !ticket.assignedTo;
        ticket.assignedTo = staffMember.id;
        ticket.status = 'in-progress';
        
        // Record first response time if this is the first assignment
        if (wasUnassigned && !ticket.metadata.firstResponseTime) {
            ticket.metadata.firstResponseTime = Date.now() - ticket.createdAt.getTime();
        }
        
        await ticket.save();
        
        // Add staff member to thread
        await thread.members.add(staffMember.id);
        
        // Add to participants if not already there
        if (!ticket.participants.some(p => p.userId === staffMember.id)) {
            ticket.participants.push({
                userId: staffMember.id,
                joinedAt: new Date()
            });
            await ticket.save();
        }
        
        // Send assignment message
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('✋ Ticket Claimed')
            .setDescription(`<@${staffMember.id}> has claimed this ticket and will assist you!`)
            .setTimestamp();
        
        await thread.send({ embeds: [embed] });
        
        console.log(`[Ticket] Assigned ticket #${ticket.ticketNumber} to ${staffMember.user.tag}`);
        return ticket;
    } catch (error) {
        console.error('[Ticket] Failed to assign ticket:', error);
        throw error;
    }
}

/**
 * Update ticket priority
 * @param {string} ticketId - Ticket ID or MongoDB _id
 * @param {string} priority - New priority (low, normal, high, urgent)
 * @returns {Promise<Object>} Updated ticket
 */
async function updateTicketPriority(ticketId, priority) {
    try {
        const ticket = await Ticket.findOne({
            $or: [
                { ticketId },
                { _id: ticketId }
            ]
        });
        
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        
        ticket.priority = priority;
        await ticket.save();
        
        console.log(`[Ticket] Updated ticket #${ticket.ticketNumber} priority to ${priority}`);
        return ticket;
    } catch (error) {
        console.error('[Ticket] Failed to update ticket priority:', error);
        throw error;
    }
}

/**
 * List tickets with filters
 * @param {string} guildId - Guild ID
 * @param {Object} filters - Optional filters (status, category, assignedTo, creatorId)
 * @returns {Promise<Array>} Array of tickets
 */
async function listTickets(guildId, filters = {}) {
    try {
        const query = { guildId, ...filters };
        return await Ticket.find(query)
            .sort({ createdAt: -1 })
            .limit(50);
    } catch (error) {
        console.error('[Ticket] Failed to list tickets:', error);
        throw error;
    }
}

/**
 * Get ticket statistics
 * @param {string} guildId - Guild ID
 * @returns {Promise<Object>} Ticket statistics
 */
async function getTicketStats(guildId) {
    try {
        const allTickets = await Ticket.find({ guildId });
        
        const stats = {
            total: allTickets.length,
            open: allTickets.filter(t => t.status === 'open').length,
            inProgress: allTickets.filter(t => t.status === 'in-progress').length,
            closed: allTickets.filter(t => t.status === 'closed').length,
            byCategory: {},
            avgResolutionTime: 0,
            avgFirstResponseTime: 0
        };
        
        // Calculate category breakdown
        for (const ticket of allTickets) {
            stats.byCategory[ticket.category] = (stats.byCategory[ticket.category] || 0) + 1;
        }
        
        // Calculate average times
        const closedTickets = allTickets.filter(t => t.status === 'closed' && t.metadata.resolutionTime);
        if (closedTickets.length > 0) {
            const totalResolutionTime = closedTickets.reduce((sum, t) => sum + (t.metadata.resolutionTime || 0), 0);
            stats.avgResolutionTime = totalResolutionTime / closedTickets.length;
        }
        
        const respondedTickets = allTickets.filter(t => t.metadata.firstResponseTime);
        if (respondedTickets.length > 0) {
            const totalResponseTime = respondedTickets.reduce((sum, t) => sum + (t.metadata.firstResponseTime || 0), 0);
            stats.avgFirstResponseTime = totalResponseTime / respondedTickets.length;
        }
        
        return stats;
    } catch (error) {
        console.error('[Ticket] Failed to get ticket stats:', error);
        throw error;
    }
}

/**
 * Generate HTML transcript of a ticket thread
 * @param {ThreadChannel} thread - Discord thread
 * @param {Ticket} ticket - Ticket document
 * @param {Guild} guild - Discord guild
 * @param {ServerSettings} settings - Server settings
 * @returns {Promise<string>} Transcript URL or file path
 */
async function generateTranscript(thread, ticket, guild, settings) {
    try {
        const attachment = await discordTranscripts.createTranscript(thread, {
            limit: -1, // All messages
            returnType: 'attachment',
            filename: `ticket-${ticket.ticketNumber}-transcript.html`,
            saveImages: true,
            poweredBy: false
        });
        
        // Send transcript to configured channel
        if (settings.ticketing.transcripts.channelId) {
            const transcriptChannel = guild.channels.cache.get(settings.ticketing.transcripts.channelId);
            if (transcriptChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#95A5A6')
                    .setTitle(`📄 Ticket #${ticket.ticketNumber} Transcript`)
                    .addFields(
                        { name: 'Subject', value: ticket.subject },
                        { name: 'Category', value: ticket.category, inline: true },
                        { name: 'Status', value: ticket.status, inline: true },
                        { name: 'Created By', value: `<@${ticket.creatorId}>`, inline: true }
                    )
                    .setTimestamp();
                
                const message = await transcriptChannel.send({
                    embeds: [embed],
                    files: [attachment]
                });
                
                // Return URL to transcript message
                return `https://discord.com/channels/${guild.id}/${transcriptChannel.id}/${message.id}`;
            }
        }
        
        return 'Transcript generated (no channel configured)';
    } catch (error) {
        console.error('[Ticket] Failed to generate transcript:', error);
        return null;
    }
}

/**
 * Format duration in milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Add a tag to a ticket
 * @param {string} ticketId - Ticket ID or MongoDB _id
 * @param {string} tag - Tag to add
 * @returns {Promise<Object>} Updated ticket
 */
async function addTicketTag(ticketId, tag) {
    try {
        const ticket = await Ticket.findOne({
            $or: [
                { ticketId },
                { _id: ticketId }
            ]
        });
        
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        
        if (!ticket.tags.includes(tag.toLowerCase())) {
            ticket.tags.push(tag.toLowerCase());
            await ticket.save();
        }
        
        return ticket;
    } catch (error) {
        console.error('[Ticket] Failed to add tag:', error);
        throw error;
    }
}

/**
 * Get a specific ticket
 * @param {string} ticketId - Ticket ID or MongoDB _id
 * @returns {Promise<Object>} Ticket document
 */
async function getTicket(ticketId) {
    try {
        return await Ticket.findOne({
            $or: [
                { ticketId },
                { _id: ticketId }
            ]
        });
    } catch (error) {
        console.error('[Ticket] Failed to get ticket:', error);
        throw error;
    }
}

module.exports = {
    createTicket,
    closeTicket,
    assignTicket,
    updateTicketPriority,
    listTickets,
    getTicketStats,
    generateTranscript,
    addTicketTag,
    getTicket,
    formatDuration
};
