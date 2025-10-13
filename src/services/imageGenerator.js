// src/services/imageGenerator.js - Enhanced with proper image dimensions
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const GhostAdminAPI = require("@tryghost/admin-api");
require("dotenv").config();

class ImageGenerator {
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    this.model = "gemini-2.5-flash-image-preview";
    this.maxRetries = 3;
    this.retryDelay = 5000;
    
    // Ghost CMS optimal dimensions
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
    
    // Track used styles for variety
    this.styleHistoryFile = path.join(process.cwd(), "generated", "image-style-history.json");
    this.ensureStyleHistory();
  }

  ensureStyleHistory() {
    if (!fs.existsSync(this.styleHistoryFile)) {
      fs.writeFileSync(this.styleHistoryFile, JSON.stringify({ recentStyles: [] }));
    }
  }

  loadStyleHistory() {
    try {
      const data = fs.readFileSync(this.styleHistoryFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return { recentStyles: [] };
    }
  }

  saveStyleHistory(history) {
    try {
      fs.writeFileSync(this.styleHistoryFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Failed to save style history:', error.message);
    }
  }

  /**
   * Generate abstract featured image with retry logic
   */
  async generateFeaturedImage(keyword, templateType, persona) {
    const style = this.selectUnusedStyle();
    const prompt = this.buildAbstractImagePrompt(keyword, templateType, style);
    const filename = this.generateSEOFilename(keyword, templateType);

    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🎨 Generating image (attempt ${attempt}/${this.maxRetries})...`);
        console.log(`   Target size: ${this.imageWidth}x${this.imageHeight}px (${this.aspectRatio} landscape)`);
        
        const filePath = await this.generateImageFromPrompt(prompt, filename);
        
        console.log("☁️  Uploading to Ghost...");
        const ghostUrl = await this.uploadToGhostWithRetry(filePath);

        // Record used style
        this.recordUsedStyle(style.name);

        return {
          filename,
          path: filePath,
          url: ghostUrl,
          altText: this.generateSEOAltText(keyword, templateType),
          provider: "gemini-abstract",
          style: style.name,
          dimensions: `${this.imageWidth}x${this.imageHeight}`
        };
        
      } catch (error) {
        lastError = error;
        console.error(`⚠️  Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          console.log(`⏳ Retrying in ${delay/1000} seconds...`);
          await this.sleep(delay);
        }
      }
    }

    console.error(`❌ All ${this.maxRetries} image generation attempts failed`);
    console.error(`Last error: ${lastError.message}`);
    
    // Return fallback
    return this.getFallback(keyword, templateType);
  }

  /**
   * Select a style that hasn't been used recently
   */
  selectUnusedStyle() {
    const visualStyles = this.getAllVisualStyles();
    const history = this.loadStyleHistory();
    const recentStyles = history.recentStyles || [];

    // Filter out recently used styles
    const availableStyles = visualStyles.filter(s => !recentStyles.includes(s.name));
    
    if (availableStyles.length > 0) {
      return availableStyles[Math.floor(Math.random() * availableStyles.length)];
    }
    
    // All styles used, reset and pick random
    console.log('🔄 All image styles used, resetting history');
    this.saveStyleHistory({ recentStyles: [] });
    return visualStyles[Math.floor(Math.random() * visualStyles.length)];
  }

  recordUsedStyle(styleName) {
    const history = this.loadStyleHistory();
    const recentStyles = history.recentStyles || [];
    
    // Add to front, remove if already exists
    const updated = [styleName, ...recentStyles.filter(s => s !== styleName)];
    
    // Keep last 5 styles
    const trimmed = updated.slice(0, 5);
    
    this.saveStyleHistory({ recentStyles: trimmed });
  }

  getAllVisualStyles() {
    return [
      {
        name: 'geometric-modern',
        description: 'Clean 3D geometric shapes (cubes, spheres, cylinders) with modern lighting, professional depth',
        colors: 'vibrant blue, orange, teal accents on dark navy background',
        mood: 'professional, modern, technology-forward'
      },
      {
        name: 'data-visualization',
        description: 'Abstract data streams, flowing information patterns, network nodes, connectivity visualization',
        colors: 'cyan, electric blue, white on dark background',
        mood: 'analytical, intelligent, data-driven'
      },
      {
        name: 'gradient-landscape',
        description: 'Smooth gradient waves forming abstract landscape, rolling color transitions, horizon perspective',
        colors: 'coral pink, peach, lavender gradient on soft background',
        mood: 'optimistic, forward-looking, strategic'
      },
      {
        name: 'architectural-wireframe',
        description: 'Technical blueprint lines, architectural wireframe structures, clean technical diagrams',
        colors: 'white and cyan lines on dark blue/black background',
        mood: 'structured, strategic, framework-focused'
      },
      {
        name: 'particle-network',
        description: 'Glowing particles connected by light trails, constellation-like network patterns',
        colors: 'purple, magenta, blue on black background',
        mood: 'connected, innovative, future-forward'
      },
      {
        name: 'fluid-organic',
        description: 'Liquid paint swirls, organic flowing shapes, smooth color transitions like ink in water',
        colors: 'emerald green, gold, cream on light grey',
        mood: 'dynamic, transformative, flowing'
      },
      {
        name: 'crystalline-structure',
        description: 'Faceted crystal forms, prismatic geometric structures, gem-like reflective surfaces',
        colors: 'ice blue, silver, white with subtle color reflections',
        mood: 'premium, refined, high-value'
      },
      {
        name: 'topographic-contour',
        description: 'Topographical contour lines, elevation maps, layered terrain visualization',
        colors: 'forest green, brown, tan on cream background',
        mood: 'strategic, mapping, navigational'
      },
      {
        name: 'light-beam-radial',
        description: 'Radial light beams, lens flares, luminous rays emanating from center',
        colors: 'golden yellow, warm orange on dark teal',
        mood: 'enlightening, clarity, breakthrough'
      },
      {
        name: 'minimalist-bold',
        description: 'Simple bold geometric shapes with lots of negative space, minimal composition',
        colors: 'black shapes with one bright accent color on white',
        mood: 'clean, decisive, impactful'
      }
    ];
  }

  /**
   * Build prompt for topic-relevant abstract images with EXACT dimensions
   */
  buildAbstractImagePrompt(keyword, templateType, style) {
    // Extract topic essence for visual connection
    const topicEssence = this.extractTopicEssence(keyword);
    const regionalContext = this.getRegionalVisualContext(keyword);
    
    const baseRequirements = `
CRITICAL IMAGE REQUIREMENTS:

**DIMENSIONS (MUST BE EXACT):**
- Width: EXACTLY 1200 pixels
- Height: EXACTLY 675 pixels
- Aspect Ratio: 16:9 (landscape/horizontal orientation)
- This is for Ghost CMS featured images - dimensions MUST be precise
- NEVER create portrait or square images - ONLY 16:9 landscape

**CONTENT RESTRICTIONS:**
- NO people, faces, or human figures
- NO realistic objects, buildings, or recognizable landmarks  
- NO text, words, letters, or numbers anywhere in the image
- Only pure abstract visual representation
- Professional editorial photography style
- High quality photorealistic rendering

**VISUAL STYLE:** ${style.description}
**COLOR PALETTE:** ${style.colors}
**MOOD:** ${style.mood}

**TOPIC CONNECTION (Abstract Representation):**
Main Topic: ${keyword}
Visual Essence: ${topicEssence}
Regional Context: ${regionalContext}
Template Type: ${this.getTemplateVisualGuidance(templateType)}

**COMPOSITION RULES:**
- Landscape orientation (wider than tall) - 16:9 ratio MANDATORY
- Main subject occupies 60-70% of frame
- Balanced composition with clear focal point
- Professional depth and dimension
- Clean, uncluttered background
- Modern, contemporary aesthetic
- Suitable for business/professional context
- Optimized for web display (1200x675px)

**TECHNICAL SPECIFICATIONS:**
- Exact dimensions: 1200px wide × 675px tall
- Aspect ratio: 16:9 landscape (horizontal)
- Style: Abstract editorial photography
- Lighting: Professional, even illumination
- Quality: High resolution, sharp details
- Format: PNG, optimized for web
- File size: Suitable for fast web loading

CRITICAL: The image MUST be landscape (horizontal) format. A 1200x675px rectangle is WIDER than it is tall.

Create an abstract visual that EMOTIONALLY represents the topic essence while maintaining professional sophistication in a 16:9 landscape format.
`;

    return baseRequirements;
  }

  /**
   * Extract visual essence from topic keyword
   */
  extractTopicEssence(keyword) {
    const essenceMap = {
      'transformation': 'evolution, metamorphosis, transition from old to new state',
      'digital': 'connectivity, data flow, technological integration',
      'growth': 'upward movement, expansion, ascending momentum',
      'strategy': 'pathways, direction, calculated movement',
      'customer': 'journey, experience flow, connection points',
      'retention': 'bonds, holding together, continuity',
      'pricing': 'value scales, balance, exchange',
      'market': 'landscape, terrain, positioning',
      'innovation': 'breakthrough, emergence, new formations',
      'leadership': 'guidance, direction, forward momentum',
      'data': 'information streams, patterns, insights',
      'performance': 'acceleration, optimization, efficiency',
      'revenue': 'growth curves, flowing abundance',
      'competitive': 'differentiation, standing out, elevation',
      'operational': 'precision, systems, synchronized flow',
      'partnership': 'connection, collaboration, network',
      'talent': 'potential, capability, human capital',
      'sustainability': 'cycles, renewal, continuous flow',
      'ai': 'intelligence, neural patterns, cognitive networks',
      'automation': 'efficiency, streamlined processes, smart systems',
      'singapore': 'modern hub, innovation center, strategic gateway',
      'apac': 'regional connectivity, diverse markets, growth dynamics',
      'sea': 'emerging opportunities, dynamic change, regional integration',
      'smb': 'agility, growth potential, entrepreneurial energy',
      'fintech': 'financial innovation, digital transformation, future banking',
      'saas': 'cloud connectivity, scalable platforms, modern software',
      'retail': 'commerce flow, shopping experience, consumer journey',
      'omnichannel': 'seamless integration, unified experience, channel harmony'
    };

    // Find matching keywords
    for (const [key, essence] of Object.entries(essenceMap)) {
      if (keyword.toLowerCase().includes(key)) {
        return essence;
      }
    }

    return 'strategic business concept, professional insight, forward momentum';
  }

  /**
   * Get regional visual context
   */
  getRegionalVisualContext(keyword) {
    if (keyword.toLowerCase().includes('singapore')) {
      return 'modern, tech-forward, precision-focused, hub mentality';
    }
    if (keyword.toLowerCase().includes('apac') || keyword.toLowerCase().includes('asia')) {
      return 'dynamic, diverse, interconnected, growth-oriented';
    }
    if (keyword.toLowerCase().includes('sea') || keyword.toLowerCase().includes('southeast')) {
      return 'emerging, energetic, opportunity-rich, transformative';
    }
    return 'global yet locally relevant, professional, contemporary';
  }

  getTemplateVisualGuidance(templateType) {
    const guidance = {
      'Strategic Framework': 'structured layers, architectural forms, framework visualization',
      'Case Study Analysis': 'transformation journey, before-after contrast, process flow',
      'Vision & Outlook': 'horizon perspective, forward movement, future-oriented composition',
      'Point of View (POV)': 'bold statement, contrarian angle, distinctive perspective',
      'How-To / Playbook': 'step progression, methodical flow, clear pathway',
      'Expert Q&A': 'dialogue visualization, knowledge exchange, insight sharing'
    };

    return guidance[templateType] || 'professional business visualization';
  }

  /**
   * Generate SEO-optimised filename
   */
  generateSEOFilename(keyword, templateType) {
    const slug = keyword
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 50);

    const templateSlug = templateType
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 20);

    return `${slug}-${templateSlug}-${Date.now()}.png`;
  }

  /**
   * Generate keyword-rich alt text (SEO optimised, under 125 chars)
   */
  generateSEOAltText(keyword, templateType) {
    // Keep under 125 characters for SEO best practices
    const baseAlt = `${keyword} - ${templateType} insights`;
    
    if (baseAlt.length > 120) {
      // Truncate keyword if too long
      const maxKeywordLength = 100 - templateType.length;
      const truncatedKeyword = keyword.substring(0, maxKeywordLength);
      return `${truncatedKeyword} - ${templateType}`;
    }
    
    return baseAlt;
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
      throw new Error("No candidates returned by Gemini");
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, "base64");
        const outPath = path.join(this.imageDir, filename);
        fs.writeFileSync(outPath, buffer);
        
        // Log image details
        console.log("✅ Abstract image saved:", filename);
        console.log(`   Expected dimensions: ${this.imageWidth}x${this.imageHeight}px`);
        
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
      altText: this.generateSEOAltText(keyword, templateType),
      provider: "fallback",
      note: "Image generation failed after all retries - post will be created without featured image",
    };
  }

  /**
   * Cleanup old/failed images
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
        "Singapore SMB Digital Transformation Strategies",
        "Strategic Framework",
        "Dr. Anya Sharma"
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