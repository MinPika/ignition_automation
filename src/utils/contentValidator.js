// src/utils/contentValidator.js - Content validation before publishing
const axios = require('axios');

class ContentValidator {
  constructor() {
    this.minWordCount = 1200;
    this.maxWordCount = 2000;
    this.minParagraphs = 8;
    this.requiredSections = {
      'Strategic Framework': ['Executive Summary', 'Framework', 'Implementation', 'Conclusion'],
      'Case Study Analysis': ['Executive Summary', 'Background', 'Solution', 'Results', 'Lessons'],
      'Vision & Outlook': ['Executive Summary', 'Trends', 'Implications', 'Signals', 'Thoughts'],
      'How-To / Playbook': ['Executive Summary', 'Problem', 'Methodology', 'Example', 'Conclusion']
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

    // 3. SEO metadata validation
    const seoValidation = this.validateSEO(postData);
    if (!seoValidation.valid) {
      errors.push(...seoValidation.errors);
    }
    warnings.push(...seoValidation.warnings);

    // 4. Image validation
    const imageValidation = await this.validateImage(imageData);
    if (!imageValidation.valid) {
      errors.push(...imageValidation.errors);
    }
    warnings.push(...imageValidation.warnings);

    // 5. Link validation
    const linkValidation = await this.validateLinks(postData.content);
    warnings.push(...linkValidation.warnings);

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

    if (trimmedTitle.length < 30) {
      warnings.push(`Title quite short (${trimmedTitle.length} chars, recommend 40-60)`);
    }

    // Check for incomplete titles
    if (trimmedTitle.endsWith('...')) {
      errors.push('Title appears incomplete (ends with ...)');
    }

    // Check for common title issues
    if (/^(the|a|an)\s+/i.test(trimmedTitle)) {
      warnings.push('Title starts with article (the/a/an) - consider removing for SEO');
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
    if (h2Count < 3) {
      warnings.push(`Few H2 headings (${h2Count}, recommend at least 4-6 for readability)`);
    }

    // Check for required sections based on template
    if (this.requiredSections[templateType]) {
      const requiredKeywords = this.requiredSections[templateType];
      const missingKeywords = [];
      
      requiredKeywords.forEach(keyword => {
        const found = headings.some(h => 
          h.text.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!found) {
          missingKeywords.push(keyword);
        }
      });
      
      if (missingKeywords.length > 0) {
        warnings.push(`Template sections may be missing: ${missingKeywords.join(', ')}`);
      }
    }

    // Check for lists
    const hasBulletLists = content.includes('<ul>');
    const hasNumberedLists = content.includes('<ol>');
    
    if (!hasBulletLists && !hasNumberedLists) {
      warnings.push('No lists found - consider adding for readability');
    }

    // Check for FAQ section
    const hasFAQ = headings.some(h => 
      h.text.toLowerCase().includes('frequently asked questions') ||
      h.text.toLowerCase().includes('faq')
    );
    
    if (!hasFAQ) {
      warnings.push('No FAQ section found - recommended for SEO');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
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
        warnings.push(`Keyword density low (${density.toFixed(2)}%, recommend 1-2%)`);
      } else if (density > 3) {
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
      warnings.push('No external links found - consider adding 2-3 authoritative sources');
      return { warnings };
    }

    if (links.length < 2) {
      warnings.push(`Only ${links.length} external link - recommend 2-3 for credibility`);
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
    const text = html.replace(/<[^>]*>/g, ' ');
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
}

module.exports = ContentValidator;