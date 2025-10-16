// src/services/imageGenerator.js - AI-driven abstract image generation
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const GhostAdminAPI = require("@tryghost/admin-api");
const visualStyles = require('../config/visualStyles');
require("dotenv").config();

class ImageGenerator {
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    this.model = "gemini-2.5-flash-image-preview";
    this.maxRetries = 3;
    this.retryDelay = 5000;
    
    // Ghost CMS featured image dimensions
    this.imageWidth = 1200;
    this.imageHeight = 675;
    this.aspectRatio = "16:9";
    
    this.imageDir = path.join(process.cwd(), "generated/images");
    if (!fs.existsSync(this.imageDir)) {
      fs.mkdirSync(this.imageDir, { recursive: true });
    }

    this.ghost = new GhostAdminAPI({
      url: process.env.GHOST_API_URL,
      key: process.env.GHOST_ADMIN_API_KEY,
      version: "v5.0",
    });
  }

  /**
   * Generate featured image based on article content
   * @param {string} keyword - Article topic/keyword
   * @param {string} templateType - Article template type
   * @param {string} persona - Author persona name
   * @param {string} articleContent - Full HTML content of article
   */
  async generateFeaturedImage(keyword, templateType, persona, articleContent = null) {
    const colorPalette = this.selectColorPalette(keyword);
    const prompt = this.buildIntelligentImagePrompt(keyword, articleContent, colorPalette);
    const filename = this.generateSEOFilename(keyword, templateType);

    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🎨 Generating abstract image (attempt ${attempt}/${this.maxRetries})...`);
        console.log(`   Target: ${this.imageWidth}x${this.imageHeight}px (${this.aspectRatio} landscape)`);
        
        const filePath = await this.generateImageFromPrompt(prompt, filename);
        
        console.log("☁️  Uploading to Ghost...");
        const ghostUrl = await this.uploadToGhostWithRetry(filePath);

        // Generate intelligent alt text based on actual image concept
        const altText = await this.generateIntelligentAltText(keyword, articleContent, colorPalette);

        return {
          filename,
          path: filePath,
          url: ghostUrl,
          altText: altText,
          provider: "gemini-abstract",
          colorPalette: colorPalette.mood,
          dimensions: `${this.imageWidth}x${this.imageHeight}`
        };
        
      } catch (error) {
        lastError = error;
        console.error(`⚠️  Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          console.log(`⏳ Retrying in ${delay/1000} seconds...`);
          await this.sleep(delay);
        }
      }
    }

    console.error(`❌ All ${this.maxRetries} image generation attempts failed`);
    console.error(`Last error: ${lastError.message}`);
    
    return this.getFallback(keyword, templateType);
  }

  /**
   * Build intelligent image prompt based on article content
   */
  buildIntelligentImagePrompt(keyword, articleContent, colorPalette) {
    // Extract article essence if content provided
    let articleEssence = '';
    if (articleContent) {
      const textContent = articleContent.replace(/<[^>]*>/g, ' ').substring(0, 1500);
      articleEssence = `\n**Article Context** (use this to inform the visual concept):\n${textContent}\n`;
    }

    return `
Create a professional abstract business illustration for a B2B article.

**Article Topic**: ${keyword}
${articleEssence}

=============================================================================
CRITICAL IMAGE SPECIFICATIONS
=============================================================================

**Dimensions** (NON-NEGOTIABLE):
- Width: EXACTLY 1200 pixels
- Height: EXACTLY 675 pixels  
- Aspect Ratio: 16:9 landscape (horizontal orientation MANDATORY)
- The image MUST be wider than it is tall

**Format Requirements**:
- High-resolution PNG
- Professional editorial quality
- Optimized for web display
- Sharp, clean rendering

=============================================================================
VISUAL CONCEPT GUIDELINES
=============================================================================

**Style Direction**:
Create an abstract visual representation that captures the essence of "${keyword}".

${this.getVisualConceptGuidance(keyword)}

**Color Palette**:
- Background: ${colorPalette.background}
- Primary Elements: ${colorPalette.primary}
- Accent Details: ${colorPalette.accent}
- Overall Mood: ${colorPalette.mood}

**Composition**:
- Landscape orientation (16:9 ratio) - MANDATORY
- Main visual elements occupy 40-50% of frame
- Balanced composition with clear visual hierarchy
- Professional depth and dimension
- Clean background that doesn't compete with content
- Modern, sophisticated aesthetic
- Suitable for B2B business context

**Abstract Elements**:
Based on the topic "${keyword}", choose appropriate abstract forms:
- For technology/digital topics: geometric shapes, data visualization, network patterns, flowing lines
- For growth/performance topics: upward curves, expanding forms, dynamic movement
- For strategy/planning topics: structured layers, pathways, directional elements
- For innovation/future topics: emerging patterns, breakthrough compositions, horizon perspectives
- For partnership/collaboration topics: connecting elements, unified networks, collaborative patterns

Let the AI intelligently select shapes and forms that best represent the conceptual essence.

**Content Restrictions**:
- NO people, faces, or human figures
- NO text, letters, words, or numbers
- NO photographic or realistic elements
- Pure abstract visual representation
- Professional business illustration style

=============================================================================
TECHNICAL EXECUTION
=============================================================================

**Quality Standards**:
- Professional editorial illustration quality
- Clean, sharp rendering
- Even, professional lighting
- High contrast where appropriate
- Gradient transitions should be smooth
- No artifacts or noise

**Mandatory Output**:
- 1200px × 675px (16:9 landscape)
- PNG format
- Abstract business illustration
- Professional and polished appearance

Generate a visually striking abstract illustration that emotionally and conceptually represents the article topic while maintaining professional sophistication.
`.trim();
  }

  /**
   * Get visual concept guidance based on topic
   */
  getVisualConceptGuidance(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    const styles = visualStyles.compositionStyles;
    
    // Match composition style to topic keywords
    for (const [theme, guidance] of Object.entries(styles)) {
      if (lowerKeyword.includes(theme)) {
        return `**Suggested Visual Approach**: ${guidance}`;
      }
    }
    
    // Intelligent fallback based on common B2B themes
    if (lowerKeyword.match(/digital|technology|tech|ai|automation|software|saas/)) {
      return `**Suggested Visual Approach**: ${styles.connectivity} or ${styles.innovation}`;
    }
    if (lowerKeyword.match(/growth|revenue|performance|sales|market/)) {
      return `**Suggested Visual Approach**: ${styles.growth} or ${styles.performance}`;
    }
    if (lowerKeyword.match(/strategy|framework|planning|operational/)) {
      return `**Suggested Visual Approach**: ${styles.strategy}`;
    }
    if (lowerKeyword.match(/future|vision|outlook|trend|emerging/)) {
      return `**Suggested Visual Approach**: ${styles.future} or ${styles.innovation}`;
    }
    if (lowerKeyword.match(/partner|collaboration|ecosystem|network/)) {
      return `**Suggested Visual Approach**: ${styles.partnership}`;
    }
    
    // Generic fallback
    return `**Suggested Visual Approach**: Create abstract forms that conceptually represent the essence of this business topic. Use geometric or organic shapes, flowing lines, or structured patterns as appropriate.`;
  }

  /**
   * Select appropriate color palette
   */
  selectColorPalette(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    const palettes = visualStyles.colorPalettes;
    
    // Match palette to topic theme
    if (lowerKeyword.match(/digital|technology|tech|software|saas/)) {
      return palettes.techForward;
    }
    if (lowerKeyword.match(/data|analytics|intelligence|ai/)) {
      return palettes.analytical;
    }
    if (lowerKeyword.match(/growth|future|vision|optimiz/)) {
      return palettes.optimistic;
    }
    if (lowerKeyword.match(/strategy|framework|planning/)) {
      return palettes.strategic;
    }
    if (lowerKeyword.match(/innovation|emerging|disruption/)) {
      return palettes.innovative;
    }
    if (lowerKeyword.match(/transform|change|evolution/)) {
      return palettes.dynamic;
    }
    if (lowerKeyword.match(/premium|executive|leadership/)) {
      return palettes.premium;
    }
    if (lowerKeyword.match(/insight|clarity|understanding/)) {
      return palettes.clarity;
    }
    if (lowerKeyword.match(/essential|core|fundamental/)) {
      return palettes.minimalist;
    }
    
    // Random selection from appropriate palettes for variety
    const generalPalettes = [
      palettes.techForward,
      palettes.strategic,
      palettes.optimistic,
      palettes.innovative
    ];
    
    return generalPalettes[Math.floor(Math.random() * generalPalettes.length)];
  }

  /**
   * Generate intelligent alt text based on visual concept and keywords
   */
  async generateIntelligentAltText(keyword, articleContent, colorPalette) {
    // Extract key concepts from article if available
    let contextHint = '';
    if (articleContent) {
      const text = articleContent.replace(/<[^>]*>/g, ' ').substring(0, 500);
      contextHint = `\nArticle context: ${text}`;
    }

    const altPrompt = `
Create a concise alt text (under 125 characters) for an abstract business illustration.

Topic: ${keyword}
Visual Style: Abstract ${colorPalette.mood} composition
${contextHint}

The alt text should:
- Describe the visual elements abstractly (e.g., "geometric network pattern", "flowing gradient curves")
- Include the topic keyword naturally
- Be under 125 characters
- Be accessible and descriptive

Examples:
- "Abstract data visualization with flowing blue network patterns representing digital transformation"
- "Geometric shapes in vibrant gradients illustrating B2B growth strategies"  
- "Minimalist illustration with radiating lines symbolizing innovation and breakthrough"

Return ONLY the alt text, no quotes or explanations.
`.trim();

    try {
      const result = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: "user", parts: [{ text: altPrompt }] }],
      });

      let altText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      altText = altText.replace(/^["']|["']$/g, '');
      
      // Ensure length
      if (altText.length > 125) {
        altText = altText.substring(0, 122) + '...';
      }
      
      // Fallback if generation failed
      if (altText.length < 10) {
        altText = `Abstract ${colorPalette.mood} illustration representing ${keyword}`;
      }
      
      return altText.substring(0, 125);
    } catch (error) {
      console.error('Alt text generation failed:', error.message);
      return `Abstract business illustration representing ${keyword}`.substring(0, 125);
    }
  }

  /**
   * Generate SEO-friendly filename
   */
  generateSEOFilename(keyword, templateType) {
    const slug = keyword
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 50);

    return `${slug}-featured-${Date.now()}.png`;
  }

  /**
   * Call Gemini API to generate image
   */
  async generateImageFromPrompt(prompt, filename) {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("No image generated by Gemini AI");
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, "base64");
        const outPath = path.join(this.imageDir, filename);
        fs.writeFileSync(outPath, buffer);
        
        console.log("✅ Abstract image generated:", filename);
        console.log(`   Dimensions: ${this.imageWidth}x${this.imageHeight}px`);
        
        return outPath;
      }
    }

    throw new Error("No image data in Gemini response");
  }

  /**
   * Upload image to Ghost with retry logic
   */
  async uploadToGhostWithRetry(filePath) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.ghost.images.upload({ file: filePath });
        console.log("✅ Uploaded to Ghost:", result.url);
        return result.url;
        
      } catch (error) {
        lastError = error;
        console.error(`⚠️  Ghost upload attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          console.log(`⏳ Retrying upload in ${delay/1000} seconds...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw new Error(`Ghost upload failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Fallback when image generation fails
   */
  getFallback(keyword, templateType) {
    console.log("📷 Using fallback (no image)");
    return {
      filename: null,
      path: null,
      url: null,
      altText: `Abstract illustration representing ${keyword}`.substring(0, 125),
      provider: "fallback",
      note: "Image generation failed after all retries",
    };
  }

  /**
   * Cleanup old images
   */
  cleanupOldImages(daysOld = 7) {
    try {
      const files = fs.readdirSync(this.imageDir);
      const now = Date.now();
      const maxAge = daysOld * 24 * 60 * 60 * 1000;
      
      let deletedCount = 0;
      
      files.forEach(file => {
        const filePath = path.join(this.imageDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;
        
        if (age > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      
      console.log(`🗑️  Cleaned up ${deletedCount} old image(s)`);
      return deletedCount;
      
    } catch (error) {
      console.error('Failed to cleanup images:', error.message);
      return 0;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test image generation
   */
  async testConnection() {
    try {
      console.log("🧪 Testing abstract image generation...");
      console.log(`   Target: ${this.imageWidth}x${this.imageHeight}px (${this.aspectRatio} landscape)`);
      
      const result = await this.generateFeaturedImage(
        "Digital Transformation in B2B Marketing",
        "Strategic Framework",
        "Dr. Anya Sharma",
        "<p>Digital transformation is reshaping how B2B companies approach marketing in APAC markets...</p>"
      );
      
      if (result.url) {
        console.log("✅ Test completed successfully!");
        console.log("   Image URL:", result.url);
        console.log("   Dimensions:", result.dimensions);
      } else {
        console.log("⚠️  Test completed with fallback (no image)");
      }
      
      return true;
    } catch (err) {
      console.error("❌ Test failed:", err.message);
      return false;
    }
  }
}

module.exports = ImageGenerator;