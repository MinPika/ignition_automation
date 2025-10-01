// src/automation/blogGenerator.js
const AIContentGenerator = require('../services/aiContent');
const GhostService = require('../services/ghostAPI');
const ImageGenerator = require('../services/ImageGenerator');
const TopicHistory = require('../utils/topicHistory');
const PublishingScheduler = require('../services/scheduler');
const keywords = require('../config/keywords');
const bloggers = require('../config/bloggers');
const contentTemplates = require('../config/contentTemplates');

class BlogGenerator {
  constructor() {
    this.aiGenerator = new AIContentGenerator();
    this.ghostService = new GhostService();
    this.imageGenerator = new ImageGenerator();
    this.topicHistory = new TopicHistory();
    this.scheduler = new PublishingScheduler();
  }

  /**
   * Smart topic selection with deduplication
   */
  selectTopic(persona) {
    const allKeywords = Object.values(keywords);
    const allTemplates = Object.keys(contentTemplates);
    
    // Get an unused combination for this persona
    const topic = this.topicHistory.getAvailableTopic(
      persona,
      allKeywords,
      allTemplates
    );
    
    return topic;
  }

  getRandomPersona() {
    const randomIndex = Math.floor(Math.random() * bloggers.length);
    return bloggers[randomIndex].name;
  }

