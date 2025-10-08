// src/utils/topicHistory.js - Enhanced with title tracking
const fs = require('fs-extra');
const path = require('path');

class TopicHistory {
  constructor() {
    this.historyFile = path.join(process.cwd(), 'generated', 'topic-history.json');
    this.titlesFile = path.join(process.cwd(), 'generated', 'title-history.json');
    this.maxHistoryPerPersona = 50;
    this.maxTitleHistory = 200; // Track last 200 titles globally
    this.ensureHistoryFiles();
  }

  ensureHistoryFiles() {
    const dir = path.join(process.cwd(), 'generated');
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (!fs.existsSync(this.historyFile)) {
      fs.writeJsonSync(this.historyFile, {}, { spaces: 2 });
    }
    
    if (!fs.existsSync(this.titlesFile)) {
      fs.writeJsonSync(this.titlesFile, { titles: [] }, { spaces: 2 });
    }
  }

  loadHistory() {
    try {
      const data = fs.readJsonSync(this.historyFile);
      return data || {};
    } catch (error) {
      console.error('⚠️  Error loading topic history:', error.message);
      // Try to backup corrupted file
      this.backupCorruptedFile(this.historyFile);
      return {};
    }
  }

  saveHistory(history) {
    try {
      // Create backup before saving
      if (fs.existsSync(this.historyFile)) {
        const backupFile = this.historyFile.replace('.json', '.backup.json');
        fs.copyFileSync(this.historyFile, backupFile);
      }
      
      fs.writeJsonSync(this.historyFile, history, { spaces: 2 });
    } catch (error) {
      console.error('❌ Error saving topic history:', error.message);
      throw new Error('Failed to save topic history - disk may be full');
    }
  }

  loadTitles() {
    try {
      const data = fs.readJsonSync(this.titlesFile);
      return data.titles || [];
    } catch (error) {
      console.error('⚠️  Error loading title history:', error.message);
      this.backupCorruptedFile(this.titlesFile);
      return [];
    }
  }

  saveTitles(titles) {
    try {
      // Create backup
      if (fs.existsSync(this.titlesFile)) {
        const backupFile = this.titlesFile.replace('.json', '.backup.json');
        fs.copyFileSync(this.titlesFile, backupFile);
      }
      
      fs.writeJsonSync(this.titlesFile, { titles }, { spaces: 2 });
    } catch (error) {
      console.error('❌ Error saving title history:', error.message);
      throw new Error('Failed to save title history');
    }
  }

  backupCorruptedFile(filepath) {
    try {
      const timestamp = Date.now();
      const backupPath = filepath.replace('.json', `.corrupted.${timestamp}.json`);
      if (fs.existsSync(filepath)) {
        fs.copyFileSync(filepath, backupPath);
        console.log(`📦 Corrupted file backed up to: ${backupPath}`);
      }
    } catch (error) {
      console.error('Failed to backup corrupted file:', error.message);
    }
  }

  /**
   * Check if a topic combination has been used recently
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
   * Check if a title (or very similar title) already exists
   */
  isTitleUsed(title) {
    const titles = this.loadTitles();
    const normalizedTitle = this.normalizeTitle(title);
    
    for (const existingTitle of titles) {
      const normalizedExisting = this.normalizeTitle(existingTitle);
      
      // Exact match
      if (normalizedTitle === normalizedExisting) {
        return true;
      }
      
      // Similarity check (80% threshold)
      if (this.calculateSimilarity(normalizedTitle, normalizedExisting) > 0.8) {
        return true;
      }
    }
    
    return false;
  }

  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  calculateSimilarity(str1, str2) {
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Record a used topic combination
   */
  recordTopic(persona, keyword, template) {
    const history = this.loadHistory();
    
    if (!history[persona]) {
      history[persona] = [];
    }

    const topicKey = `${keyword}::${template}`;
    
    // Remove if already exists (move to front)
    history[persona] = history[persona].filter(t => t !== topicKey);
    
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
   * Record a used title
   */
  recordTitle(title) {
    const titles = this.loadTitles();
    
    // Remove if already exists
    const filtered = titles.filter(t => this.normalizeTitle(t) !== this.normalizeTitle(title));
    
    // Add to beginning
    filtered.unshift(title);
    
    // Keep only last N titles
    const trimmed = filtered.slice(0, this.maxTitleHistory);
    
    this.saveTitles(trimmed);
    console.log(`📝 Recorded title: ${title}`);
  }

  /**
   * Get available topics for a persona (not recently used)
   */
  getAvailableTopic(persona, allKeywords, allTemplates) {
    const history = this.loadHistory();
    const usedTopics = history[persona] || [];

    // Create all possible combinations
    const allCombinations = [];
    for (const keyword of allKeywords) {
      for (const template of allTemplates) {
        allCombinations.push({ keyword, template });
      }
    }

    // Filter to unused combinations
    const availableCombinations = allCombinations.filter(combo => {
      const topicKey = `${combo.keyword}::${combo.template}`;
      return !usedTopics.includes(topicKey);
    });

    if (availableCombinations.length > 0) {
      // Randomly select from available
      const randomIndex = Math.floor(Math.random() * availableCombinations.length);
      return availableCombinations[randomIndex];
    }

    // If all combinations used, reset and start fresh
    console.log(`🔄 All topics exhausted for ${persona}, resetting history...`);
    history[persona] = [];
    this.saveHistory(history);
    
    // Return random combination
    const randomKeyword = allKeywords[Math.floor(Math.random() * allKeywords.length)];
    const randomTemplate = allTemplates[Math.floor(Math.random() * allTemplates.length)];
    
    return {
      keyword: randomKeyword,
      template: randomTemplate
    };
  }

  /**
   * Get statistics about topic usage
   */
  getStats() {
    const history = this.loadHistory();
    const titles = this.loadTitles();
    
    const stats = {};

    for (const persona in history) {
      const topics = history[persona] || [];
      
      // Count keyword usage
      const keywordCounts = {};
      topics.forEach(topic => {
        const [keyword] = topic.split('::');
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      });

      stats[persona] = {
        totalUsed: topics.length,
        recentTopics: topics.slice(0, 10),
        keywordCounts: keywordCounts
      };
    }
    
    stats._global = {
      totalTitles: titles.length,
      recentTitles: titles.slice(0, 10)
    };

    return stats;
  }

  /**
   * Clear history for a specific persona or all
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

  /**
   * Clear title history
   */
  clearTitleHistory() {
    this.saveTitles([]);
    console.log('🗑️  Cleared all title history');
  }

  /**
   * Validate history file integrity
   */
  validateHistory() {
    try {
      const history = this.loadHistory();
      const titles = this.loadTitles();
      
      console.log('✅ History files are valid');
      console.log(`   Topics tracked: ${Object.keys(history).length} personas`);
      console.log(`   Titles tracked: ${titles.length}`);
      
      return true;
    } catch (error) {
      console.error('❌ History validation failed:', error.message);
      return false;
    }
  }
}

module.exports = TopicHistory;