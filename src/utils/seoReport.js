// src/utils/seoReport.js - Generate SEO quality reports
const fs = require('fs-extra');
const path = require('path');

class SEOReport {
  constructor() {
    this.reportDir = path.join(process.cwd(), 'generated', 'reports');
    fs.ensureDirSync(this.reportDir);
  }

  /**
   * Generate comprehensive SEO report for a post
   */
  generateReport(postData, validation, imageData, configuration) {
    const report = {
      timestamp: new Date().toISOString(),
      post: {
        title: postData.title,
        keyword: postData.keyword,
        template: postData.templateType,
        author: postData.author
      },
      seo: {
        metaTitle: {
          value: postData.metaTitle,
          length: postData.metaTitle.length,
          optimal: postData.metaTitle.length >= 50 && postData.metaTitle.length <= 60,
          score: this.scoreMetaTitle(postData.metaTitle)
        },
        metaDescription: {
          value: postData.metaDescription,
          length: postData.metaDescription.length,
          optimal: postData.metaDescription.length >= 150 && postData.metaDescription.length <= 160,
          score: this.scoreMetaDescription(postData.metaDescription, postData.keyword)
        },
        keyword: {
          target: postData.keyword,
          inTitle: postData.title.toLowerCase().includes(postData.keyword.toLowerCase()),
          inMetaDescription: postData.metaDescription.toLowerCase().includes(postData.keyword.toLowerCase()),
          density: this.calculateKeywordDensity(postData.content, postData.keyword),
          score: this.scoreKeywordUsage(postData, postData.keyword)
        },
        headings: {
          structure: this.analyzeHeadingStructure(postData.content),
          score: this.scoreHeadingStructure(postData.content)
        },
        readability: {
          wordCount: validation.metrics.wordCount,
          paragraphCount: validation.metrics.paragraphCount,
          avgWordsPerParagraph: Math.round(validation.metrics.wordCount / validation.metrics.paragraphCount),
          score: this.scoreReadability(validation.metrics)
        },
        links: {
          total: validation.metrics.linkCount,
          internalEstimate: 0, // Would need actual link analysis
          externalEstimate: validation.metrics.linkCount,
          score: this.scoreLinkProfile(validation.metrics.linkCount)
        },
        image: {
          present: !!imageData.url,
          hasAltText: !!imageData.altText,
          altTextLength: imageData.altText ? imageData.altText.length : 0,
          altTextOptimal: imageData.altText ? imageData.altText.length >= 10 && imageData.altText.length <= 125 : false,
          score: this.scoreImage(imageData)
        }
      },
      validation: {
        passed: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      },
      overall: {
        score: 0,
        grade: '',
        recommendations: []
      }
    };

    // Calculate overall score
    report.overall.score = this.calculateOverallScore(report.seo);
    report.overall.grade = this.getGrade(report.overall.score);
    report.overall.recommendations = this.generateRecommendations(report.seo);

    return report;
  }

  /**
   * Score meta title (0-100)
   */
  scoreMetaTitle(title) {
    let score = 100;
    
    if (title.length < 30) score -= 30;
    else if (title.length < 50) score -= 10;
    else if (title.length > 60) score -= 20;
    
    // Check for power words
    const powerWords = ['ultimate', 'guide', 'complete', 'essential', 'proven', 'effective', 'master', 'unlock'];
    const hasPowerWord = powerWords.some(word => title.toLowerCase().includes(word));
    if (!hasPowerWord) score -= 5;
    
    return Math.max(0, score);
  }