  /**
   * Main method: Generate complete blog with image and SEO
   * @param {string} customKeyword - Optional keyword
   * @param {string} customPersona - Optional persona
   * @param {string} customTemplate - Optional template
   * @param {Date} publishDate - Optional scheduled publish date
   */
  async generateAndCreateBlog(customKeyword = null, customPersona = null, customTemplate = null, publishDate = null) {
    try {
      console.log('🚀 Starting enhanced blog generation process...\n');
      
      // Select persona
      const persona = customPersona || this.getRandomPersona();
      console.log(`👤 Selected persona: ${persona}`);
      
      // Smart topic selection with deduplication
      let keyword, template;
      
      if (customKeyword && customTemplate) {
        keyword = customKeyword;
        template = customTemplate;
      } else if (customKeyword && !customTemplate) {
        const allTemplates = Object.keys(contentTemplates);
        const topic = this.topicHistory.getAvailableTopic(
          persona,
          [customKeyword],
          allTemplates
        );
        keyword = customKeyword;
        template = topic.template;
      } else {
        const topic = this.selectTopic(persona);
        keyword = topic.keyword;
        template = topic.template;
      }
      
      console.log(`📝 Configuration:`);
      console.log(`   Topic: ${keyword}`);
      console.log(`   Template: ${template}`);
      console.log(`   Author: ${persona}`);
      if (publishDate) {
        console.log(`   Scheduled for: ${this.scheduler.formatPublishDate(publishDate)}`);
      }
      console.log('');
      
      // Check if already used
      if (this.topicHistory.isTopicUsed(persona, keyword, template)) {
        console.log('⚠️  Warning: This topic combination was recently used by this persona');
        console.log('   Consider selecting a different combination for variety\n');
      }
      
      // Generate content with AI
      console.log('🤖 Generating content with AI...');
      const blogPost = await this.aiGenerator.generateBlogPost(persona, keyword, template);
      
      console.log('✅ Content generated successfully!');
      console.log(`   Title: ${blogPost.title}`);
      console.log(`   Word count: ~${Math.round(blogPost.content.length / 5)} words\n`);
      
      // Generate featured image
      console.log('🎨 Generating featured image...');
      const imageResult = await this.imageGenerator.generateFeaturedImage(
        keyword,
        template,
        persona
      );
      
      if (imageResult.url) {
        console.log('✅ Featured image generated and uploaded!');
        console.log(`   URL: ${imageResult.url}`);
        console.log(`   Alt text: ${imageResult.altText}\n`);
      } else {
        console.log('⚠️  Image generation failed, proceeding without featured image\n');
      }
      
      // Create draft or scheduled post in Ghost
      let createdPost;
      if (publishDate) {
        console.log('📤 Creating scheduled post in Ghost...');
        createdPost = await this.ghostService.createScheduledPost(blogPost, imageResult, publishDate);
        console.log(`📅 Post scheduled for: ${this.scheduler.formatPublishDate(publishDate)}`);
        console.log(`⏰ Time until publish: ${this.scheduler.getTimeUntilPublish(publishDate)}\n`);
      } else {
        console.log('📤 Creating draft in Ghost...');
        createdPost = await this.ghostService.createDraft(blogPost, imageResult);
      }
      
      console.log('🎉 Blog post created successfully!');
      console.log(`📋 Title: ${createdPost.title}`);
      console.log(`📊 Status: ${createdPost.status}`);
      console.log(`🔗 Edit URL: ${process.env.GHOST_API_URL}/ghost/#/editor/post/${createdPost.id}`);
      console.log(`👀 Preview: ${createdPost.url || 'Available after publishing'}\n`);
      
      // Record topic in history
      this.topicHistory.recordTopic(persona, keyword, template);
      
      return {
        post: createdPost,
        image: imageResult,
        configuration: {
          persona,
          keyword,
          template,
          publishDate: publishDate || null
        }
      };
      
    } catch (error) {
      console.error('❌ Blog generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Batch generation with automatic persona/topic rotation
   * @param {number} count - Number of posts to generate
   * @param {boolean} autoSchedule - Whether to auto-schedule posts
   */
  async generateBatch(count = 3, autoSchedule = false) {
    console.log(`🔄 Starting batch generation of ${count} posts...\n`);
    
    const results = [];
    const errors = [];
    
    // Generate schedule if auto-scheduling
    let publishDates = [];
    if (autoSchedule) {
      publishDates = this.scheduler.generateSchedule(count);
      console.log('📅 Publishing Schedule:');
      const scheduleInfo = this.scheduler.getScheduleInfo(publishDates);
      scheduleInfo.forEach(info => {
        console.log(`   ${info.slot}. ${info.date} (${info.timeUntil})`);
      });
      console.log('');
    }
    
    for (let i = 0; i < count; i++) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📝 Generating post ${i + 1} of ${count}`);
        console.log('='.repeat(60) + '\n');
        
        const publishDate = autoSchedule ? publishDates[i] : null;
        const result = await this.generateAndCreateBlog(null, null, null, publishDate);
        results.push(result);
        
        // Delay between posts to avoid API rate limits
        if (i < count - 1) {
          console.log('\n⏳ Waiting 10 seconds before next generation...\n');
          await this.sleep(10000);
        }
        
      } catch (error) {
        console.error(`❌ Post ${i + 1} failed:`, error.message);
        errors.push({ index: i + 1, error: error.message });
      }
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 BATCH GENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${results.length}`);
    console.log(`❌ Failed: ${errors.length}`);
    
    if (autoSchedule && results.length > 0) {
      console.log('\n📅 Scheduled Posts:');
      results.forEach((r, i) => {
        if (r.configuration.publishDate) {
          console.log(`   ${i + 1}. ${r.post.title}`);
          console.log(`      → ${this.scheduler.formatPublishDate(r.configuration.publishDate)}`);
        }
      });
    }
    
    if (errors.length > 0) {
      console.log('\nFailed posts:');
      errors.forEach(e => console.log(`  - Post ${e.index}: ${e.error}`));
    }
    
    return { results, errors };
  }

  /**
   * Schedule existing draft for publication
   * @param {string} postId - Ghost post ID
   * @param {Date} publishDate - When to publish
   */
  async scheduleExistingDraft(postId, publishDate) {
    try {
      if (!this.scheduler.isValidFutureDate(publishDate)) {
        throw new Error('Publish date must be in the future');
      }

      console.log(`📅 Scheduling post ${postId}...`);
      const scheduledPost = await this.ghostService.scheduleDraft(postId, publishDate);
      
      console.log('✅ Post scheduled successfully!');
      console.log(`   Title: ${scheduledPost.title}`);
      console.log(`   Scheduled for: ${this.scheduler.formatPublishDate(publishDate)}`);
      console.log(`   Time until publish: ${this.scheduler.getTimeUntilPublish(publishDate)}`);
      
      return scheduledPost;
    } catch (error) {
      console.error('❌ Scheduling failed:', error.message);
      throw error;
    }
  }

  /**
   * Get scheduling presets
   */
  getSchedulingPresets() {
    const presets = this.scheduler.getPresets();
    console.log('\n📋 Available Scheduling Presets:\n');
    
    for (const [key, preset] of Object.entries(presets)) {
      console.log(`   ${key}: ${preset.name}`);
    }
    
    return presets;
  }

  /**
   * Preview upcoming schedule
   * @param {number} count - Number of slots to preview
   * @param {string} presetKey - Preset key (optional)
   */
  previewSchedule(count = 5, presetKey = null) {
    const schedule = presetKey ? 
      this.scheduler.getPresets()[presetKey].schedule : 
      null;
    
    const dates = this.scheduler.generateSchedule(count, new Date(), schedule);
    const info = this.scheduler.getScheduleInfo(dates);
    
    console.log(`\n📅 Preview: Next ${count} Publishing Slots\n`);
    info.forEach(slot => {
      console.log(`   ${slot.slot}. ${slot.date}`);
      console.log(`      ${slot.dayOfWeek} (in ${slot.timeUntil})\n`);
    });
    
    return info;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Publish a draft post
   */
  async publishDraft(postId) {
    try {
      console.log(`📢 Publishing post ID: ${postId}`);
      const publishedPost = await this.ghostService.publishPost(postId);
      console.log('✅ Post published successfully!');
      console.log(`🔗 Live URL: ${publishedPost.url}`);
      return publishedPost;
    } catch (error) {
      console.error('❌ Publishing failed:', error.message);
      throw error;
    }
  }

  /**
   * Get topic usage statistics with title tracking
   */
  getTopicStats() {
    const stats = this.topicHistory.getStats();
    console.log('\n📊 Topic Usage Statistics:');
    console.log('='.repeat(60));
    
    // Check for potential repetition
    let hasRepetition = false;
    
    for (const persona in stats) {
      console.log(`\n👤 ${persona}:`);
      console.log(`   Total topics used: ${stats[persona].totalUsed}`);
      console.log(`   Recent topics:`);
      
      const topics = stats[persona].recentTopics;
      const keywordCounts = {};
      
      topics.forEach((topic, i) => {
        const [keyword, template] = topic.split('::');
        console.log(`     ${i + 1}. ${keyword} (${template})`);
        
        // Track keyword repetition
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      });
      
      // Warning if same keyword used too much
      for (const [keyword, count] of Object.entries(keywordCounts)) {
        if (count > 2) {
          console.log(`   ⚠️  WARNING: "${keyword}" used ${count} times - consider using other topics`);
          hasRepetition = true;
        }
      }
    }
    
    if (hasRepetition) {
      console.log('\n💡 TIP: Run "npm run clear-history" to reset and allow more variety');
    }
    
    return stats;
  }

  /**
   * Test all systems
   */
  async testGeneration() {
    try {
      console.log('🧪 Testing all systems...\n');
      
      await this.aiGenerator.testConnection();
      await this.ghostService.testConnection();
      await this.imageGenerator.testConnection();
      
      console.log('\n✅ All systems ready for blog generation!');
      return true;
    } catch (error) {
      console.error('❌ System test failed:', error.message);
      return false;
    }
  }
}

module.exports = BlogGenerator;