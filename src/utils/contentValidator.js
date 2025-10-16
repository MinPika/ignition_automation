// src/utils/contentValidator.js - Enhanced content validation with context-aware checking
const axios = require('axios');

class ContentValidator {
  constructor() {
    this.minWordCount = 800;
    this.maxWordCount = 1800;
    this.minParagraphs = 6;
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

    // 3. Voice and tone validation (IMPROVED)
    const voiceValidation = this.validateVoiceContextAware(postData.content);
    if (!voiceValidation.valid) {
      errors.push(...voiceValidation.errors);
    }
    warnings.push(...voiceValidation.warnings);

    // 4. SEO metadata validation
    const seoValidation = this.validateSEO(postData);
    if (!seoValidation.valid) {
      errors.push(...seoValidation.errors);
    }
    warnings.push(...seoValidation.warnings);

    // 5. Image validation
    const imageValidation = await this.validateImage(imageData);
    if (!imageValidation.valid) {
      errors.push(...imageValidation.errors);
    }
    warnings.push(...imageValidation.warnings);

    // 6. Link validation
    const linkValidation = await this.validateLinks(postData.content);
    warnings.push(...linkValidation.warnings);

    // 7. Conclusion format validation
    const conclusionValidation = this.validateConclusion(postData.content);
    if (!conclusionValidation.valid) {
      errors.push(...conclusionValidation.errors);
    }
    warnings.push(...conclusionValidation.warnings);

    // 8. Fact-checking and anti-hallucination check
    const factValidation = this.validateFactualContent(postData.content);
    warnings.push(...factValidation.warnings);

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
        linkCount: this.countLinks(postData.content)
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

    if (trimmedTitle.length < 40) {
      warnings.push(`Title quite short (${trimmedTitle.length} chars, recommend 40-60)`);
    }

    // Check for incomplete titles
    if (trimmedTitle.endsWith('...')) {
      errors.push('Title appears incomplete (ends with ...)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * IMPROVED: Context-aware voice validation
   * Only flags actual meta-references, not false positives
   */
  validateVoiceContextAware(content) {
    const errors = [];
    const warnings = [];

    // Extract text content for analysis
    const textContent = this.extractTextContent(content);
    
    // Split into sentences for context analysis
    const sentences = textContent.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);

    // Check each sentence for prohibited phrases IN CONTEXT
    const prohibitedPatterns = [
      {
        pattern: /\bthis article\b/gi,
        description: '"this article"',
        contextCheck: (sentence) => {
          // Allow if it's referring to a cited article/source, not the current article
          const isCitation = /according to|cited in|from|published in|study|research|report/i.test(sentence);
          return !isCitation; // Flag if NOT a citation
        }
      },
      {
        pattern: /\bthis post\b/gi,
        description: '"this post"',
        contextCheck: () => true // Always flag
      },
      {
        pattern: /\bthis piece\b/gi,
        description: '"this piece"',
        contextCheck: () => true // Always flag
      },
      {
        pattern: /\bthis blog\b/gi,
        description: '"this blog"',
        contextCheck: () => true // Always flag
      },
      {
        pattern: /\bwe at ignition\b/gi,
        description: '"we at ignition"',
        contextCheck: () => true // Always flag
      },
      {
        pattern: /\bignition studio\b/gi,
        description: '"ignition studio"',
        contextCheck: () => true // Always flag
      },
      {
        pattern: /\bcontact us\b/gi,
        description: '"contact us"',
        contextCheck: () => true // Always flag
      },
      {
        pattern: /\bour services\b/gi,
        description: '"our services"',
        contextCheck: () => true // Always flag
      }
    ];

    prohibitedPatterns.forEach(({ pattern, description, contextCheck }) => {
      sentences.forEach(sentence => {
        const matches = sentence.match(pattern);
        if (matches) {
          // Check context to avoid false positives
          const shouldFlag = contextCheck(sentence);
          if (shouldFlag) {
            errors.push(`Found prohibited phrase ${description} in: "${sentence.substring(0, 100)}..."`);
          }
        }
      });
    });

    // Check for passive voice indicators (warnings only)
    const passiveIndicators = textContent.match(/\b(is|are|was|were|been|being)\s+\w+ed\b/gi);
    if (passiveIndicators && passiveIndicators.length > 15) {
      warnings.push(`High passive voice usage detected (${passiveIndicators.length} instances) - prefer active voice`);
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

    const paragraphs = content.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
    if (paragraphs.length === 0) {
      errors.push('No paragraphs found in content');
      return { valid: false, errors, warnings };
    }

    const lastParagraph = paragraphs[paragraphs.length - 1];
    
    // Check if there's a heading right before the last paragraph
    const lastHeadingIndex = content.lastIndexOf('<h2');
    const lastParagraphIndex = content.lastIndexOf(lastParagraph);
    
    if (lastHeadingIndex > 0 && lastHeadingIndex > lastParagraphIndex - 500) {
      errors.push('Conclusion should NOT have a heading - end with 2-3 sentences only');
    }

    // Check conclusion length
    const conclusionText = this.extractTextContent(lastParagraph);
    const conclusionWords = conclusionText.split(/\s+/).length;
    
    if (conclusionWords > 100) {
      warnings.push(`Conclusion is long (${conclusionWords} words) - recommend 30-70 words`);
    } else if (conclusionWords < 20) {
      warnings.push(`Conclusion is short (${conclusionWords} words) - recommend 30-70 words`);
    }

    // Check for hyperlinks in conclusion
    if (/<a\s+href/i.test(lastParagraph)) {
      errors.push('Conclusion should NOT contain hyperlinks');
    }

    // Check for bold in conclusion
    if (/<strong>/i.test(lastParagraph)) {
      errors.push('Conclusion should NOT contain <strong> formatting');
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
    
    const h1Count = headings.filter(h => h.level === 1).length;
    if (h1Count === 0) {
      warnings.push('No H1 heading found - Ghost will use title');
    } else if (h1Count > 1) {
      warnings.push(`Multiple H1 headings found (${h1Count}) - should be only 1`);
    }

    const h2Count = headings.filter(h => h.level === 2).length;
    if (h2Count < 4) {
      warnings.push(`Few H2 headings (${h2Count}, recommend 4-6 for comprehensive coverage)`);
    } else if (h2Count > 8) {
      warnings.push(`Many H2 headings (${h2Count}, may be too fragmented)`);
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

    // External links check
    const linkCount = this.countLinks(content);
    if (linkCount < 3) {
      warnings.push(`Only ${linkCount} external link(s) - recommend 3-4 for credibility`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate factual content (anti-hallucination check)
   */
  validateFactualContent(content) {
    const warnings = [];
    
    // Check for suspiciously precise statistics without sources
    const suspiciousStats = content.match(/\b\d+(\.\d+)?%(?!\s*<\/a>)/g);
    if (suspiciousStats && suspiciousStats.length > 3) {
      warnings.push(`Found ${suspiciousStats.length} statistics - ensure all are from credible sources with citations`);
    }

    // Check for vague examples
    const vagueExamples = [
      /a (?:singapore|apac|sea) (?:startup|company|firm)/gi,
      /an (?:unnamed|anonymous) (?:company|organization)/gi
    ];
    
    vagueExamples.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches && matches.length > 2) {
        warnings.push(`Multiple vague examples found - use specific company names for real case studies`);
      }
    });

    // Check for dates that seem fabricated
    const futureDates = content.match(/\b20(2[6-9]|[3-9]\d)\b/g);
    if (futureDates) {
      warnings.push(`Found future dates (${futureDates.join(', ')}) - verify these are intentional forward-looking statements`);
    }

    return { warnings };
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
   * Validate SEO metadata
   */
  validateSEO(postData) {
    const errors = [];
    const warnings = [];

    if (!postData.metaTitle) {
      errors.push('Meta title is missing');
    } else if (postData.metaTitle.length > 60) {
      errors.push(`Meta title too long (${postData.metaTitle.length} chars, max 60)`);
    } else if (postData.metaTitle.length < 40) {
      warnings.push(`Meta title short (${postData.metaTitle.length} chars, recommend 50-60)`);
    }

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
      warnings.push('No featured image - recommend adding for better engagement');
      return { valid: true, errors, warnings };
    }

    try {
      const response = await axios.head(imageData.url, { timeout: 5000 });
      
      if (response.status !== 200) {
        errors.push(`Image URL returned status ${response.status}`);
      }
      
      const contentType = response.headers['content-type'];
      if (!contentType.includes('image')) {
        errors.push(`Image URL does not point to an image (${contentType})`);
      }
      
    } catch (error) {
      errors.push(`Image URL not accessible: ${error.message}`);
    }

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
      warnings.push('No external links found - recommend adding 3-4 authoritative sources');
      return { warnings };
    }

    if (links.length < 3) {
      warnings.push(`Only ${links.length} external link(s) - recommend 3-4 for credibility`);
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