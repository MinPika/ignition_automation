// src/services/ghostAPI.js
const GhostAdminAPI = require('@tryghost/admin-api');
require('dotenv').config();

class GhostService {
  constructor() {
    this.api = new GhostAdminAPI({
      url: process.env.GHOST_API_URL,
      key: process.env.GHOST_ADMIN_API_KEY,
      version: 'v5.0'
    });
  }

  /**
   * Create scheduled post (future publication)
   * @param {Object} postData - Blog post data
   * @param {Object} imageData - Image data (optional)
   * @param {Date} publishDate - When to publish
   */
  async createScheduledPost(postData, imageData = null, publishDate) {
    try {
      const cleanContent = this.cleanContentForGhost(postData.content);
      const lexicalContent = this.htmlToLexical(cleanContent);
      
      const postPayload = {
        title: postData.title,
        lexical: JSON.stringify(lexicalContent),
        status: 'scheduled',
        published_at: new Date(publishDate).toISOString(),
        meta_title: postData.metaTitle,
        meta_description: postData.metaDescription,
        og_title: postData.ogTitle,
        og_description: postData.ogDescription
      };

      // Add featured image if available
      if (imageData && imageData.url) {
        postPayload.feature_image = imageData.url;
        postPayload.feature_image_alt = imageData.altText;
      }

      console.log('📤 Sending scheduled post to Ghost...');
      console.log('   Title:', postPayload.title);
      console.log('   Status: scheduled');
      console.log('   Publish at:', new Date(publishDate).toLocaleString());
      
      const post = await this.api.posts.add(postPayload);
      
      console.log('📥 Ghost Response:');
      console.log('   Post ID:', post.id);
      console.log('   Status:', post.status);
      console.log('   Scheduled for:', new Date(post.published_at).toLocaleString());
      
      return post;
    } catch (error) {
      console.error('❌ Error creating scheduled post:', error.message);
      throw error;
    }
  }

  /**
   * Create draft with optional featured image
   * @param {Object} postData - Blog post data
   * @param {Object} imageData - Image data (optional)
   */
  async createDraft(postData, imageData = null) {
    try {
      const cleanContent = this.cleanContentForGhost(postData.content);
      const lexicalContent = this.htmlToLexical(cleanContent);
      
      const postPayload = {
        title: postData.title,
        lexical: JSON.stringify(lexicalContent),
        status: 'draft',
        meta_title: postData.metaTitle,
        meta_description: postData.metaDescription,
        og_title: postData.ogTitle,
        og_description: postData.ogDescription
      };

      // Add featured image if available
      if (imageData && imageData.url) {
        postPayload.feature_image = imageData.url;
        postPayload.feature_image_alt = imageData.altText;
      }

      console.log('📤 Sending payload to Ghost...');
      console.log('   Title:', postPayload.title);
      console.log('   Lexical blocks:', lexicalContent.root.children.length);
      if (imageData && imageData.url) {
        console.log('   Featured image:', imageData.url);
        console.log('   Image alt text:', imageData.altText);
      }
      
      const post = await this.api.posts.add(postPayload);
      
      console.log('📥 Ghost Response:');
      console.log('   Post ID:', post.id);
      console.log('   Status:', post.status);
      console.log('   Content saved successfully!');
      
      return post;
    } catch (error) {
      console.error('❌ Error creating draft:', error.message);
      throw error;
    }
  }

  /**
   * Schedule a draft post for future publishing
   * @param {string} postId - Post ID
   * @param {Date|string} publishDate - When to publish
   */
  async scheduleDraft(postId, publishDate) {
    try {
      const publishAt = new Date(publishDate).toISOString();
      
      const post = await this.api.posts.edit({
        id: postId,
        status: 'scheduled',
        published_at: publishAt
      });
      
      console.log('📅 Post scheduled successfully!');
      console.log('   Post ID:', post.id);
      console.log('   Scheduled for:', new Date(post.published_at).toLocaleString());
      
      return post;
    } catch (error) {
      console.error('❌ Error scheduling post:', error.message);
      throw error;
    }
  }

