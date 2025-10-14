// src/utils/messageComplexity.js
/**
 * Message Complexity Analyzer
 * Analyzes Discord messages to determine appropriate response length
 * Based on AI chatbot best practices: 80% simple, 15% moderate, 5% complex queries
 */

class MessageComplexityAnalyzer {
    constructor() {
        // Greeting patterns
        this.greetingPatterns = /^(hi|hello|hey|sup|yo|morning|evening|night|goodbye|bye|thanks|thank you|ty|thx|cool|nice|awesome|great|ok|okay)\b/i;

        // Simple question words
        this.simpleQuestions = /^(what's|whats|who's|whos|where's|wheres|when's|whens|is|are|can|could|will|would|should)\b/i;

        // Complex question indicators
        this.complexIndicators = /\b(how|why|explain|describe|configure|setup|debug|error|issue|problem|help me understand)\b/i;

        // Technical keywords
        this.technicalKeywords = /\b(error|exception|traceback|debug|api|webhook|permission|timeout|ban|kick|moderate|automod|reaction role|verification system)\b/i;

        // Multiple operation indicators
        this.multiOperationWords = /\b(and|then|after that|also|plus|additionally|furthermore|as well as)\b/i;
    }

    /**
     * Analyze message complexity
     * @param {string} message - The user's message
     * @param {boolean} hasAttachments - Whether message has attachments
     * @returns {string} Complexity level: GREETING, SIMPLE, MODERATE, COMPLEX, or TECHNICAL
     */
    analyzeComplexity(message, hasAttachments = false) {
        if (!message || message.length === 0) {
            return 'SIMPLE';
        }

        // Clean message for analysis
        const cleanMessage = message.toLowerCase().trim();
        const wordCount = cleanMessage.split(/\s+/).length;
        const questionMarkCount = (message.match(/\?/g) || []).length;

        // Check for greeting first (highest priority for brevity)
        if (this.greetingPatterns.test(cleanMessage) && wordCount <= 5) {
            return 'GREETING';
        }

        // Check for technical content
        if (this.technicalKeywords.test(cleanMessage)) {
            // Technical questions about errors or complex features
            if (this.complexIndicators.test(cleanMessage) || questionMarkCount > 1) {
                return 'TECHNICAL';
            }
            // Simple technical tasks (e.g., "ban user123")
            if (wordCount < 10) {
                return 'MODERATE';
            }
            return 'COMPLEX';
        }

        // Check for complex multi-part requests
        if (this.multiOperationWords.test(cleanMessage) && wordCount > 15) {
            return 'COMPLEX';
        }

        // Check for "how" or "why" questions (usually need detailed answers)
        if (this.complexIndicators.test(cleanMessage)) {
            if (wordCount > 20) {
                return 'TECHNICAL'; // Long, detailed questions
            }
            return 'COMPLEX';
        }

        // Attachments often indicate moderate complexity (sticker/emoji creation)
        if (hasAttachments) {
            return 'MODERATE';
        }

        // Simple questions
        if (this.simpleQuestions.test(cleanMessage) && wordCount <= 10) {
            return 'SIMPLE';
        }

        // Use word count as fallback
        if (wordCount <= 7) {
            return 'SIMPLE';
        } else if (wordCount <= 20) {
            return 'MODERATE';
        } else if (wordCount <= 40) {
            return 'COMPLEX';
        } else {
            return 'TECHNICAL'; // Very long messages likely need detailed responses
        }
    }

    /**
     * Get response guidelines for a complexity level
     * @param {string} complexity - The complexity level
     * @returns {string} Specific response guidelines
     */
    getResponseGuidelines(complexity) {
        const guidelines = {
            GREETING: "Respond in 1-2 sentences maximum. Be warm but very brief. Just acknowledge and offer help.",
            SIMPLE: "Keep response to 2-3 sentences. Be direct, friendly, and to the point.",
            MODERATE: "Use 3-5 sentences. Confirm the action, provide the result, and ask if anything else is needed.",
            COMPLEX: "Use 4-8 sentences. Break down multiple steps clearly. Explain what you're doing and why.",
            TECHNICAL: "Be thorough but stay concise. Use bullet points or numbered lists for clarity. Include relevant technical details but avoid unnecessary verbosity."
        };

        return guidelines[complexity] || guidelines.MODERATE;
    }

    /**
     * Get maximum recommended sentences for a complexity level
     * @param {string} complexity - The complexity level
     * @returns {number} Maximum recommended sentence count
     */
    getMaxSentences(complexity) {
        const limits = {
            GREETING: 2,
            SIMPLE: 3,
            MODERATE: 5,
            COMPLEX: 8,
            TECHNICAL: 15 // Higher limit but should still be concise
        };

        return limits[complexity] || 5;
    }

    /**
     * Analyze if a message is asking for a list or enumeration
     * @param {string} message - The user's message
     * @returns {boolean} True if the message requests a list
     */
    isListRequest(message) {
        const listPatterns = /\b(list|show me all|what are all|enumerate|tell me all|give me all)\b/i;
        return listPatterns.test(message);
    }

    /**
     * Get a complexity summary for logging
     * @param {string} message - The user's message
     * @returns {Object} Analysis summary
     */
    getComplexitySummary(message, hasAttachments = false) {
        const complexity = this.analyzeComplexity(message, hasAttachments);
        const wordCount = message.split(/\s+/).length;
        const isListRequest = this.isListRequest(message);

        return {
            complexity,
            wordCount,
            guidelines: this.getResponseGuidelines(complexity),
            maxSentences: this.getMaxSentences(complexity),
            isListRequest,
            hasAttachments
        };
    }
}

// Export singleton instance
module.exports = new MessageComplexityAnalyzer();