// src/utils/contentValidator.js - Enhanced content validation
const axios = require('axios');

class ContentValidator {
  constructor() {
    this.minWordCount = 800;
    this.maxWordCount = 1600;
    this.minParagraphs = 8;
    this.requiredSections = {
      'Strategic Framework': ['Executive Summary', 'Framework', 'Implementation', 'Conclusion'],
      'Case Study Analysis': ['Executive Summary', 'Background', 'Solution', 'Results', 'Lessons'],
      'Vision & Outlook': ['Executive Summary', 'Trends', 'Implications', 'Signals', 'Thoughts'],
      'Point of View (POV)': ['Opening Statement', 'Why This Matters', 'Insight', 'Evidence', 'Action'],
      'How-To / Playbook': ['Executive Summary', 'Problem', 'Methodology', 'Example', 'Conclusion'],
      'Expert Q&A': ['Context', 'Question', 'Answer', 'Takeaways']
    };
  }

  /**
   * Validate complete blog post before publishing
   */
  async validatePost(postData, imageData, templateType) {
    const errors = [];
    const warnings = [];

    console.log('🔍 Validating content...\n');

    // 1. Title validation
    const titleValidation = this.validateTitle(postData.title);
    if (!titleValidation.valid) {
      errors.push(...titleValidation.errors);
    }
    warnings.push(...titleValidation.warnings);

    // 2. Content validation
    const contentValidation = this.validateContent(postData.content, templateType);
    if (!contentValidation.valid) {
      errors.push(...contentValidation.errors);
    }
    warnings.push(...contentValidation.warnings);

    // 3. Voice and tone validation
    const voiceValidation = this.validateVoice(postData.content);
    if (!voiceValidation.valid) {
      errors.push(...voiceValidation.errors);
    }
    warnings.push(...voiceValidation.warnings);

    // 4. Regional context validation
    const contextValidation = this.validateRegionalContext(postData.content);
    if (!contextValidation.valid) {
      errors.push(...contextValidation.errors);
    }
    warnings.push(...contextValidation.warnings);

    // 5. SEO metadata validation
    const seoValidation = this.validateSEO(postData);
    if (!seoValidation.valid) {
      errors.push(...seoValidation.errors);
    }
    warnings.push(...seoValidation.warnings);

    // 6. Image validation
    const imageValidation = await this.validateImage(imageData);
    if (!imageValidation.valid) {
      errors.push(...imageValidation.errors);
    }
    warnings.push(...imageValidation.warnings);

    // 7. Link validation
    const linkValidation = await this.validateLinks(postData.content);
    warnings.push(...linkValidation.warnings);

    // 8. Conclusion format validation
    const conclusionValidation = this.validateConclusion(postData.content);
    if (!conclusionValidation.valid) {
      errors.push(...conclusionValidation.errors);
    }
    warnings.push(...conclusionValidation.warnings);

    // Print results
    if (errors.length > 0) {
      console.log('❌ VALIDATION FAILED:\n');
      errors.forEach(error => console.log(`   ✗ ${error}`));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:\n');
      warnings.forEach(warning => console.log(`   ! ${warning}`));
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ All validations passed!\n');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        wordCount: this.countWords(postData.content),
        paragraphCount: this.countParagraphs(postData.content),
        headingCount: this.countHeadings(postData.content),
        linkCount: this.countLinks(postData.content),
        firstPersonUsage: this.countFirstPersonUsage(postData.content),
        regionalMentions: this.countRegionalMentions(postData.content)
      }
    };
  }

  /**
   * Validate title
   */
  validateTitle(title) {
    const errors = [];
    const warnings = [];

    if (!title || title.trim().length === 0) {
      errors.push('Title is empty');
      return { valid: false, errors, warnings };
    }

    const trimmedTitle = title.trim();

    // Length validation
    if (trimmedTitle.length > 60) {
      errors.push(`Title too long (${trimmedTitle.length} chars, max 60)`);
    }

    if (trimmedTitle.length < 30) {
      warnings.push(`Title quite short (${trimmedTitle.length} chars, recommend 40-60)`);
    }

    // Check for incomplete titles
    if (trimmedTitle.endsWith('...')) {
      errors.push('Title appears incomplete (ends with ...)');
    }

    // Check for generic/vague titles
    const genericTerms = ['strategies', 'guide', 'tips', 'ways', 'methods'];
    const isGeneric = genericTerms.some(term => 
      trimmedTitle.toLowerCase().includes(term) && 
      !(/\d+/.test(trimmedTitle) || /singapore|apac|sea/i.test(trimmedTitle))
    );
    
    if (isGeneric) {
      warnings.push('Title may be too generic - consider adding specificity (numbers, location, outcome)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate voice and tone
   */
  validateVoice(content) {
    const errors = [];
    const warnings = [];

    // Check for "this article" language (prohibited)
    const prohibitedPhrases = [
      /this article/gi,
      /this post/gi,
      /this piece/gi,
      /this blog/gi
    ];

    prohibitedPhrases.forEach(phrase => {
      if (phrase.test(content)) {
        errors.push(`Found prohibited phrase "${phrase.source}" - must use first-person voice instead`);
      }
    });

    // Check for first-person usage
    const firstPersonCount = this.countFirstPersonUsage(content);
    if (firstPersonCount < 3) {
      errors.push(`Insufficient first-person voice (found ${firstPersonCount} instances, need at least 3)`);
    }

    // Check for passive voice indicators (warnings only)
    const passiveIndicators = content.match(/\b(is|are|was|were|been|being)\s+\w+ed\b/gi);
    if (passiveIndicators && passiveIndicators.length > 10) {
      warnings.push(`High passive voice usage detected (${passiveIndicators.length} instances) - prefer active voice`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate regional context
   */
  validateRegionalContext(content) {
    const errors = [];
    const warnings = [];

    // Check for regional mentions
    const regionalMentions = this.countRegionalMentions(content);
    
    if (regionalMentions === 0) {
      errors.push('Missing regional context - must mention Singapore/APAC/Southeast Asia/SEA');
    } else if (regionalMentions === 1) {
      warnings.push('Only one regional mention - recommend 2-3 throughout article');
    }

    // Check for specific examples with dates
    const hasYears = /20(23|24|25)/.test(content);
    if (!hasYears) {
      warnings.push('No recent years mentioned (2023-2025) - examples should be dated');
    }

    // Check for specific company/industry mentions
    const hasSpecificExample = /\b(startup|company|firm|brand|business)\b/i.test(content);
    if (!hasSpecificExample) {
      warnings.push('Consider adding specific company or industry examples');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate conclusion format
   */
  validateConclusion(content) {
    const errors = [];
    const warnings = [];

    // Extract last paragraph
    const paragraphs = content.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
    if (paragraphs.length === 0) {
      errors.push('No paragraphs found in content');
      return { valid: false, errors, warnings };
    }

    const lastParagraph = paragraphs[paragraphs.length - 1];
    
    // Check if there's a heading right before the last paragraph
    const lastHeadingIndex = content.lastIndexOf('<h2');
    const lastParagraphIndex = content.lastIndexOf(lastParagraph);
    
    // If heading comes after the second-to-last paragraph, conclusion has a heading (error)
    if (lastHeadingIndex > 0 && lastHeadingIndex > lastParagraphIndex - 500) {
      errors.push('Conclusion should NOT have a heading - end with 2-3 sentences only');
    }

    // Check conclusion length
    const conclusionText = this.extractTextContent(lastParagraph);
    const conclusionWords = conclusionText.split(/\s+/).length;
    
    if (conclusionWords > 100) {
      warnings.push(`Conclusion is long (${conclusionWords} words) - recommend 30-60 words`);
    } else if (conclusionWords < 20) {
      warnings.push(`Conclusion is short (${conclusionWords} words) - recommend 30-60 words`);
    }

    // Check for hyperlinks in conclusion
    if (/<a\s+href/i.test(lastParagraph)) {
      errors.push('Conclusion should NOT contain hyperlinks');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate content structure and quality
   */
  validateContent(content, templateType) {
    const errors = [];
    const warnings = [];

    if (!content || content.trim().length === 0) {
      errors.push('Content is empty');
      return { valid: false, errors, warnings };
    }

    // Word count
    const wordCount = this.countWords(content);
    if (wordCount < this.minWordCount) {
      errors.push(`Content too short (${wordCount} words, minimum ${this.minWordCount})`);
    } else if (wordCount > this.maxWordCount) {
      warnings.push(`Content quite long (${wordCount} words, target ${this.minWordCount}-${this.maxWordCount})`);
    }

    // Paragraph count
    const paragraphCount = this.countParagraphs(content);
    if (paragraphCount < this.minParagraphs) {
      warnings.push(`Few paragraphs (${paragraphCount}, recommend at least ${this.minParagraphs})`);
    }

    // Sentence length check
    const longSentences = this.findLongSentences(content);
    if (longSentences.length > 5) {
      warnings.push(`${longSentences.length} sentences exceed 25 words - aim for 15-20 words per sentence`);
    }

    // Heading structure
    const headings = this.extractHeadings(content);
    
    // Check for H1
    const h1Count = headings.filter(h => h.level === 1).length;
    if (h1Count === 0) {
      warnings.push('No H1 heading found - Ghost will use title');
    } else if (h1Count > 1) {
      warnings.push(`Multiple H1 headings found (${h1Count}) - should be only 1`);
    }

    // Check for H2s
    const h2Count = headings.filter(h => h.level === 2).length;
    if (h2Count < 4) {
      warnings.push(`Few H2 headings (${h2Count}, recommend at least 4-6 for readability)`);
    }

    // Check for generic headings
    const genericHeadingPatterns = [
      /^introduction$/i,
      /^conclusion$/i,
      /^overview$/i,
      /^background$/i,
      /^summary$/i
    ];
    
    headings.forEach(h => {
      if (genericHeadingPatterns.some(pattern => pattern.test(h.text))) {
        warnings.push(`Generic heading found: "${h.text}" - make headings more specific and valuable`);
      }
    });

    // Check for lists
    const hasBulletLists = content.includes('<ul>');
    const hasNumberedLists = content.includes('<ol>');
    
    if (!hasBulletLists && !hasNumberedLists) {
      warnings.push('No lists found - consider adding for readability');
    }

    // Check for FAQ section (conditional)
    const hasFAQ = headings.some(h => 
      h.text.toLowerCase().includes('frequently asked questions') ||
      h.text.toLowerCase().includes('faq')
    );
    
    if (templateType === 'How-To / Playbook' && !hasFAQ) {
      errors.push('FAQ section required for How-To/Playbook template');
    }

    // Check for bold formatting
    const boldCount = (content.match(/<strong>/gi) || []).length;
    if (boldCount === 0) {
      warnings.push('No bold text found - use <strong> to emphasize key points (3-5 times)');
    }

    // Check for incomplete sentences
    const incompletePattern = /[a-z]\s*\.\s*["']?\s*<\/p>/i;
    if (incompletePattern.test(content)) {
      // More sophisticated check needed
      const potentiallyIncomplete = content.match(/\b[a-z]{1,2}\s*\.\s*["']?\s*<\/p>/gi);
      if (potentiallyIncomplete) {
        warnings.push('Possible incomplete sentences detected - verify all sentences are complete');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Find sentences longer than 25 words
   */
  findLongSentences(content) {
    const text = this.extractTextContent(content);
    const sentences = text.split(/[.!?]+/);
    
    return sentences.filter(sentence => {
      const words = sentence.trim().split(/\s+/);
      return words.length > 25;
    });
  }

  /**
   * Count first-person usage
   */
  countFirstPersonUsage(content) {
    const text = this.extractTextContent(content);
    const firstPersonPatterns = [
      /\bI\s+(?:believe|think|see|find|argue|contend|suggest|recommend|ve|have)/gi,
      /\bwe\s+(?:believe|see|find|argue|recommend|ve|have)/gi,
      /\bin my (?:experience|view|work|opinion)/gi,
      /\bI've (?:seen|worked|found|learned|witnessed)/gi,
      /\bwe've (?:seen|worked|found|learned)/gi
    ];
    
    let count = 0;
    firstPersonPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        count += matches.length;
      }
    });
    
    return count;
  }

  /**
   * Count regional mentions
   */
  countRegionalMentions(content) {
    const text = this.extractTextContent(content);
    const regionalPatterns = [
      /\bsingapore\b/gi,
      /\bapac\b/gi,
      /\basia[- ]pacific\b/gi,
      /\bsoutheast asia\b/gi,
      /\bsea\b/gi,
      /\basean\b/gi
    ];
    
    let count = 0;
    regionalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        count += matches.length;
      }
    });
    
    return count;
  }

  /**
   * Validate SEO metadata
   */
  validateSEO(postData) {
    const errors = [];
    const warnings = [];

    // Meta title
    if (!postData.metaTitle) {
      errors.push('Meta title is missing');
    } else if (postData.metaTitle.length > 60) {
      errors.push(`Meta title too long (${postData.metaTitle.length} chars, max 60)`);
    }

    // Meta description
    if (!postData.metaDescription) {
      errors.push('Meta description is missing');
    } else {
      const descLength = postData.metaDescription.length;
      if (descLength < 150) {
        warnings.push(`Meta description short (${descLength} chars, recommend 150-160)`);
      } else if (descLength > 160) {
        errors.push(`Meta description too long (${descLength} chars, max 160)`);
      }
    }

    // OG tags
    if (!postData.ogTitle) {
      warnings.push('OG title missing (will default to meta title)');
    }

    if (!postData.ogDescription) {
      warnings.push('OG description missing (will default to meta description)');
    }

    // Keyword density check (basic)
    if (postData.keyword) {
      const keywordCount = (postData.content.toLowerCase().match(new RegExp(postData.keyword.toLowerCase(), 'g')) || []).length;
      const wordCount = this.countWords(postData.content);
      const density = (keywordCount / wordCount) * 100;
      
      if (density < 0.5) {
        warnings.push(`Keyword density low (${density.toFixed(2)}%, recommend 1-1.5%)`);
      } else if (density > 2) {
        warnings.push(`Keyword density high (${density.toFixed(2)}%, may be over-optimized)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate image
   */
  async validateImage(imageData) {
    const errors = [];
    const warnings = [];

    if (!imageData || !imageData.url) {
      warnings.push('No featured image - consider adding for better engagement');
      return { valid: true, errors, warnings };
    }

    // Check if URL is accessible
    try {
      const response = await axios.head(imageData.url, { timeout: 5000 });
      
      if (response.status !== 200) {
        errors.push(`Image URL returned status ${response.status}`);
      }
      
      // Check content type
      const contentType = response.headers['content-type'];
      if (!contentType.includes('image')) {
        errors.push(`Image URL does not point to an image (${contentType})`);
      }
      
    } catch (error) {
      errors.push(`Image URL not accessible: ${error.message}`);
    }

    // Alt text validation
    if (!imageData.altText) {
      warnings.push('Image alt text is missing - bad for SEO and accessibility');
    } else if (imageData.altText.length < 10) {
      warnings.push('Image alt text is very short - should be descriptive');
    } else if (imageData.altText.length > 125) {
      warnings.push('Image alt text is too long - keep under 125 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate external links
   */
  async validateLinks(content) {
    const warnings = [];
    const links = this.extractLinks(content);

    if (links.length === 0) {
      warnings.push('No external links found - consider adding 3-4 authoritative sources');
      return { warnings };
    }

    if (links.length < 3) {
      warnings.push(`Only ${links.length} external link(s) - recommend 3-4 for credibility`);
    }

    // Check link quality (basic check - just verify they're accessible)
    let brokenLinks = 0;
    
    for (const link of links.slice(0, 5)) { // Check first 5 links only to save time
      try {
        await axios.head(link, { timeout: 3000 });
      } catch (error) {
        brokenLinks++;
        warnings.push(`Link may be broken: ${link}`);
      }
    }

    return { warnings };
  }

  // Helper methods

  countWords(html) {
    const text = this.extractTextContent(html);
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  }

  countParagraphs(html) {
    const matches = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
    return matches ? matches.length : 0;
  }

  countHeadings(html) {
    const matches = html.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi);
    return matches ? matches.length : 0;
  }

  countLinks(html) {
    const matches = html.match(/<a[^>]*href=[^>]*>[\s\S]*?<\/a>/gi);
    return matches ? matches.length : 0;
  }

  extractHeadings(html) {
    const headings = [];
    const regex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      headings.push({
        level: parseInt(match[1]),
        text: match[2].replace(/<[^>]*>/g, '').trim()
      });
    }

    return headings;
  }

  extractLinks(html) {
    const links = [];
    const regex = /<a[^>]*href=["']([^"']*)["'][^>]*>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      // Only external links
      if (url.startsWith('http://') || url.startsWith('https://')) {
        links.push(url);
      }
    }

    return links;
  }

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
}

module.exports = ContentValidator;