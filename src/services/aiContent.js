// src/services/aiContent.js - Natural, High-Quality Content Generation with Dynamic Authority Links
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bloggers = require('../config/bloggers');
const contentTemplates = require('../config/contentTemplates');
const seoKeywords = require('../config/seoKeywords');
const authoritySources = require('../config/authoritySources');
const TopicHistory = require('../utils/topicHistory');
require('dotenv').config();

class AIContentGenerator {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.85,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });
    this.maxRetries = 3;
    this.retryDelay = 5000;
  }

  async generateBlogPost(personaName, keyword, templateType) {
    const persona = bloggers.find(b => b.name === personaName);
    
    if (!persona) {
      throw new Error(`Persona "${personaName}" not found`);
    }
    
    const topicHistory = new TopicHistory();
    
    // Build comprehensive prompt
    const prompt = this.buildProfessionalPrompt(persona, keyword, templateType);
    
    // Generate content with retry logic
    const content = await this.retryApiCall(async () => {
      console.log(`🤖 Generating professional content for: ${keyword}`);
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    });
    
    // Generate title dynamically using AI
    let optimizedTitle = await this.generateProfessionalTitle(keyword, templateType, persona);
    
    // Check for duplicate and regenerate if needed
    let attempts = 0;
    const maxAttempts = 3;
    
    while (topicHistory.isTitleUsed(optimizedTitle) && attempts < maxAttempts) {
      console.log(`⚠️  Title "${optimizedTitle}" already used, generating alternative...`);
      optimizedTitle = await this.generateProfessionalTitle(keyword, templateType, persona, attempts + 1);
      attempts++;
    }
    
    // Generate meta description from actual content
    const metaDesc = await this.generateContextualMetaDescription(keyword, content);
    
    return {
      title: optimizedTitle,
      content: content,
      author: persona.name,
      authorEmail: persona.email,
      tags: persona.tags.slice(0, 3),
      templateType: templateType,
      keyword: keyword,
      metaTitle: optimizedTitle,
      metaDescription: metaDesc,
      ogTitle: optimizedTitle,
      ogDescription: metaDesc
    };
  }

  /**
   * Generate professional, engaging title
   */
  async generateProfessionalTitle(keyword, templateType, persona, variation = 0) {
    const titlePrompt = `
You are a B2B content strategist creating an article title for a professional business audience.

Topic: ${keyword}
Article Type: ${templateType}
Author Perspective: ${persona.toneOfVoice.style}

Create ONE compelling article title that:
- Clearly communicates the core value proposition
- Is 40-60 characters maximum
- Includes relevant keywords naturally
- Creates curiosity without clickbait
- Matches the professional tone of publications like McKinsey Insights, HBR, or BCG Publications
- Specific and actionable (not vague or generic)

${variation > 0 ? `Alternative ${variation + 1}: Create a distinctly different angle.` : ''}

Reference style examples:
- "Unlocking the Next Frontier of Personalized Marketing" (McKinsey)
- "How Pop-Mart Won Young Customers in a Fragmented Attention Economy" (HBR)
- "Five Questions Brands Need to Answer to Be Customer-First" (McKinsey)

Return ONLY the title text, no quotes or explanations.
`.trim();

    try {
      const result = await this.model.generateContent(titlePrompt);
      let title = result.response.text().trim();
      
      // Clean up
      title = title.replace(/^["']|["']$/g, '');
      
      // Ensure length
      if (title.length > 60) {
        const lastSpace = title.substring(0, 57).lastIndexOf(' ');
        title = lastSpace > 40 ? title.substring(0, lastSpace) : title.substring(0, 57);
      }
      
      return title;
    } catch (error) {
      console.error('Title generation failed, using fallback:', error.message);
      return keyword.length <= 60 ? keyword : keyword.substring(0, 57);
    }
  }

  /**
   * Generate contextual meta description
   */
  async generateContextualMetaDescription(keyword, content) {
    const textContent = content.substring(0, 800).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const contentPreview = textContent.substring(0, 600);
    
    const metaPrompt = `
Create a meta description (150-160 characters) for this B2B article.

Topic: ${keyword}
Article preview: "${contentPreview}"

Requirements:
- EXACTLY 150-160 characters
- Include primary keywords naturally
- Communicate clear value to B2B professionals
- Active voice, professional tone
- No clickbait or hype
- Make it compelling for search results

Return ONLY the meta description text.
`.trim();

    try {
      const result = await this.model.generateContent(metaPrompt);
      let description = result.response.text().trim().replace(/^["']|["']$/g, '');
      
      // Strict length enforcement
      if (description.length > 160) {
        description = description.substring(0, 157) + '...';
      } else if (description.length < 150) {
        const padding = ' Strategic insights for B2B leaders.';
        const remaining = 160 - description.length;
        if (remaining >= padding.length) {
          description += padding.substring(0, remaining);
        }
      }
      
      return description.substring(0, 160);
    } catch (error) {
      console.error('Meta description generation failed:', error.message);
      const fallback = `Explore ${keyword}: evidence-based strategies and frameworks for B2B leaders in Singapore and APAC markets.`;
      return fallback.substring(0, 160);
    }
  }

  /**
   * Dynamically select 3-4 authority sources based on topic
   */
  selectAuthorityLinks(keyword, count = 4) {
    const normalizedKeyword = keyword.toLowerCase();
    const allSources = Object.values(authoritySources);
    
    // Score each source based on topic relevance
    const scoredSources = allSources.map(source => {
      let score = 0;
      
      // Check topic relevance
      source.topics.forEach(topic => {
        if (normalizedKeyword.includes(topic.toLowerCase())) {
          score += 10;
        }
      });
      
      // Add base score for primary sources (appear more often)
      const primarySources = ['mckinsey', 'hbr', 'bcg', 'gartner', 'forrester', 'deloitte'];
      if (primarySources.includes(source.name.toLowerCase().split(' ')[0].toLowerCase())) {
        score += 5;
      }
      
      // Add small random factor for variety
      score += Math.random() * 2;
      
      return { source, score };
    });
    
    // Sort by score and take top N
    const topSources = scoredSources
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(item => item.source);
    
    return topSources;
  }

  /**
   * Format authority links for prompt
   */
  formatDynamicAuthorityLinks(keyword) {
    const selectedSources = this.selectAuthorityLinks(keyword, 4);
    
    const linkList = selectedSources.map(source => {
      // Pick the most relevant path for this source
      const pathEntries = Object.entries(source.paths);
      const primaryPath = pathEntries[0]; // Use first path as primary
      
      return `  • **${source.name}**: ${source.baseUrl}${primaryPath[1]}`;
    }).join('\n');
    
    return `
**External Links** (Include 3-4 naturally in body sections):

Cite from credible sources such as:
${linkList}

**Citation Guidelines**:
- Link to domain-level or section-level pages (not specific dated articles)
- Format naturally: "According to <a href="URL">${selectedSources[0].name} research</a>, 73%..."
- Place links throughout body sections only (NEVER in conclusion)
- Ensure proper spacing around links: "text <a href="URL">link text</a> more text"
- Distribute across different sections for balance
`.trim();
  }

  /**
   * Build comprehensive professional prompt
   */
  buildProfessionalPrompt(persona, keyword, templateType) {
    const template = contentTemplates[templateType];
    const keywordCluster = this.getKeywordCluster(keyword);
    const dynamicAuthorityLinks = this.formatDynamicAuthorityLinks(keyword);
    
    return `
You are ${persona.name}, ${persona.brief}

You are writing a ${templateType} article for a professional B2B audience reading publications like McKinsey Insights, Harvard Business Review, BCG Publications, or Gartner Research.

=============================================================================
ARTICLE TOPIC & CONTEXT
=============================================================================

**Primary Topic**: ${keyword}

**Article Type**: ${templateType}
${this.getTemplateGuidance(templateType)}

**Suggested Structure** (adapt as needed): ${template.sections.join(' → ')}

**Keyword Cluster** (use naturally, NO forced repetition):
${keywordCluster.slice(0, 8).map(kw => `• ${kw}`).join('\n')}

Weave these keywords organically where they enhance clarity and SEO. Never sacrifice readability for keyword insertion.

=============================================================================
YOUR VOICE & PERSPECTIVE: ${persona.name}
=============================================================================

${this.formatToneGuidance(persona.toneOfVoice)}

**Critical Voice Guidelines**:
- Write from your authentic perspective as ${persona.name}
- Use first-person naturally when sharing your insights, experience, or perspective
- NEVER write: "this article", "this post", "this piece", "this blog"
- NEVER mention "Ignition Studio" or include promotional content
- Focus on delivering genuine strategic value to readers


**CRITICAL CONTENT PROHIBITIONS**:

🚫 **NEVER use these meta-references** (this will cause validation failure):
- "this article" (unless citing another article/study)
- "this post"
- "this piece"
- "this blog"
- "in this article/post"
- "as discussed in this..."

✅ **Instead, write directly**:
- Replace "In this article, I'll explore..." → "I'll explore..."
- Replace "This post examines..." → "Let's examine..." or just start directly
- Replace "As this article shows..." → "The evidence shows..." or "Research demonstrates..."

🚫 **NEVER mention**:
- "Ignition Studio"
- "we at Ignition"
- "our services"
- "contact us"
- Any promotional content

**This is mandatory** - articles with these phrases will be automatically rejected.

=============================================================================
CONTENT QUALITY STANDARDS
=============================================================================

**Length**: 1,400-1,600 words

**Introduction Structure** (Hook → Context → Thesis):

1. **The Hook** (1-2 compelling sentences):
   Open with something that immediately captures attention:
   • A striking statistic that challenges assumptions
   • A thought-provoking question that resonates
   • A brief, relatable scenario or trend
   • A bold or contrarian statement
   
   Example: "73% of digital transformation initiatives fail within 18 months. The pattern across APAC markets reveals a surprising culprit: not technology, but culture."

2. **Context & Background** (2-3 sentences):
   • Why this topic matters RIGHT NOW
   • Connect to current market dynamics or trends
   • Set up the problem/opportunity you're addressing
   
3. **Thesis Statement** (1 clear sentence):
   • Your main argument or point of view
   • What readers will learn

**Body Structure** (4-6 H2 Sections):

Create sections that are **MECE** (Mutually Exclusive, Collectively Exhaustive):
- Each H2 addresses a distinct aspect (WHO/WHAT/WHERE/WHY/HOW)
- Sections build logically on each other
- Together they comprehensively address the topic
- Each H2 heading should be specific, engaging, and value-driven

H2 Heading Style:
❌ Bad: "Understanding Customer Retention"
✅ Good: "Why 45% Retention Starts With Your First Email, Not Your Product"

Within each section:
- Write 1-2 short paragraphs (2-3 sentences each maximum)
- Each paragraph presents a clear viewpoint or insight
- Use <strong> tags to emphasize truly important concepts (NOT quota-driven)
- Include bulleted or numbered lists ONLY when they improve readability

**Examples & Evidence** (CRITICAL - NO FABRICATION):

You MUST include real, credible examples and data:

2-3 Specific Examples:
- Use REAL company names when factual (e.g., "Singapore-based Grab", "APAC fintech leader DBS")
- If anonymizing, be clear: "A Singapore B2B SaaS company (anonymized for confidentiality)"
- Include timeframes (within past 3 years)
- Quantify outcomes: "achieved 40% cost reduction", "scaled to $10M ARR"
- NEVER invent statistics or fabricate case studies

3+ Credible Statistics:
- Cite authoritative sources with links
- Use recent data (past 3 years)
- Ensure relevance to your argument
- Format: "According to <a href="URL">Source Name research</a>, 73% of..."

**Regional & Local Relevance**:
- Include Singapore/APAC/Southeast Asia context when organically relevant
- Don't force regional mentions - let them emerge naturally from examples and context
- Use local market dynamics to illustrate broader points

${template.includeFAQ ? `
**FAQ Section** (${templateType} - Recommended):
Include 3-4 frequently asked questions BEFORE the conclusion:
- Questions should address: implementation, challenges, measuring success
- Answers should be concise (2-3 sentences) and actionable
- Don't repeat information already covered in the body
- Links allowed in FAQ answers if adding value
` : ''}

**Conclusion** (CRITICAL FORMAT):

End with ONE paragraph (2-3 sentences) that:
- Summarizes the core insight or key takeaway
- Directly answers the question/issue from your title  
- Ends with a forward-looking statement about implications or next steps

**Format Requirements**:
- Plain text only: ABSOLUTELY NO <a href> hyperlinks
- NO <strong> or any formatting
- NO heading (H2 or H3) before it
- NO company names or promotional language
- Just a simple <p> tag with strategic insight

Example conclusion structure:
"[Core insight summary]. [Why this matters for readers]. [Forward-looking implication or what's at stake]."

Real example:
"Cultural readiness determines digital transformation success more than technology choice. APAC companies that build adaptive organizations outperform those chasing the latest tools. The question isn't whether to transform, but whether your people are ready to lead it."

=============================================================================
AUTHORITATIVE SOURCES FOR CITATIONS
=============================================================================

${dynamicAuthorityLinks}

=============================================================================
HTML OUTPUT FORMAT
=============================================================================

Return ONLY clean HTML content. No explanatory text before or after.

Structure:
<h1>${keyword}</h1>

<p>[Hook: 1-2 compelling sentences]</p>
<p>[Context: 2-3 sentences setting up why this matters now]</p>
<p>[Thesis: 1 sentence with your main point]</p>

<h2>[Specific, Value-Driven Heading]</h2>
<p>[Insight paragraph 2-3 sentences]</p>
<p>[Supporting content with <strong>key concept</strong> and optional <a href="URL">source</a>]</p>

<h2>[Another MECE Heading]</h2>
<p>[Content continues...]</p>

[Continue with 4-6 H2 sections, each with 1-2 paragraphs]

${template.includeFAQ ? `
<h2>Frequently Asked Questions</h2>
<h3>[Specific question about implementation/challenge/measurement]</h3>
<p>[Concise, actionable answer]</p>
<h3>[Another specific question]</h3>
<p>[Concise, actionable answer]</p>
<h3>[Third question]</h3>
<p>[Concise, actionable answer]</p>
` : ''}

<p>[Conclusion: 2-3 sentences, plain text, no links, no formatting]</p>

=============================================================================
WRITING STYLE ESSENTIALS
=============================================================================

**Sentence Construction**:
- Maximum 20 words per sentence (aim for 15-18)
- One clear idea per sentence
- Active voice: "Leaders drive change" NOT "Change is driven by leaders"
- Remove filler: eliminate "in order to", "it is important", "as mentioned"

**Language**:
- British English spelling: organise, realise, optimise, analyse, behaviour, centre
- Professional yet accessible tone
- Technical accuracy without jargon overload

**Flow & Readability**:
- Logical progression from section to section
- Clear transitions between ideas
- Varied sentence structure for engagement

=============================================================================
QUALITY ASSURANCE CHECKLIST
=============================================================================

Before finalizing, verify:
✓ Article is 1,400-1,600 words
✓ Introduction follows Hook → Context → Thesis structure
✓ 4-6 H2 sections that are MECE
✓ Each section has 1-2 paragraphs (2-3 sentences each)
✓ 2-3 REAL examples with specific outcomes (past 3 years)
✓ 3+ credible statistics with source citations
✓ 3-4 external links to authority sources (body only)
✓ Keywords used naturally (NO forced repetition)
✓ Regional context included organically
✓ <strong> used meaningfully for emphasis
✓ Lists included only when they improve readability
✓ Conclusion is plain text (no links, no bold, no heading before it)
✓ British English spelling throughout
✓ Sentences under 20 words; active voice
✓ NO phrases like "this article" or promotional language
✓ NO fabricated examples or hallucinated statistics
✓ Everything is factual, logical, and professionally written

**CRITICAL ANTI-HALLUCINATION CHECK**:
- Every statistic must be verifiable or clearly framed as illustrative
- Every example must be real or explicitly anonymized
- No invented company names or fake case studies
- If you don't have specific data, write "research indicates" rather than citing fake percentages

=============================================================================
NOW WRITE THE ARTICLE
=============================================================================

Write a complete, professional ${templateType} article that would be publishable in McKinsey Insights, Harvard Business Review, or BCG Publications.

Focus on:
- Genuine strategic insights from your perspective as ${persona.name}
- Real examples and evidence-based arguments
- Natural, engaging prose that connects with B2B professionals
- Practical takeaways readers can apply immediately
- Professional credibility and intellectual rigor

Begin with: <h1>${keyword}</h1>
`.trim();
  }

  /**
   * Get template-specific guidance
   */
  getTemplateGuidance(templateType) {
    const guidance = {
      'Strategic Framework': 'Present a structured model or framework with clear stages/phases. Include the logic behind each step. Reference how leading organizations apply this framework.',
      'Case Study Analysis': 'Analyze a real success/failure story. Structure: Context → Challenge → Solution → Results → Transferable Lessons. Quantify outcomes.',
      'Vision & Outlook': 'Identify emerging trends and their strategic implications. Ground future predictions in current evidence. Help readers prepare for what\'s next.',
      'Point of View (POV)': 'Take a clear, potentially contrarian stance. Back your perspective with evidence. Challenge conventional wisdom respectfully.',
      'How-To / Playbook': 'Provide step-by-step tactical guidance. Make it immediately actionable. Include tools, frameworks, or checklists readers can use.',
      'Expert Q&A': 'Address 3-4 key questions professionals have about this topic. Provide authoritative, evidence-backed answers. Synthesize key takeaways.'
    };
    
    return guidance[templateType] || 'Provide comprehensive professional insights on this topic.';
  }

  /**
   * Format tone of voice guidelines
   */
  formatToneGuidance(toneOfVoice) {
    return `
**Your Writing Style**: ${toneOfVoice.style}
**Your Approach**: ${toneOfVoice.approach}
**Your Voice**: ${toneOfVoice.voice}

**How to embody this perspective**:
${toneOfVoice.characteristics.map(char => `• ${char}`).join('\n')}

${toneOfVoice.preferredPhrasing}
`.trim();
  }

  /**
   * Get keyword cluster for natural SEO
   */
  getKeywordCluster(keyword) {
    const normalizedKeyword = keyword.toLowerCase();
    
    // Try to find matching cluster
    for (const [clusterKey, cluster] of Object.entries(seoKeywords)) {
      if (normalizedKeyword.includes(cluster.primary.toLowerCase()) ||
          cluster.related.some(rel => normalizedKeyword.includes(rel.toLowerCase()))) {
        return [cluster.primary, ...cluster.related];
      }
    }
    
    // Fallback: intelligent extraction
    return [
      keyword,
      ...this.extractSemanticTerms(keyword)
    ];
  }

  /**
   * Extract semantic terms from keyword
   */
  extractSemanticTerms(keyword) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from']);
    const words = keyword.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    // Generate variations
    const terms = new Set(words);
    
    // Add common B2B variations
    words.forEach(word => {
      if (word === 'digital') terms.add('digitalization').add('digitization');
      if (word === 'customer') terms.add('client').add('buyer');
      if (word === 'marketing') terms.add('go-to-market').add('GTM');
      if (word === 'growth') terms.add('scaling').add('expansion');
      if (word === 'strategy') terms.add('strategic planning').add('strategic approach');
    });
    
    return Array.from(terms).slice(0, 10);
  }

  /**
   * Retry API call with exponential backoff
   */
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
        const result = await this.model.generateContent('Test: Write "AI connection successful" in one sentence using British English.');
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