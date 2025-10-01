const { GoogleGenerativeAI } = require('@google/generative-ai');
const bloggers = require('../config/bloggers');
const contentTemplates = require('../config/contentTemplates');
require('dotenv').config();

class AIContentGenerator {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  async generateBlogPost(personaName, keyword, templateType) {
    const persona = bloggers.find(b => b.name === personaName);
    const headers = contentTemplates[templateType];
    
    if (!persona) {
      throw new Error(`Persona "${personaName}" not found`);
    }
    
    if (!headers) {
      throw new Error(`Template "${templateType}" not found`);
    }
    
    const prompt = this.buildPrompt(persona, keyword, templateType, headers);
    
    // Retry logic for content generation
    const content = await this.retryApiCall(async () => {
      console.log(`🤖 Generating content for: ${keyword} by ${personaName} using ${templateType}`);
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    });
    
    return {
      title: `${keyword} — ${templateType} for Modern B2B Brands`,
      content: content,
      author: persona.name,
      authorEmail: persona.email,
      tags: persona.tags.slice(0, 3), // Limit to 3 tags for Ghost
      templateType: templateType,
      keyword: keyword,
      metaTitle: `${keyword} | ${templateType} | Ignition Studio`,
      metaDescription: `Explore ${keyword} through a ${templateType} from ${persona.name} at Ignition Studio. Expert insights for B2B growth.`,
      ogTitle: `${keyword} — Expert ${templateType}`,
      ogDescription: `${templateType} on ${keyword} by ${persona.name}. AI-enabled B2B marketing insights.`
    };
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
          const delay = this.retryDelay * attempt; // Exponential backoff
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

  buildPrompt(persona, keyword, templateType, headers) {
  return `
You are ${persona.name}, ${persona.brief}

Write a comprehensive blog post in the tone and structure of McKinsey Insights.

Topic: **${keyword}**
Template: **${templateType}**

### STRUCTURE (Use as H2 headings):
${headers.map((h, i) => `${i + 1}. ${h}`).join('\n')}

### REQUIREMENTS:
- Start with an H1 heading: "${keyword} — ${templateType} for Modern B2B Brands"
- Include keyword "${keyword}" in the H1 and at least two H2 headings
- Cite at least one credible statistic (2023-2025) from sources like Gartner, McKinsey, Deloitte, or similar
- Include at least one mini-case study or real-world example
- Write in ${this.getToneDescription(persona.name)} tone
- Use HTML formatting with proper heading tags (H1, H2, H3)
- Include bullet points (<ul><li>) and numbered lists (<ol><li>) where appropriate
- Word count: 1,200-1,500 words
- End with: "At Ignition Studio, we help B2B brands implement these strategies through AI-enabled growth and brand consulting. Contact us to transform your marketing approach."

### CONTENT QUALITY:
- Professional, consultant-level writing
- Data-driven insights
- Actionable recommendations
- Clear section transitions
- Engaging but authoritative tone

IMPORTANT: Return ONLY the content HTML (headings, paragraphs, lists). Do NOT include DOCTYPE, html, head, body, or any wrapper tags. Start directly with the H1 heading.

Example format:
<h1>Topic — Template for Modern B2B Brands</h1>
<h2>Executive Summary</h2>
<p>Content here...</p>
<h2>Next Section</h2>
<p>More content...</p>
  `.trim();
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

  async testConnection() {
    try {
      // Test with retry logic
      const response = await this.retryApiCall(async () => {
        const result = await this.model.generateContent('Test: Write "AI is working" in one sentence.');
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