  /**
   * Score meta description (0-100)
   */
  scoreMetaDescription(description, keyword) {
    let score = 100;
    
    if (description.length < 120) score -= 20;
    else if (description.length < 150) score -= 10;
    else if (description.length > 160) score -= 30;
    
    // Check keyword presence
    if (!description.toLowerCase().includes(keyword.toLowerCase())) {
      score -= 20;
    }
    
    // Check for call-to-action words
    const ctaWords = ['discover', 'learn', 'explore', 'find out', 'understand', 'master'];
    const hasCTA = ctaWords.some(word => description.toLowerCase().includes(word));
    if (!hasCTA) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * Calculate keyword density
   */
  calculateKeywordDensity(content, keyword) {
    const text = content.replace(/<[^>]*>/g, ' ').toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const keywordOccurrences = (text.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
    
    return ((keywordOccurrences / words.length) * 100).toFixed(2);
  }

  /**
   * Score keyword usage (0-100)
   */
  scoreKeywordUsage(postData, keyword) {
    let score = 100;
    const lowerKeyword = keyword.toLowerCase();
    
    // Title
    if (!postData.title.toLowerCase().includes(lowerKeyword)) {
      score -= 25;
    }
    
    // Meta description
    if (!postData.metaDescription.toLowerCase().includes(lowerKeyword)) {
      score -= 15;
    }
    
    // Density
    const density = parseFloat(this.calculateKeywordDensity(postData.content, keyword));
    if (density < 0.5) score -= 20;
    else if (density > 3) score -= 20;
    
    // First 100 words
    const first100Words = postData.content.substring(0, 500).toLowerCase();
    if (!first100Words.includes(lowerKeyword)) {
      score -= 15;
    }
    
    return Math.max(0, score);
  }

  /**
   * Analyze heading structure
   */
  analyzeHeadingStructure(content) {
    const structure = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
    
    for (let i = 1; i <= 6; i++) {
      const regex = new RegExp(`<h${i}[^>]*>`, 'gi');
      const matches = content.match(regex);
      structure[`h${i}`] = matches ? matches.length : 0;
    }
    
    return structure;
  }

  /**
   * Score heading structure (0-100)
   */
  scoreHeadingStructure(content) {
    let score = 100;
    const structure = this.analyzeHeadingStructure(content);
    
    // Should have 1 H1
    if (structure.h1 === 0) score -= 5; // Okay if Ghost uses title
    else if (structure.h1 > 1) score -= 15;
    
    // Should have 4-8 H2s
    if (structure.h2 < 3) score -= 20;
    else if (structure.h2 > 10) score -= 10;
    
    // Should have some H3s
    if (structure.h3 === 0 && structure.h2 > 5) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * Score readability (0-100)
   */
  scoreReadability(metrics) {
    let score = 100;
    
    // Word count
    if (metrics.wordCount < 1200) score -= 25;
    else if (metrics.wordCount > 2000) score -= 10;
    
    // Paragraph count
    if (metrics.paragraphCount < 8) score -= 15;
    
    // Average words per paragraph
    const avgWords = metrics.wordCount / metrics.paragraphCount;
    if (avgWords > 100) score -= 20;
    else if (avgWords > 75) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * Score link profile (0-100)
   */
  scoreLinkProfile(linkCount) {
    let score = 100;
    
    if (linkCount === 0) score -= 40;
    else if (linkCount === 1) score -= 20;
    else if (linkCount > 10) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * Score image optimization (0-100)
   */
  scoreImage(imageData) {
    let score = 100;
    
    if (!imageData.url) {
      score -= 50;
    } else {
      if (!imageData.altText) {
        score -= 30;
      } else if (imageData.altText.length < 10) {
        score -= 20;
      } else if (imageData.altText.length > 125) {
        score -= 10;
      }
    }
    
    return Math.max(0, score);
  }

  /**
   * Calculate overall SEO score
   */
  calculateOverallScore(seo) {
    const weights = {
      metaTitle: 0.15,
      metaDescription: 0.15,
      keyword: 0.20,
      headings: 0.15,
      readability: 0.15,
      links: 0.10,
      image: 0.10
    };

    const weightedScore = 
      (seo.metaTitle.score * weights.metaTitle) +
      (seo.metaDescription.score * weights.metaDescription) +
      (seo.keyword.score * weights.keyword) +
      (seo.headings.score * weights.headings) +
      (seo.readability.score * weights.readability) +
      (seo.links.score * weights.links) +
      (seo.image.score * weights.image);

    return Math.round(weightedScore);
  }

  /**
   * Get letter grade
   */
  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(seo) {
    const recommendations = [];

    // Meta title
    if (seo.metaTitle.score < 80) {
      if (!seo.metaTitle.optimal) {
        recommendations.push({
          category: 'Meta Title',
          priority: 'High',
          issue: `Title length is ${seo.metaTitle.length} characters`,
          fix: 'Optimize title to 50-60 characters'
        });
      }
    }

    // Meta description
    if (seo.metaDescription.score < 80) {
      if (!seo.metaDescription.optimal) {
        recommendations.push({
          category: 'Meta Description',
          priority: 'High',
          issue: `Description length is ${seo.metaDescription.length} characters`,
          fix: 'Optimize description to 150-160 characters'
        });
      }
      if (!seo.keyword.inMetaDescription) {
        recommendations.push({
          category: 'Meta Description',
          priority: 'Medium',
          issue: 'Target keyword not in meta description',
          fix: 'Include target keyword naturally in description'
        });
      }
    }

    // Keyword
    if (seo.keyword.score < 80) {
      const density = parseFloat(seo.keyword.density);
      if (density < 0.5) {
        recommendations.push({
          category: 'Keyword',
          priority: 'High',
          issue: `Low keyword density (${density}%)`,
          fix: 'Increase keyword usage to 1-2% of content'
        });
      } else if (density > 3) {
        recommendations.push({
          category: 'Keyword',
          priority: 'High',
          issue: `High keyword density (${density}%)`,
          fix: 'Reduce keyword usage to avoid over-optimization'
        });
      }
      if (!seo.keyword.inTitle) {
        recommendations.push({
          category: 'Keyword',
          priority: 'Critical',
          issue: 'Target keyword not in title',
          fix: 'Include keyword in title for better SEO'
        });
      }
    }

    // Headings
    if (seo.headings.score < 80) {
      if (seo.headings.structure.h2 < 3) {
        recommendations.push({
          category: 'Headings',
          priority: 'Medium',
          issue: `Only ${seo.headings.structure.h2} H2 headings`,
          fix: 'Add more H2 headings (aim for 4-6) to improve structure'
        });
      }
    }

    // Readability
    if (seo.readability.score < 80) {
      if (seo.readability.wordCount < 1200) {
        recommendations.push({
          category: 'Readability',
          priority: 'High',
          issue: `Content is short (${seo.readability.wordCount} words)`,
          fix: 'Expand content to 1,400-1,600 words for better depth'
        });
      }
      if (seo.readability.avgWordsPerParagraph > 75) {
        recommendations.push({
          category: 'Readability',
          priority: 'Medium',
          issue: 'Paragraphs are too long',
          fix: 'Break paragraphs into 2-3 sentences each'
        });
      }
    }

    // Links
    if (seo.links.score < 80) {
      if (seo.links.total < 2) {
        recommendations.push({
          category: 'Links',
          priority: 'Medium',
          issue: `Only ${seo.links.total} links in content`,
          fix: 'Add 2-3 external links to authoritative sources'
        });
      }
    }

    // Image
    if (seo.image.score < 80) {
      if (!seo.image.present) {
        recommendations.push({
          category: 'Image',
          priority: 'High',
          issue: 'No featured image',
          fix: 'Add a featured image for social sharing'
        });
      } else if (!seo.image.hasAltText) {
        recommendations.push({
          category: 'Image',
          priority: 'High',
          issue: 'Missing alt text',
          fix: 'Add descriptive alt text with target keyword'
        });
      }
    }

    return recommendations;
  }

  /**
   * Save report to file
   */
  saveReport(report, postTitle) {
    const filename = `seo-report-${this.slugify(postTitle)}-${Date.now()}.json`;
    const filepath = path.join(this.reportDir, filename);
    
    fs.writeJsonSync(filepath, report, { spaces: 2 });
    console.log(`📊 SEO Report saved: ${filename}`);
    
    return filepath;
  }

  /**
   * Print report summary
   */
  printSummary(report) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 SEO QUALITY REPORT');
    console.log('='.repeat(70));
    
    console.log(`\nPost: ${report.post.title}`);
    console.log(`Author: ${report.post.author}`);
    console.log(`Keyword: ${report.post.keyword}`);
    
    console.log(`\n🎯 Overall SEO Score: ${report.overall.score}/100 (Grade: ${report.overall.grade})`);
    
    console.log('\n📈 Component Scores:');
    console.log(`  Meta Title:       ${report.seo.metaTitle.score}/100 ${report.seo.metaTitle.optimal ? '✅' : '⚠️'}`);
    console.log(`  Meta Description: ${report.seo.metaDescription.score}/100 ${report.seo.metaDescription.optimal ? '✅' : '⚠️'}`);
    console.log(`  Keyword Usage:    ${report.seo.keyword.score}/100`);
    console.log(`  Heading Structure:${report.seo.headings.score}/100`);
    console.log(`  Readability:      ${report.seo.readability.score}/100`);
    console.log(`  Link Profile:     ${report.seo.links.score}/100`);
    console.log(`  Image SEO:        ${report.seo.image.score}/100`);
    
    if (report.overall.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      report.overall.recommendations
        .sort((a, b) => {
          const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .slice(0, 5)
        .forEach((rec, i) => {
          console.log(`  ${i + 1}. [${rec.priority}] ${rec.category}: ${rec.issue}`);
          console.log(`     → ${rec.fix}`);
        });
    }
    
    console.log('\n' + '='.repeat(70));
  }

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }
}

module.exports = SEOReport;