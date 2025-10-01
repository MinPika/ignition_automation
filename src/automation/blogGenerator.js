const AIContentGenerator = require('../services/aiContent');
const GhostService = require('../services/ghostAPI');
const keywords = require('../config/keywords');
const bloggers = require('../config/bloggers');
const contentTemplates = require('../config/contentTemplates');

class BlogGenerator {
  constructor() {
    this.aiGenerator = new AIContentGenerator();
    this.ghostService = new GhostService();
  }

  getRandomKeyword() {
    const keywordKeys = Object.keys(keywords);
    const randomKey = keywordKeys[Math.floor(Math.random() * keywordKeys.length)];
    return keywords[randomKey];
  }

  getRandomPersona() {
    const randomIndex = Math.floor(Math.random() * bloggers.length);
    return bloggers[randomIndex].name;
  }

  getRandomTemplate() {
    const templates = Object.keys(contentTemplates);
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
  }

  async generateAndCreateBlog(customKeyword = null, customPersona = null, customTemplate = null) {
    try {
      console.log('🚀 Starting blog generation process...');
      
      // Select components (random or custom)
      const keyword = customKeyword || this.getRandomKeyword();
      const persona = customPersona || this.getRandomPersona();
      const template = customTemplate || this.getRandomTemplate();
      
      console.log(`📝 Configuration:`);
      console.log(`   Topic: ${keyword}`);
      console.log(`   Author: ${persona}`);
      console.log(`   Template: ${template}`);
      console.log('');
      
      // Generate content with AI
      console.log('🤖 Generating content with AI...');
      const blogPost = await this.aiGenerator.generateBlogPost(persona, keyword, template);
      
      console.log('✅ Content generated successfully!');
      console.log(`   Title: ${blogPost.title}`);
      console.log(`   Word count: ~${blogPost.content.length / 5} words`);
      console.log('');
      
      // Create draft in Ghost
      console.log('📤 Creating draft in Ghost...');
      const createdPost = await this.ghostService.createDraft(blogPost);
      
      console.log('🎉 Blog post created successfully!');
      console.log(`📋 Title: ${createdPost.title}`);
      console.log(`🔗 Edit URL: ${process.env.GHOST_API_URL}/ghost/#/editor/post/${createdPost.id}`);
      console.log(`👀 Preview: ${createdPost.url || 'Available after publishing'}`);
      
      return createdPost;
      
    } catch (error) {
      console.error('❌ Blog generation failed:', error.message);
      throw error;
    }
  }

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

  // Quick test method
  async testGeneration() {
    try {
      await this.aiGenerator.testConnection();
      await this.ghostService.testConnection();
      console.log('✅ All systems ready for blog generation!');
      return true;
    } catch (error) {
      console.error('❌ System test failed:', error.message);
      return false;
    }
  }
}

module.exports = BlogGenerator;