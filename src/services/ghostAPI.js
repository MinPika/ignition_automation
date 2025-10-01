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

  async createDraft(postData) {
    try {
      const cleanContent = this.cleanContentForGhost(postData.content);
      const lexicalContent = this.htmlToLexical(cleanContent);
      
      const postPayload = {
        title: postData.title,
        lexical: JSON.stringify(lexicalContent),
        status: 'draft'
      };

      console.log('📤 Sending lexical payload to Ghost...');
      console.log('   Title:', postPayload.title);
      console.log('   Lexical content blocks:', lexicalContent.root.children.length);
      
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
        .replace(/<[^>]*>/g, '') // Remove HTML tags
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

  async publishPost(postId) {
    try {
      const post = await this.api.posts.edit({
        id: postId,
        status: 'published'
      });
      
      console.log('✅ Post published:', post.title);
      return post;
    } catch (error) {
      console.error('❌ Error publishing post:', error.message);
      throw error;
    }
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