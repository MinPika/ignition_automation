// src/utils/topicHistory.js
const fs = require('fs-extra');
const path = require('path');

class TopicHistory {
  constructor() {
    this.historyFile = path.join(process.cwd(), 'generated', 'topic-history.json');
    this.maxHistoryPerPersona = 50;
    this.ensureHistoryFile();
  }

  ensureHistoryFile() {
    if (!fs.existsSync(this.historyFile)) {
      fs.ensureDirSync(path.dirname(this.historyFile));
      fs.writeJsonSync(this.historyFile, {}, { spaces: 2 });
    }
  }

  loadHistory() {
    try {
      return fs.readJsonSync(this.historyFile);
    } catch (error) {
      console.error('Error loading topic history:', error.message);
      return {};
    }
  }

  saveHistory(history) {
    try {
      fs.writeJsonSync(this.historyFile, history, { spaces: 2 });
    } catch (error) {
      console.error('Error saving topic history:', error.message);
    }
  }

  /**
   * Check if a topic combination has been used recently
   * @param {string} persona - Persona name
   * @param {string} keyword - Keyword/topic
   * @param {string} template - Template type
   * @returns {boolean} - True if already used recently
   */
  isTopicUsed(persona, keyword, template) {
    const history = this.loadHistory();
    
    if (!history[persona]) {
      return false;
    }

    const topicKey = `${keyword}::${template}`;
    return history[persona].includes(topicKey);
  }

  /**
   * Record a used topic combination
   * @param {string} persona - Persona name
   * @param {string} keyword - Keyword/topic
   * @param {string} template - Template type
   */
  recordTopic(persona, keyword, template) {
    const history = this.loadHistory();
    
    if (!history[persona]) {
      history[persona] = [];
    }

    const topicKey = `${keyword}::${template}`;
    
    // Add to beginning of array
    history[persona].unshift(topicKey);
    
    // Keep only last N topics
    if (history[persona].length > this.maxHistoryPerPersona) {
      history[persona] = history[persona].slice(0, this.maxHistoryPerPersona);
    }

    this.saveHistory(history);
    console.log(`📝 Recorded topic: ${persona} → ${keyword} (${template})`);
  }

  /**
   * Get available topics for a persona (not recently used)
   * @param {string} persona - Persona name
   * @param {Array} allKeywords - All available keywords
   * @param {Array} allTemplates - All available templates
   * @returns {Object|null} - {keyword, template} or null if all exhausted
   */
  getAvailableTopic(persona, allKeywords, allTemplates) {
    const history = this.loadHistory();
    const usedTopics = history[persona] || [];

    // Try all combinations
    for (const keyword of allKeywords) {
      for (const template of allTemplates) {
        const topicKey = `${keyword}::${template}`;
        if (!usedTopics.includes(topicKey)) {
          return { keyword, template };
        }
      }
    }

    // If all combinations used, reset and start fresh
    console.log(`🔄 All topics exhausted for ${persona}, resetting history...`);
    history[persona] = [];
    this.saveHistory(history);
    
    // Return first combination
    return {
      keyword: allKeywords[0],
      template: allTemplates[0]
    };
  }

  /**
   * Get statistics about topic usage
   * @returns {Object} - Statistics per persona
   */
  getStats() {
    const history = this.loadHistory();
    const stats = {};

    for (const persona in history) {
      stats[persona] = {
        totalUsed: history[persona].length,
        recentTopics: history[persona].slice(0, 5)
      };
    }

    return stats;
  }

  /**
   * Clear history for a specific persona or all
   * @param {string|null} persona - Persona name or null for all
   */
  clearHistory(persona = null) {
    const history = this.loadHistory();

    if (persona) {
      history[persona] = [];
      console.log(`🗑️  Cleared history for ${persona}`);
    } else {
      fs.writeJsonSync(this.historyFile, {}, { spaces: 2 });
      console.log('🗑️  Cleared all topic history');
    }

    this.saveHistory(history);
  }
}

module.exports = TopicHistory;