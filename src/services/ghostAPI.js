// src/services/ghostAPI.js - Complete version with HTML cleanup
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
 * ENHANCED: Comprehensive HTML cleanup and formatting
 */
cleanHTML(html) {
  console.log('🧹 Cleaning and formatting HTML...');
  let cleaned = html;

  // ============================================
  // PHASE 1: REMOVE MARKDOWN ARTIFACTS
  // ============================================
  
  // 1. Remove markdown-style bold (**text**)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 2. Convert markdown lists to HTML lists
  // Detect unordered lists: lines starting with * or -
  cleaned = cleaned.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
  
  // 3. Wrap consecutive <li> items in <ul>
  cleaned = cleaned.replace(/(<li>.*<\/li>\s*)+/gs, (match) => {
    if (!match.includes('<ul>')) {
      return '<ul>' + match + '</ul>';
    }
    return match;
  });

  // ============================================
  // PHASE 2: FIX SPACING AROUND INLINE ELEMENTS
  // ============================================
  
  // 4. Fix spacing BEFORE <strong> tags
  // Pattern: word<strong> → word <strong>
  cleaned = cleaned.replace(/([a-zA-Z0-9\)])(<strong>)/g, '$1 $2');
  
  // 5. Fix spacing AFTER </strong> tags
  // Pattern: </strong>word → </strong> word
  cleaned = cleaned.replace(/(<\/strong>)([a-zA-Z0-9])/g, '$1 $2');
  
  // 6. Fix spacing BEFORE <a> tags
  // Pattern: word<a → word 
  cleaned = cleaned.replace(/([a-zA-Z0-9\)])(<a\s)/g, '$1 $2');
  
  // 7. Fix spacing AFTER </a> tags
  // Pattern: </a>word → </a> word
  cleaned = cleaned.replace(/(<\/a>)([a-zA-Z0-9])/g, '$1 $2');
  
  // ============================================
  // PHASE 3: FIX PUNCTUATION SPACING
  // ============================================
  
  // 8. Fix spacing after </a> before punctuation
  // Pattern: </a>, → </a>,  then ensure space after comma
  cleaned = cleaned.replace(/(<\/a>)([,;:.!?])/g, '$1$2');
  cleaned = cleaned.replace(/(<\/a>)([,;:.!?])([a-zA-Z])/g, '$1$2 $3');
  
  // 9. Fix spacing after </strong> before punctuation
  cleaned = cleaned.replace(/(<\/strong>)([,;:.!?])/g, '$1$2');
  cleaned = cleaned.replace(/(<\/strong>)([,;:.!?])([a-zA-Z])/g, '$1$2 $3');
  
  // 10. Fix missing space after punctuation before tag
  // Pattern: word,<strong> → word, <strong>
  cleaned = cleaned.replace(/([,;:.!?])(<(?:strong|a)\s)/g, '$1 $2');
  
  // ============================================
  // PHASE 4: CLEANUP WHITESPACE
  // ============================================
  
  // 11. Remove extra whitespace INSIDE tags
  cleaned = cleaned.replace(/<strong>\s+/g, '<strong>');
  cleaned = cleaned.replace(/\s+<\/strong>/g, '</strong>');
  
  // 12. Fix double spaces (but preserve single spaces)
  cleaned = cleaned.replace(/([^.?!])\s{2,}/g, '$1 ');
  
  // 13. Ensure space after sentence-ending punctuation
  cleaned = cleaned.replace(/([.!?])([A-Z])/g, '$1 $2');
  
  // ============================================
  // PHASE 5: FIX COMMON EDGE CASES
  // ============================================
  
  // 14. Fix: "word<strong>" at start of sentence/paragraph
  cleaned = cleaned.replace(/>([a-zA-Z]+)(<strong>)/g, '>$1 $2');
  
  // 15. Fix: "</strong>word" before punctuation
  cleaned = cleaned.replace(/(<\/strong>)([a-z])/gi, '$1 $2');
  
  // 16. Fix: "to<a" (common pattern)
  cleaned = cleaned.replace(/(\bto)(<a\s)/gi, '$1 $2');
  
  // 17. Fix: word</a>word
  cleaned = cleaned.replace(/([a-z])(<\/a>)([a-z])/gi, '$1$2 $3');
  
  // 18. Clean up any double-processed tags
  cleaned = cleaned.replace(/<strong>\s*<strong>/g, '<strong>');
  cleaned = cleaned.replace(/<\/strong>\s*<\/strong>/g, '</strong>');
  
  // ============================================
  // PHASE 6: FINAL VALIDATION
  // ============================================
  
  // 19. Remove any remaining markdown artifacts
  cleaned = cleaned.replace(/\*\*/g, ''); // Remove stray **
  cleaned = cleaned.replace(/^\*\s/gm, ''); // Remove stray * at line start
  
  // 20. Normalize whitespace in text nodes (but preserve in HTML)
  // This is handled by extractTextContent later
  
  console.log('   ✓ HTML cleaned and formatted');
  console.log('   ✓ Removed markdown artifacts');
  console.log('   ✓ Fixed spacing around inline elements');
  
  return cleaned;
}

  /**
   * Create scheduled post (future publication)
   */
  async createScheduledPost(postData, imageData = null, publishDate) {
    try {
      // STEP 1: Clean HTML
      const cleanedHTML = this.cleanHTML(postData.content);
      const cleanContent = this.cleanContentForGhost(cleanedHTML);
      
      // STEP 2: Convert to Lexical
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
      // STEP 1: Clean HTML formatting
      const cleanedHTML = this.cleanHTML(postData.content);
      const cleanContent = this.cleanContentForGhost(cleanedHTML);
      
      // STEP 2: Convert to Lexical
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
 * Parse inline content (bold, italic, links) with PRESERVED spacing
 */
parseInlineContent(html) {
  const nodes = [];
  
  // Process links first, then bold text
  let workingHtml = html;
  let position = 0;
  
  // Regex to match: plain text | <strong>text</strong> | <a href="...">text</a>
  const inlineRegex = /<strong>(.*?)<\/strong>|<a\s+href=["']([^"']+)["'][^>]*>(.*?)<\/a>|([^<]+)/gi;
  let match;
  
  while ((match = inlineRegex.exec(html)) !== null) {
    if (match[1]) {
      // <strong> tag - bold text
      const boldText = this.extractTextContent(match[1]);
      if (boldText.trim()) {
        nodes.push({
          type: 'text',
          text: boldText,
          format: 1 // Bold
        });
      }
    } else if (match[2] && match[3]) {
      // <a> tag - link
      const linkUrl = match[2];
      const linkText = this.extractTextContent(match[3]);
      if (linkText.trim() && linkUrl) {
        nodes.push({
          type: 'link',
          url: linkUrl,
          children: [{ type: 'text', text: linkText }]
        });
      }
    } else if (match[4]) {
      // Plain text
      const plainText = match[4].trim();
      if (plainText) {
        nodes.push({
          type: 'text',
          text: plainText
        });
      }
    }
  }
  
  // Fallback: if no nodes created, just extract text
  if (nodes.length === 0) {
    const text = this.extractTextContent(html);
    if (text.trim()) {
      nodes.push({
        type: 'text',
        text: text
      });
    }
  }
  
  return nodes;
}

  /**
   * Parse formatted text (bold, italic) with PRESERVED spacing
   */
  parseFormattedText(html) {
    const nodes = [];
    const text = this.extractTextContent(html);
    
    if (!text || !text.trim()) {
      return [];
    }
    
    // Check for bold
    const hasBold = /<strong>/i.test(html);
    
    if (hasBold) {
      // Split by <strong> tags and process
      const parts = html.split(/(<\/?strong>)/gi);
      let isBold = false;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Skip the tag itself
        if (part === '<strong>' || part === '</strong>') {
          isBold = part === '<strong>';
          continue;
        }
        
        const partText = this.extractTextContent(part);
        if (partText) {
          nodes.push({
            type: 'text',
            text: partText,
            ...(isBold && { format: 1 }) // Add format only if bold
          });
        }
      }
    } else {
      // No bold formatting, just return plain text
      nodes.push({
        type: 'text',
        text: text
      });
    }
    
    return nodes.length > 0 ? nodes : [{ type: 'text', text: text }];
  }

  /**
   * Extract plain text from HTML (preserving spaces)
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
   * Clean HTML content (remove wrappers, code blocks)
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