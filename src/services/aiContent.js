// src/services/aiContent.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bloggers = require('../config/bloggers');
const contentTemplates = require('../config/contentTemplates');
require('dotenv').config();

class AIContentGenerator {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    this.maxRetries = 3;
    this.retryDelay = 5000;
  }

  async generateBlogPost(personaName, keyword, templateType) {
    const persona = bloggers.find(b => b.name === personaName);
    
    if (!persona) {
      throw new Error(`Persona "${personaName}" not found`);
    }
    
    const prompt = this.buildEnhancedPrompt(persona, keyword, templateType);
    
    // Retry logic for content generation
    const content = await this.retryApiCall(async () => {
      console.log(`🤖 Generating unique content for: ${keyword}`);
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    });
    
    // Generate unique, varied title
    const optimisedTitle = this.generateSEOTitle(keyword, templateType);
    
    // Generate meta description with variety
    const metaDesc = this.generateVariedMetaDescription(keyword);
    
    return {
      title: optimisedTitle,
      content: content,
      author: persona.name,
      authorEmail: persona.email,
      tags: persona.tags.slice(0, 3),
      templateType: templateType,
      keyword: keyword,
      metaTitle: optimisedTitle,
      metaDescription: metaDesc,
      ogTitle: optimisedTitle,
      ogDescription: metaDesc
    };
  }

  /**
   * Generate SEO-optimised title (max 60 characters)
   * Create UNIQUE titles, not formula-based
   */
  generateSEOTitle(keyword, templateType) {
    // Extract core topic words from keyword
    const keywordWords = keyword.split(' ').filter(w => 
      !['the', 'of', 'in', 'for', 'and', 'to', 'a', 'an'].includes(w.toLowerCase())
    );
    
    // Create varied title formats
    const titleFormats = [
      () => {
        // Format 1: Use full keyword if short enough
        if (keyword.length <= 60) return keyword;
        return keyword.substring(0, 57) + '...';
      },
      () => {
        // Format 2: Action + topic words
        const start = this.getTitleStart();
        const words = keywordWords.slice(0, 3).join(' ');
        return `${start} ${words}`.substring(0, 60);
      },
      () => {
        // Format 3: Topic words + descriptor
        const words = keywordWords.slice(0, 2).join(' ');
        const ending = this.getTitleEnding();
        return `${words}: ${ending}`.substring(0, 60);
      },
      () => {
        // Format 4: Topic + action phrase
        const words = keywordWords.slice(0, 3).join(' ');
        const action = this.getTitleAction();
        return `${words} ${action}`.substring(0, 60);
      }
    ];
    
    // Randomly select format for variety
    const selectedFormat = titleFormats[Math.floor(Math.random() * titleFormats.length)];
    let title = selectedFormat();
    
    // Ensure under 60 chars and clean
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    
    return title.trim();
  }

  getTitleStart() {
    const starts = [
      'Rethinking',
      'Mastering',
      'Unlocking',
      'Building',
      'Transforming',
      'Scaling',
      'Optimising',
      'Leading',
      'Winning'
    ];
    return starts[Math.floor(Math.random() * starts.length)];
  }

  getTitleEnding() {
    const endings = [
      'A Practical Guide',
      'Strategic Approach',
      'What Works',
      'New Imperatives',
      'Critical Insights',
      'Proven Methods',
      'Leadership Agenda',
      'Modern Playbook'
    ];
    return endings[Math.floor(Math.random() * endings.length)];
  }

  getTitleAction() {
    const actions = [
      'In Practice',
      'That Deliver',
      'Done Right',
      'For Growth',
      'At Scale',
      'That Matter'
    ];
    return actions[Math.floor(Math.random() * actions.length)];
  }

  /**
   * Generate varied meta descriptions
   */
  generateVariedMetaDescription(keyword) {
    const formats = [
      `Discover how leading organisations approach ${keyword}. Expert insights and practical frameworks.`,
      `${keyword}: Strategic perspectives from market leaders. Data-driven analysis and actionable guidance.`,
      `Explore ${keyword} through proven methodologies. Transform strategy into sustainable results.`,
      `Master ${keyword} with frameworks that deliver. Professional insights for strategic leaders.`
    ];
    
    let desc = formats[Math.floor(Math.random() * formats.length)];
    
    // Ensure 150-160 characters
    if (desc.length > 160) {
      desc = desc.substring(0, 157) + '...';
    } else if (desc.length < 150) {
      desc = desc + ' Evidence-based approaches.';
    }
    
    return desc.substring(0, 160);
  }

  buildEnhancedPrompt(persona, keyword, templateType) {
    const templateGuidance = contentTemplates[templateType];
    
    return `
You are ${persona.name}, ${persona.brief}

Write a comprehensive, SEO-optimised blog post in the tone and structure of McKinsey Insights.

Topic: **${keyword}**
Article Approach: **${templateGuidance.description}**

### CRITICAL CONTENT REQUIREMENTS:
1. **Title** (MUST be unique and under 60 characters):
   - DO NOT use formulaic patterns like "${keyword}: [Type]"
   - Create an engaging, unique title that captures the essence
   - Keep natural and varied - avoid repetitive structures
   - Examples of good variety: "Rethinking Customer Retention", "Why Digital Transformation Fails", "The Hidden Economics of Pricing"

2. **H2 Headings** (CRITICAL - Create DISTINCT professional sections):
   - ${templateGuidance.guidance}
   - NEVER use generic template names as headings
   - Each H2 must be unique and compelling
   - Think like McKinsey: "The Strategic Context", "Root Causes", "What Leaders Must Do"
   - NO repetitive patterns - every article must feel fresh

3. **First 100 words**:
   - Must naturally include topic keywords
   - Hook the reader immediately with compelling insight
   - Set context for business leaders

4. **Content Requirements**:
   - Length: 1,400-1,600 words
   - Natural keyword use throughout (avoid forced repetition)
   - Include 2-3 external links to high-authority sources (McKinsey, BCG, Bain, HBR, Gartner, Deloitte)
   - Cite at least 2 credible statistics from 2023-2025
   - Include 1-2 real-world examples or mini case studies
   - Add FAQ section at end with 3-4 questions (H2 "Frequently Asked Questions", H3 for each)

5. **Readability Rules**:
   - Sentences: Maximum 20 words (aim for 15-18)
   - Paragraphs: 2-3 sentences maximum
   - Use bullet points and numbered lists liberally
   - Bold key phrases for scannability

6. **Language**:
   - BRITISH ENGLISH spelling (organise, realise, optimise, behaviour, analyse, centre)
   - Singapore/Asia-Pacific examples where relevant
   - Professional, consultant-level tone
   - NO American spellings

7. **Structure Guidelines**:
   - Introduction (compelling hook)
   - 4-6 main sections with professional H2 headings
   - Each section: 2-4 paragraphs
   - FAQ section at end
   - Conclusion with key takeaways

8. **Ending** (CRITICAL):
   - NO company branding, NO promotional CTAs
   - End with strategic insights and takeaways
   - Keep professional and thought-provoking
   - Example: "Success in this domain requires both strategic clarity and operational discipline. Leaders who act now will be positioned to capture disproportionate value as markets evolve."

### UNIQUENESS REQUIREMENTS:
- Every article must feel DIFFERENT from others
- Avoid repetitive phrase patterns
- Vary sentence structure and paragraph rhythm
- Use different examples and case studies each time
- Create fresh insights, not recycled concepts

### WRITING TONE (${this.getToneDescription(persona.name)}):
${this.getPersonaGuidelines(persona.name)}

### FORMAT REQUIREMENTS:
- Return ONLY HTML content (no DOCTYPE, html, head, body tags)
- Start with H1
- Use proper HTML: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>
- Bold important phrases: <strong>text</strong>
- External links: <a href="URL">anchor text</a>

CRITICAL REMINDERS:
- Create UNIQUE, VARIED content every time
- NO formulaic titles or headings
- NO company branding at end
- British English only
- Professional McKinsey-quality insights
  `.trim();
  }

  getPersonaGuidelines(personaName) {
    const guidelines = {
      'Dr. Anya Sharma': `
- Use data-driven language and frameworks
- Include specific metrics and percentages
- Reference research studies and reports
- Structure arguments logically with clear evidence
- Maintain analytical, objective tone`,
      
      'Rajiv Wijaya': `
- Lead with compelling stories and human examples
- Focus on emotional resonance and brand authenticity
- Use analogies and metaphors
- Connect strategy to human experiences
- Maintain warm, inspiring tone while remaining professional`,
      
      'Linh Nguyen': `
- Emphasise emerging technologies and future trends
- Connect innovation to practical strategy
- Use forward-looking language
- Reference cutting-edge examples
- Maintain optimistic, strategic tone`
    };
    
    return guidelines[personaName] || 'Maintain professional, insightful tone';
  }

  getToneDescription(personaName) {
    switch (personaName) {
      case 'Dr. Anya Sharma':
        return 'analytical, data-driven, and framework-focused';
      case 'Rajiv Wijaya':
        return 'inspiring, story-driven, and emotionally resonant';
      case 'Linh Nguyen':
        return 'futuristic, strategic, and innovation-focused';
      default:
        return 'professional and insightful';
    }
  }

  async retryApiCall(apiFunction) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await apiFunction();
      } catch (error) {
        lastError = error;
        console.log(`⚠️  Attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          console.log(`⏳ Retrying in ${delay/1000} seconds...`);
          await this.sleep(delay);
        }
      }
    }
    
    console.error(`❌ All ${this.maxRetries} attempts failed. Last error:`, lastError.message);
    throw lastError;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testConnection() {
    try {
      const response = await this.retryApiCall(async () => {
        const result = await this.model.generateContent('Test: Write "AI is working" in one sentence using British English.');
        return result.response.text();
      });
      
      console.log('✅ Gemini AI connection successful:', response);
      return true;
    } catch (error) {
      console.error('❌ Gemini AI connection failed after all retries:', error.message);
      return false;
    }
  }
}

module.exports = AIContentGenerator;