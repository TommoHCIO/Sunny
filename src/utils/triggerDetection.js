// src/utils/triggerDetection.js

/**
 * Detects if Sunny should respond to a message
 * Checks three trigger types: Reply, @Mention, Natural mention
 */
async function detectTrigger(client, message) {
    let triggerType = null;
    let replyContext = null;
    
    // Priority 1: Check if message is a reply to Sunny
    if (message.reference) {
        try {
            const repliedMessage = await message.channel.messages.fetch(
                message.reference.messageId
            );
            
            if (repliedMessage.author.id === client.user.id) {
                triggerType = 'REPLY';
                replyContext = repliedMessage.content;
            }
        } catch (error) {
            console.error('Error fetching replied message:', error);
        }
    }
    
    // Priority 2: Check if bot was @mentioned
    if (!triggerType && message.mentions.has(client.user)) {
        triggerType = 'MENTION';
    }
    
    // Priority 3: Check for natural "Sunny" mention
    if (!triggerType) {
        const content = message.content.toLowerCase();
        
        // Check for false positives first
        const falsePositives = [
            /sunny day/i,
            /sunny weather/i,
            /it'?s sunny/i,
            /sunny outside/i,
            /sunny side up/i
        ];
        
        const isFalsePositive = falsePositives.some(pattern => 
            pattern.test(content)
        );
        
        if (!isFalsePositive) {
            // Check for genuine Sunny mentions
            const triggerPatterns = [
                /\bsunny\b/i,           // Word boundary
                /^sunny[,:]?/i,         // Starts with Sunny
                /hey sunny/i,
                /thanks sunny/i,
                /thank you sunny/i,
                /morning sunny/i,
                /good ?night sunny/i,
                /love you sunny/i       // Aww 🧡
            ];
            
            const isTriggered = triggerPatterns.some(pattern => 
                pattern.test(content)
            );
            
            if (isTriggered) {
                triggerType = 'NATURAL';
            }
        }
    }
    
    return {
        triggered: !!triggerType,
        type: triggerType,
        replyContext: replyContext
    };
}

module.exports = { detectTrigger };
