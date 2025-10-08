// src/utils/seoSchema.js - Generate structured data (JSON-LD) for SEO
class SEOSchema {
  constructor() {
    this.organizationName = "Ignition Studio";
    this.organizationUrl = process.env.GHOST_API_URL || "https://ignitionstudio.co";
    this.organizationLogo = `${this.organizationUrl}/content/images/logo.png`;
  }

  /**
   * Generate Article schema (JSON-LD)
   */
  generateArticleSchema(postData, imageUrl, authorName, publishDate) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": postData.title,
      "description": postData.metaDescription,
      "image": imageUrl || `${this.organizationUrl}/content/images/default-og.png`,
      "author": {
        "@type": "Person",
        "name": authorName,
        "url": `${this.organizationUrl}/author/${this.slugify(authorName)}`
      },
      "publisher": {
        "@type": "Organization",
        "name": this.organizationName,
        "logo": {
          "@type": "ImageObject",
          "url": this.organizationLogo
        }
      },
      "datePublished": publishDate || new Date().toISOString(),
      "dateModified": publishDate || new Date().toISOString(),
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `${this.organizationUrl}/${this.slugify(postData.title)}`
      }
    };

    return schema;
  }

  /**
   * Generate FAQ schema if FAQs are present in content
   */
  generateFAQSchema(content) {
    const faqs = this.extractFAQs(content);
    
    if (faqs.length === 0) {
      return null;
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    return schema;
  }

  /**
   * Generate BreadcrumbList schema
   */
  generateBreadcrumbSchema(postTitle, categorySlug = "insights") {
    const schema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": this.organizationUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Insights",
          "item": `${this.organizationUrl}/${categorySlug}`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": postTitle
        }
      ]
    };

    return schema;
  }

  /**
   * Generate Organization schema
   */
  generateOrganizationSchema() {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": this.organizationName,
      "url": this.organizationUrl,
      "logo": this.organizationLogo,
      "sameAs": [
        "https://www.linkedin.com/company/ignition-studio",
        "https://twitter.com/ignitionstudio"
      ]
    };

    return schema;
  }

  /**
   * Combine all schemas into one script tag
   */
  generateCombinedSchema(postData, imageUrl, authorName, publishDate) {
    const schemas = [
      this.generateArticleSchema(postData, imageUrl, authorName, publishDate)
    ];

    // Add FAQ schema if FAQs exist
    const faqSchema = this.generateFAQSchema(postData.content);
    if (faqSchema) {
      schemas.push(faqSchema);
    }

    // Add breadcrumb
    schemas.push(this.generateBreadcrumbSchema(postData.title));

    return {
      "@context": "https://schema.org",
      "@graph": schemas
    };
  }

  /**
   * Extract FAQs from content
   */
  extractFAQs(content) {
    const faqs = [];
    
    // Look for FAQ section
    const faqRegex = /<h2[^>]*>(?:Frequently Asked Questions|FAQ)<\/h2>([\s\S]*?)(?=<h2|$)/i;
    const faqMatch = faqRegex.exec(content);
    
    if (!faqMatch) {
      return faqs;
    }

    const faqSection = faqMatch[1];
    
    // Extract H3 questions and following paragraphs
    const questionRegex = /<h3[^>]*>(.*?)<\/h3>\s*<p[^>]*>(.*?)<\/p>/gi;
    let match;
    
    while ((match = questionRegex.exec(faqSection)) !== null) {
      const question = this.stripHTML(match[1]);
      const answer = this.stripHTML(match[2]);
      
      if (question && answer) {
        faqs.push({ question, answer });
      }
    }
    
    return faqs;
  }

  /**
   * Strip HTML tags
   */
  stripHTML(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * Generate URL slug
   */
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Format schema as JSON-LD script tag (for Ghost code injection)
   */
  formatAsScriptTag(schema) {
    return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
  }
}

module.exports = SEOSchema;