  /**
   * Publish a draft immediately
   */
  async publishPost(postId) {
    try {
      const post = await this.api.posts.edit({
        id: postId,
        status: 'published',
        published_at: new Date().toISOString()
      });
      
      console.log('✅ Post published:', post.title);
      return post;
    } catch (error) {
      console.error('❌ Error publishing post:', error.message);
      throw error;
    }
  }

  /**
   * Get all posts (for internal linking)
   */
  async getAllPosts(limit = 100) {
    try {
      const posts = await this.api.posts.browse({
        limit: limit,
        fields: 'id,title,slug,url',
        filter: 'status:published'
      });
      
      return posts;
    } catch (error) {
      console.error('❌ Error fetching posts:', error.message);
      return [];
    }
  }

  htmlToLexical(html) {
    const children = [];
    const lines = html.split(/(?=<h[1-6]>)|(?=<p>)|(?=<ul>)|(?=<ol>)/).filter(line => line.trim());
    let skipFirstH1 = false;
    
    for (let i = 0; i < lines.length; i++) {
      const section = lines[i].trim();
      
      if (section.includes('<h1>')) {
        // Skip the first H1 since Ghost will use the title
        if (!skipFirstH1) {
          skipFirstH1 = true;
          continue;
        }
        const text = this.extractText(section, 'h1');
        if (text) {
          children.push({
            type: 'heading',
            tag: 'h1',
            children: [{ type: 'text', text: text }]
          });
        }
      }
      else if (section.includes('<h2>')) {
        const text = this.extractText(section, 'h2');
        if (text) {
          children.push({
            type: 'heading',
            tag: 'h2', 
            children: [{ type: 'text', text: text }]
          });
        }
      }
      else if (section.includes('<h3>')) {
        const text = this.extractText(section, 'h3');
        if (text) {
          children.push({
            type: 'heading',
            tag: 'h3',
            children: [{ type: 'text', text: text }]
          });
        }
      }
      else if (section.includes('<ul>')) {
        const listItems = this.extractListItems(section, 'ul');
        if (listItems.length > 0) {
          children.push({
            type: 'list',
            listType: 'bullet',
            children: listItems.map(item => ({
              type: 'listitem',
              children: [{ 
                type: 'paragraph',
                children: [{ type: 'text', text: item }]
              }]
            }))
          });
        }
      }
      else if (section.includes('<ol>')) {
        const listItems = this.extractListItems(section, 'ol');
        if (listItems.length > 0) {
          children.push({
            type: 'list',
            listType: 'number',
            children: listItems.map(item => ({
              type: 'listitem', 
              children: [{
                type: 'paragraph',
                children: [{ type: 'text', text: item }]
              }]
            }))
          });
        }
      }
      else if (section.includes('<p>')) {
        const paragraphs = section.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
        if (paragraphs) {
          paragraphs.forEach(p => {
            const text = this.extractText(p, 'p');
            if (text && text.length > 0) {
              children.push({
                type: 'paragraph',
                children: [{ type: 'text', text: text }]
              });
            }
          });
        }
      }
    }
    
    return {
      root: {
        type: 'root',
        children: children,
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1
      }
    };
  }

  extractText(htmlString, tag) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    const match = regex.exec(htmlString);
    if (match) {
      return match[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
    }
    return '';
  }

  extractListItems(htmlString, listType) {
    const items = [];
    const regex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    
    while ((match = regex.exec(htmlString)) !== null) {
      const text = match[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
      if (text) {
        items.push(text);
      }
    }
    
    return items;
  }

  cleanContentForGhost(content) {
    let cleaned = content
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<body[^>]*>/gi, '')
      .replace(/<\/body>/gi, '')
      .replace(/```html/g, '')
      .replace(/```/g, '')
      .trim();
    
    console.log('🧹 Content cleaned, length:', cleaned.length);
    return cleaned;
  }

  async testConnection() {
    try {
      const result = await this.api.posts.browse({ limit: 1 });
      console.log('✅ Ghost API connection successful');
      return true;
    } catch (error) {
      console.error('❌ Ghost API connection failed:', error.message);
      return false;
    }
  }
}

module.exports = GhostService;