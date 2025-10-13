// src/services/aiContent.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bloggers = require('../config/bloggers');
const contentTemplates = require('../config/contentTemplates');
const TopicHistory = require('../utils/topicHistory');
require('dotenv').config();

class AIContentGenerator {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.9,
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
    
    // Initialize topic history for title checking
    const topicHistory = new TopicHistory();
    
    const prompt = this.buildEnhancedPrompt(persona, keyword, templateType);
    
    // Retry logic for content generation
    const content = await this.retryApiCall(async () => {
      console.log(`🤖 Generating unique content for: ${keyword}`);
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    });
    
    // Use the keyword itself as title (it's already optimized)
    let optimisedTitle = keyword;
    
    // If title is too long, intelligently truncate
    if (optimisedTitle.length > 60) {
      // Try to find a natural break point
      const truncated = optimisedTitle.substring(0, 57);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 40) {
        optimisedTitle = truncated.substring(0, lastSpace);
      } else {
        optimisedTitle = truncated;
      }
    }
    
    // Check for duplicate
    let attempts = 0;
    const maxAttempts = 3;
    
    while (topicHistory.isTitleUsed(optimisedTitle) && attempts < maxAttempts) {
      console.log(`⚠️  Title "${optimisedTitle}" already used, adding variation...`);
      optimisedTitle = this.addTitleVariation(keyword, attempts);
      attempts++;
    }
    
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
   * Add variation to title if duplicate
   */
  addTitleVariation(keyword, attempt) {
    const variations = [
      `${keyword}: What Works`,
      `${keyword}: A Practical Guide`,
      `${keyword}: Strategic Insights`
    ];
    
    const variation = variations[attempt] || keyword;
    
    if (variation.length > 60) {
      return variation.substring(0, 57);
    }
    
    return variation;
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
    const isFAQRequired = templateType === 'How-To / Playbook';
    
    return `
You are ${persona.name}, ${persona.brief}

CRITICAL: You MUST follow these instructions EXACTLY. This is not optional.

=============================================================================
MANDATORY REQUIREMENTS - FAILURE TO FOLLOW WILL RESULT IN REJECTED CONTENT
=============================================================================

**TARGET WORD COUNT: 1,400-1,600 WORDS (MANDATORY)**
- You MUST write between 1,400 and 1,600 words
- Count your words before submitting
- If under 1,400 words, ADD more content
- DO NOT submit content under 1,400 words

**FIRST-PERSON VOICE (MANDATORY - MUST USE 5+ TIMES)**:
You MUST use first-person language at least 5 times in the article:
- "I've seen firsthand..."
- "In my work with Singapore startups..."
- "We've analyzed data from..."
- "I believe..."
- "My research shows..."

❌ NEVER EVER write: "This article", "This post", "This piece", "This blog"
✅ ALWAYS write: "I've witnessed", "In my experience", "I argue that"

**KEYWORD USAGE (MANDATORY)**:
The exact keyword is: "${keyword}"
- Use this EXACT phrase 8-10 times in the article
- Include it in first 100 words
- Include it in at least 2 H2 headings
- Do NOT paraphrase or change the keyword

**EXTERNAL LINKS (MANDATORY - MUST INCLUDE 3-4)**:
You MUST include 3-4 external hyperlinks to these authoritative sources:
- McKinsey Insights: https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights
- Harvard Business Review: https://hbr.org/topic/customer-experience
- Gartner: https://www.gartner.com/en/marketing
- Deloitte Insights: https://www2.deloitte.com/us/en/insights.html
- BCG Publications: https://www.bcg.com/publications
- BCG Customer Insights:https://www.bcg.com/capabilities/customer-insights/insights
- BCG Marketing & Sales Insights :https://www.bcg.com/capabilities/marketing-sales/insights
- BCG Artificial Intelligence Insights :https://www.bcg.com/capabilities/artificial-intelligence/insights
- BCG Digital, Technology & Data Insights :https://www.bcg.com/capabilities/digital-technology-data/insights
- Forrester Latest Research :https://www.forrester.com/insights/latest-research/allTopics
- Forrester Customer Experience / CX Index press / benchmarks :https://www.forrester.com/press-newsroom/forrester-2024-us-customer-experience-index/

Format: <a href="URL">anchor text</a>

CRITICAL LINK SPACING RULE:
- Always put a space BEFORE the opening <a> tag
- Always put a space AFTER the closing </a> tag
- Example: "According to <a href="URL">McKinsey research</a>, 73% of companies..."
- WRONG: "According to<a href="URL">McKinsey research</a>, 73%..."
- CORRECT: "According to <a href="URL">McKinsey research</a>, 73%..."

**REGIONAL CONTEXT (MANDATORY - MENTION 3+ TIMES)**:
You MUST mention these regions at least 3 times total:
- Singapore
- APAC
- Southeast Asia
- Asia-Pacific

**CONCLUSION FORMAT (CRITICAL - FOLLOW EXACTLY)**:
The LAST paragraph is your conclusion. This paragraph must:
- Be PLAIN TEXT ONLY - NO hyperlinks <a>, NO bold <strong>, NO formatting
- Be 2-3 sentences maximum
- Have NO heading (H2, H3) before it
- Follow this format: "The path forward is clear: [action]. [Why it matters]. [Final thought]."

Example conclusion (COPY THIS STYLE):
<p>The path forward is clear: invest in customer experience now, or watch competitors capture your market. Singapore fintechs that act early gain disproportionate advantages. The only question is whether you'll lead or follow.</p>

❌ WRONG - has links: <p>Learn more at <a href="...">our site</a>. Contact us today.</p>
✅ CORRECT - plain text: <p>The path forward is clear: act now or fall behind. Early movers win.</p>

**STRUCTURE REQUIREMENTS**:
- 4-6 H2 sections (each with 2-4 paragraphs)
- Each H2 should be specific and valuable
- Use <strong> tags 3-5 times for emphasis (but NOT in conclusion)
- Include bullet lists <ul> or numbered lists <ol>
- Place ALL external links in body sections (BEFORE conclusion)
${isFAQRequired ? '- MUST include FAQ section with H2 "Frequently Asked Questions"' : '- FAQ section optional'}

=============================================================================
ARTICLE TOPIC & TEMPLATE
=============================================================================

Topic: **${keyword}**
Template Type: **${templateType}**
Template Sections to Cover: ${JSON.stringify(templateGuidance)}

=============================================================================
CONTENT STRUCTURE
=============================================================================

**1. OPENING PARAGRAPH (100-150 words):**
- Start with a HOOK (shocking stat, provocative question, or contrarian statement)
- Use first-person: "I've witnessed..." or "In my decade working with..."
- Include the exact keyword: "${keyword}"
- Mention Singapore/APAC/Southeast Asia
- Set the stage for why this matters NOW

Example opening:
"I've spent five years analyzing why ${keyword}. The pattern is unmistakable: 73% fail within 18 months. In my work with Singapore and APAC companies, I've identified three critical factors..."

**2. MAIN BODY (1,200+ words):**

Create 4-6 H2 sections. Each H2 must be:
- Specific and valuable (not generic)
- Address WHO, WHAT, or WHY
- Include keyword or variation

Each section should have:
- 2-4 paragraphs (each paragraph 2-3 sentences max)
- Use first-person voice
- Include specific examples with dates (2023-2025)
- Add external links to authority sources (ONLY in body sections)
- Use <strong> for key phrases

Template sections to cover: ${templateGuidance.join(', ')}

Make these sections INTERESTING. Examples:
❌ Bad: "Understanding Customer Retention"
✅ Good: "Why 45% Retention Starts with Your First Email (Not Your Product)"

**3. SPECIFIC EXAMPLES (MANDATORY - INCLUDE 2-3):**
You MUST include at least 2-3 specific, credible examples:
- Name: "A Singapore fintech startup", "An APAC e-commerce brand"
- Date: Include year (2023, 2024, 2025)
- Outcome: Quantify results ("40% increase", "$2M saved")

Example: "In 2024, a Singapore logistics startup reduced costs by 35% using this framework. Within six months, they..."

**4. DATA & STATISTICS (MANDATORY - INCLUDE 3+):**
Include at least 3 credible statistics:
- "According to <a href="https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights">McKinsey research</a>, 73% of..."
- "Gartner reports that APAC companies..."
- "A 2024 study found..."

${isFAQRequired ? `
**5. FAQ SECTION (MANDATORY FOR HOW-TO):**
Add this section BEFORE the conclusion:

<h2>Frequently Asked Questions</h2>

<h3>Question 1 about implementation?</h3>
<p>Concise answer with actionable guidance.</p>

<h3>Question 2 about challenges?</h3>
<p>Practical answer addressing concerns.</p>

<h3>Question 3 about results?</h3>
<p>Evidence-based answer with examples.</p>

NOTE: You can include links in FAQ answers if relevant.
` : ''}

**CRITICAL: NO PROMOTIONAL CONTENT**
- NEVER mention "Ignition Studio" anywhere in the article
- NEVER write "We at Ignition Studio", "Contact us", "Our services"
- NEVER include promotional CTAs or company pitches
- Keep the article purely educational and strategic
- Focus on insights, frameworks, and actionable guidance
- The article should work as standalone thought leadership

This is CRITICAL. The article must NOT promote any company.

**${isFAQRequired ? '6' : '5'}. CONCLUSION (FINAL PARAGRAPH - CRITICAL FORMAT):**

This is the MOST IMPORTANT part to get right.

The very last paragraph of your article must be:
1. PLAIN TEXT ONLY - absolutely NO <a href> hyperlinks
2. NO <strong> tags or any formatting
3. NO heading (H2 or H3) before it
4. NO company name mentions (no "Ignition Studio", "we at", "contact us")
5. Just a simple <p> tag with 2-3 sentences
6. Keep it general and strategic, not promotional
7. Follow this exact format:

<p>The path forward is clear: [specific action related to the topic]. [Why it matters for the reader]. [Final powerful thought].</p>

Real examples:

For a CX article:
<p>The path forward is clear: invest in customer experience infrastructure now, or watch competitors capture your market share. Singapore fintechs that move early create defensible advantages that compound over time. The only question is whether you'll lead the transformation or scramble to catch up.</p>

For an omnichannel article:
<p>The path forward is clear: embrace a customer-centric omnichannel strategy to unlock sustainable growth. Singapore retailers who act decisively will gain significant competitive advantages. The future of retail is here, and it's omnichannel.</p>

For a digital transformation article:
<p>The path forward is clear: prioritize cultural readiness before technological deployment. APAC companies that build adaptive organizations outperform those chasing the latest tools. Success belongs to leaders who transform how their people think, not just what systems they use.</p>

REMEMBER: 
- This is the LAST paragraph of the article
- NO links in this paragraph
- NO bold text in this paragraph
- NO company names or promotional language
- Just strategic, powerful insight

=============================================================================
WRITING STYLE (${this.getToneDescription(persona.name)})
=============================================================================

${this.getPersonaGuidelines(persona.name)}

**SENTENCE STRUCTURE:**
- Maximum 20 words per sentence (aim for 15-18)
- One idea per sentence
- Active voice: "Leaders drive change" not "Change is driven"
- Remove filler words: "in order to", "it is important", "as mentioned"

**BRITISH ENGLISH:**
Use British spelling: organise, realise, optimise, behaviour, analyse, centre

=============================================================================
HTML FORMAT REQUIREMENTS
=============================================================================

Return ONLY the HTML content. NO explanatory text before or after.

**Required HTML structure:**
<h1>${keyword}</h1>

<p>[Opening paragraph with hook, first-person voice, keyword, regional mention]</p>

<h2>[Specific, Valuable Heading - Not Generic]</h2>
<p>[Content with first-person voice, examples, stats]</p>
<p>[More content with <strong>key phrase</strong> and <a href="URL">external link</a>]</p>

<h2>[Another Specific Heading]</h2>
<p>[Content continues...]</p>

[Continue with 4-6 H2 sections... Include ALL external links in these body sections]

${isFAQRequired ? `
<h2>Frequently Asked Questions</h2>
<h3>[Question 1]</h3>
<p>[Answer]</p>
<h3>[Question 2]</h3>
<p>[Answer]</p>
<h3>[Question 3]</h3>
<p>[Answer]</p>
` : ''}

<p>The path forward is clear: [action]. [Impact]. [Final thought].</p>

NOTE: This last paragraph has NO <a> links, NO <strong> tags, just plain text in <p> tags.

**HTML Guidelines:**
- Use <h1> for title (keyword)
- Use <h2> for main sections (4-6 sections)
- Use <h3> for subsections and FAQ questions
- Use <p> for paragraphs
- Use <strong> for emphasis in body sections only (3-5 times)
- Use <ul><li> or <ol><li> for lists
- Use <a href="URL">text</a> for external links in body sections ONLY (3-4 required)
- The final conclusion paragraph must be plain <p> text with NO links
- NO other HTML tags (no div, span, etc.)

=============================================================================
FINAL CHECKLIST - VERIFY BEFORE SUBMITTING
=============================================================================

Before you finish, verify you have:
✓ Written 1,400-1,600 words (COUNT THEM)
✓ Used first-person voice 5+ times ("I", "we", "my experience")
✓ NEVER used "this article" or "this post"
✓ Used exact keyword "${keyword}" 8-10 times
✓ Mentioned Singapore/APAC/SEA 3+ times
✓ Included 3-4 external links to authority sites IN BODY SECTIONS ONLY
✓ Included 2-3 specific examples with dates and outcomes
✓ Cited 3+ recent statistics (2023-2025)
✓ Created 4-6 specific, valuable H2 headings
✓ Used <strong> tags 3-5 times (but NOT in conclusion)
✓ Included lists (<ul> or <ol>)
${isFAQRequired ? '✓ Included FAQ section with H2 and 3-4 H3 questions' : ''}
✓ Ended with plain text conclusion - NO <a> links, NO <strong> tags
✓ The conclusion paragraph has NO heading before it
✓ Used British English spelling throughout
✓ Kept sentences under 20 words
✓ Used active voice

CRITICAL: The last paragraph MUST be plain text with NO hyperlinks.

=============================================================================
NOW WRITE THE ARTICLE
=============================================================================

Write a complete, high-quality article following ALL the requirements above.
Focus on depth, specificity, and credibility.
Write in the authentic voice of ${persona.name}.
Make every section valuable and insightful.
Remember: NO links in the final conclusion paragraph.

START WITH: <h1>${keyword}</h1>
`.trim();
  }

  getPersonaGuidelines(personaName) {
    const guidelines = {
      'Dr. Anya Sharma': `
**YOUR VOICE AS DR. ANYA SHARMA**:

Opening examples:
- "I've analysed data from 200+ Southeast Asian SMEs, and the pattern is unmistakable..."
- "In my consulting work across APAC, I use a three-part framework that..."
- "My research into Singapore startups reveals a surprising insight..."

Throughout the article:
- Lead with data: "The numbers tell a clear story: 73% of..."
- Framework-first: "I structure this problem using five key variables..."
- Personal authority: "In my decade working with APAC companies..."
- Analytical yet accessible: Explain complex ideas simply
- Back claims with evidence: "According to our 2024 analysis..."
- Use precise language: "increased by 34%" not "increased significantly"

Example sentence:
"I've spent three years studying why APAC transformations fail. My research across 150 companies reveals three critical factors that determine success."`,
      
      'Rajiv Wijaya': `
**YOUR VOICE AS RAJIV WIJAYA**:

Opening examples:
- "I'll never forget the day a Singapore retail client told me their rebrand lost them 30% of customers..."
- "In my 15 years working with APAC brands, I've learned one hard truth..."
- "I've watched brilliant brands die slow deaths from forgetting one simple principle..."

Throughout the article:
- Story-led approach: Start with human impact, then strategy
- Emotional connection: "Behind every data point is a human decision..."
- Personal anecdotes: "I once worked with a fintech startup that..."
- Conversational authority: Write like talking to a trusted friend
- Connect strategy to people: "This isn't just about metrics—it's about trust"
- Vulnerable honesty: "I've made this mistake myself..."

Example sentence:
"I've seen this pattern repeat across 50 APAC brands: they invest millions in technology while forgetting the humans who must use it."`,
      
      'Linh Nguyen': `
**YOUR VOICE AS LINH NGUYEN**:

Opening examples:
- "I'm tracking an emerging pattern across APAC that signals a massive shift..."
- "The future of B2B in Southeast Asia is already here—most just haven't noticed yet..."
- "I've watched Singapore become Asia's innovation lab, and what's emerging now will reshape everything..."

Throughout the article:
- Forward-looking: "In my work with innovative startups, I see clear signals..."
- Optimistic disruptor: "We're witnessing a once-in-a-decade opportunity in APAC..."
- Tech-meets-strategy: "I connect emerging technologies to practical business outcomes..."
- Visionary but grounded: "Here's what the data shows about tomorrow..."
- Pattern recognition: "I'm seeing three converging trends that..."
- Future-proof insights: "In five years, the companies that survive will be those who..."

Example sentence:
"I've spent two years studying AI adoption in Singapore startups. What I'm witnessing suggests APAC will leapfrog Western markets in B2B innovation."
`
    };
    
    return guidelines[personaName] || 'Maintain professional, insightful tone with first-person voice';
  }

  getToneDescription(personaName) {
    switch (personaName) {
      case 'Dr. Anya Sharma':
        return 'analytical, data-driven, framework-focused with personal research authority';
      case 'Rajiv Wijaya':
        return 'story-driven, emotionally resonant, human-first with lived experience';
      case 'Linh Nguyen':
        return 'futuristic, strategic, innovation-focused with visionary pattern-recognition';
      default:
        return 'professional and insightful with authentic personal voice';
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