// src/services/ghostAPI.js - Enhanced with better HTML parsing
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
   * Find Ghost user by email
   */
  async findUserByEmail(email) {
    try {
      const users = await this.api.users.browse({ filter: `email:${email}` });
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user:', error.message);
      return null;
    }
  }

  /**
   * Create scheduled post (future publication)
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
        og_description: postData.ogDescription,
        tags: postData.tags || []
      };

      // Add featured image if available
      if (imageData && imageData.url) {
        postPayload.feature_image = imageData.url;
        postPayload.feature_image_alt = imageData.altText;
      }

      // Add author if email provided
      if (postData.authorEmail) {
        const author = await this.findUserByEmail(postData.authorEmail);
        if (author) {
          postPayload.authors = [{ id: author.id }];
          console.log(`👤 Author assigned: ${author.name} (${author.email})`);
        } else {
          console.warn(`⚠️  Author not found for email: ${postData.authorEmail}`);
          console.warn('   Post will use default author. Please setup authors first.');
        }
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
      if (error.response) {
        console.error('   Ghost API Response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Create draft with optional featured image
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
        og_description: postData.ogDescription,
        tags: postData.tags || []
      };

      // Add featured image if available
      if (imageData && imageData.url) {
        postPayload.feature_image = imageData.url;
        postPayload.feature_image_alt = imageData.altText;
      }

      // Add author if email provided
      if (postData.authorEmail) {
        const author = await this.findUserByEmail(postData.authorEmail);
        if (author) {
          postPayload.authors = [{ id: author.id }];
          console.log(`👤 Author assigned: ${author.name} (${author.email})`);
        } else {
          console.warn(`⚠️  Author not found for email: ${postData.authorEmail}`);
          console.warn('   Post will use default author. Please setup authors first.');
        }
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
      if (error.response) {
        console.error('   Ghost API Response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Schedule a draft post for future publishing
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

  /**
   * Enhanced HTML to Lexical conversion with error recovery
   */
  htmlToLexical(html) {
    const children = [];
    
    try {
      // Split by major block elements
      const blocks = this.parseHTMLBlocks(html);
      let skipFirstH1 = false;
      
      for (const block of blocks) {
        try {
          const lexicalNode = this.convertBlockToLexical(block, skipFirstH1);
          
          if (lexicalNode) {
            // Handle H1 skipping
            if (block.type === 'h1' && !skipFirstH1) {
              skipFirstH1 = true;
              continue;
            }
            
            children.push(lexicalNode);
          }
        } catch (blockError) {
          console.warn('⚠️  Failed to convert block, skipping:', blockError.message);
          // Continue with next block instead of failing completely
        }
      }
      
    } catch (error) {
      console.error('❌ Critical error in HTML to Lexical conversion:', error.message);
      // Return minimal valid structure
      children.push({
        type: 'paragraph',
        children: [{ type: 'text', text: 'Content conversion error - please edit manually' }]
      });
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

  /**
   * Parse HTML into structured blocks
   */
  parseHTMLBlocks(html) {
    const blocks = [];
    
    // Match all major block elements
    const blockRegex = /<(h[1-6]|p|ul|ol|blockquote|pre)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    
    while ((match = blockRegex.exec(html)) !== null) {
      const tag = match[1].toLowerCase();
      const content = match[2];
      
      blocks.push({
        type: tag,
        rawContent: content,
        fullMatch: match[0]
      });
    }
    
    return blocks;
  }

  /**
   * Convert a single block to Lexical format
   */
  convertBlockToLexical(block, skipFirstH1) {
    const { type, rawContent } = block;
    
    // Headings
    if (type.startsWith('h')) {
      const level = parseInt(type.charAt(1));
      const text = this.extractTextContent(rawContent);
      
      if (text && text.trim()) {
        return {
          type: 'heading',
          tag: type,
          children: this.parseInlineContent(rawContent)
        };
      }
      return null;
    }
    
    // Paragraphs
    if (type === 'p') {
      const text = this.extractTextContent(rawContent);
      
      if (text && text.trim()) {
        return {
          type: 'paragraph',
          children: this.parseInlineContent(rawContent)
        };
      }
      return null;
    }
    
    // Unordered lists
    if (type === 'ul') {
      const items = this.extractListItems(rawContent);
      
      if (items.length > 0) {
        return {
          type: 'list',
          listType: 'bullet',
          children: items.map(item => ({
            type: 'listitem',
            children: [{
              type: 'paragraph',
              children: this.parseInlineContent(item)
            }]
          }))
        };
      }
      return null;
    }
    
    // Ordered lists
    if (type === 'ol') {
      const items = this.extractListItems(rawContent);
      
      if (items.length > 0) {
        return {
          type: 'list',
          listType: 'number',
          children: items.map(item => ({
            type: 'listitem',
            children: [{
              type: 'paragraph',
              children: this.parseInlineContent(item)
            }]
          }))
        };
      }
      return null;
    }
    
    // Blockquote
    if (type === 'blockquote') {
      const text = this.extractTextContent(rawContent);
      
      if (text && text.trim()) {
        return {
          type: 'quote',
          children: [{
            type: 'paragraph',
            children: [{ type: 'text', text: text.trim() }]
          }]
        };
      }
      return null;
    }
    
    return null;
  }

  /**
   * Parse inline content (bold, italic, links)
   */
  parseInlineContent(html) {
    const nodes = [];
    
    // Simple approach: extract text and check for formatting
    const tempDiv = { innerHTML: html };
    
    // Check for links
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let lastIndex = 0;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      // Add text before link
      if (match.index > lastIndex) {
        const beforeText = html.substring(lastIndex, match.index);
        const cleanText = this.extractTextContent(beforeText);
        if (cleanText) {
          nodes.push(...this.parseFormattedText(beforeText));
        }
      }
      
      // Add link
      const linkText = this.extractTextContent(match[2]);
      const linkUrl = match[1];
      
      if (linkText && linkUrl) {
        nodes.push({
          type: 'link',
          url: linkUrl,
          children: [{ type: 'text', text: linkText }]
        });
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < html.length) {
      const remainingText = html.substring(lastIndex);
      nodes.push(...this.parseFormattedText(remainingText));
    }
    
    // If no links found, just parse formatted text
    if (nodes.length === 0) {
      nodes.push(...this.parseFormattedText(html));
    }
    
    return nodes.length > 0 ? nodes : [{ type: 'text', text: this.extractTextContent(html) }];
  }

  /**
   * Parse formatted text (bold, italic)
   */
  parseFormattedText(html) {
    const nodes = [];
    const text = this.extractTextContent(html);
    
    if (!text || !text.trim()) {
      return [];
    }
    
    // Check for bold
    const hasBold = html.includes('<strong>') || html.includes('<b>');
    const hasItalic = html.includes('<em>') || html.includes('<i>');
    
    if (hasBold || hasItalic) {
      // For now, just return plain text
      // TODO: Implement proper inline formatting parsing
      nodes.push({
        type: 'text',
        text: text.trim(),
        format: hasBold ? 1 : 0 // 1 = bold in Lexical
      });
    } else {
      nodes.push({
        type: 'text',
        text: text.trim()
      });
    }
    
    return nodes;
  }

  /**
   * Extract plain text from HTML
   */
  extractTextContent(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Extract list items
   */
  extractListItems(html) {
    const items = [];
    const regex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      const text = match[1].trim();
      if (text) {
        items.push(text);
      }
    }
    
    return items;
  }

  /**
   * Clean HTML content
   */
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

  /**
   * Test connection
   */
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