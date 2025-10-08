// src/services/imageGenerator.js - Enhanced with retry logic
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
          style: style.name
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
        name: 'geometric',
        description: '3D geometric shapes (cubes, spheres, pyramids), floating or intersecting, sharp clean lines',
        colors: 'vibrant orange, yellow, teal accents on dark navy background'
      },
      {
        name: 'particle-field',
        description: 'thousands of small glowing particles forming patterns, constellation-like connections',
        colors: 'purple, pink, blue gradients on black background'
      },
      {
        name: 'fluid-dynamics',
        description: 'liquid paint swirls, marble ink patterns, organic flowing shapes',
        colors: 'emerald green, gold, cream on light grey background'
      },
      {
        name: 'wireframe',
        description: 'technical wireframe grids, architectural line drawings, schematic diagrams',
        colors: 'cyan, white lines on dark background'
      },
      {
        name: 'gradient-waves',
        description: 'smooth gradient color waves, rolling hills of color, soft transitions',
        colors: 'coral, peach, lavender gradient on white background'
      },
      {
        name: 'crystalline',
        description: 'crystal structures, faceted gem-like forms, prismatic reflections',
        colors: 'ice blue, silver, white on grey background'
      },
      {
        name: 'data-viz',
        description: 'abstract charts, flowing data streams, infographic-style patterns',
        colors: 'red, blue, yellow on white background'
      },
      {
        name: 'light-rays',
        description: 'beams of light, lens flares, radial light patterns, luminous trails',
        colors: 'golden yellow, warm orange on dark teal background'
      },
      {
        name: 'topographic',
        description: 'contour lines, elevation maps, topographical patterns, layered rings',
        colors: 'forest green, brown, tan on cream background'
      },
      {
        name: 'minimal-shapes',
        description: 'simple bold shapes (circles, squares, triangles), minimal composition, lots of negative space',
        colors: 'black, bright red accent on white background'
      }
    ];
  }

  /**
   * Build prompt for DIVERSE abstract images
   */
  buildAbstractImagePrompt(keyword, templateType, style) {
    const baseRequirements = `
CRITICAL REQUIREMENTS:
- NO people, faces, or human figures
- NO realistic objects or scenes  
- NO text, words, or letters anywhere
- Only pure abstract visual representation
- Professional editorial style
- Single clear subject or pattern
- High quality photorealistic rendering

Style: ${style.description}
Color scheme: ${style.colors}
Mood: Professional, modern, corporate editorial
Composition: Clean, balanced, visually striking

Abstract concept representing: ${keyword}
Visual metaphor: ${this.getVisualMetaphor(keyword)}
Template guidance: ${this.getTemplateVisualGuidance(templateType)}
`;

    return baseRequirements;
  }

  getVisualMetaphor(keyword) {
    const metaphors = {
      'transformation': 'metamorphosis, evolution, change in form',
      'growth': 'expansion, ascending forms, upward movement',
      'strategy': 'chess pieces, pathways, decision trees',
      'data': 'networks, connections, information flow',
      'innovation': 'breakthrough, emergence, new forms',
      'performance': 'acceleration, momentum, dynamic motion',
      'leadership': 'guiding light, central focal point, direction',
      'market': 'ecosystem, landscape, terrain',
      'value': 'gems, treasure, concentrated energy',
      'customer': 'journey, pathways, experience flow',
      'digital': 'circuits, bytes, binary patterns',
      'competitive': 'contrast, differentiation, standing out',
      'operational': 'machinery, precision, efficiency',
      'excellence': 'perfection, ideal form, pinnacle',
      'sustainable': 'cycles, renewal, continuous flow',
      'retention': 'bonds, connections, holding together',
      'pricing': 'scales, balance, value exchange',
      'segmentation': 'divisions, categories, distinct groups',
      'revenue': 'streams, flowing abundance, growth curves',
      'culture': 'organic networks, living systems',
      'analytics': 'patterns, insights, clarity emerging',
      'journey': 'pathways, progression, milestones',
      'positioning': 'elevation, standing out, prominence',
      'productivity': 'efficiency, streamlined flow, optimization',
      'roi': 'returns, cycles, value multiplication'
    };

    for (const [key, metaphor] of Object.entries(metaphors)) {
      if (keyword.toLowerCase().includes(key)) {
        return metaphor;
      }
    }

    return 'abstract business concept, strategic thinking, professional insight';
  }

  getTemplateVisualGuidance(templateType) {
    const guidance = {
      'Strategic Framework': 'structured geometric patterns, layered frameworks, architectural abstractions',
      'Case Study Analysis': 'analytical abstract forms, data flow patterns, insights visualization',
      'Vision & Outlook': 'forward-moving abstract shapes, horizon-like compositions, future-oriented patterns',
      'How-To / Playbook': 'step-like abstract progressions, methodical pattern flows, process abstractions'
    };

    return guidance[templateType] || 'professional abstract business visualization';
  }

  /**
   * Generate SEO-optimised filename
   */
  generateSEOFilename(keyword, templateType) {
    const slug = keyword
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 40);

    const templateSlug = templateType
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 20);

    return `${slug}-${templateSlug}-${Date.now()}.png`;
  }

  /**
   * Generate keyword-rich alt text (SEO optimised)
   */
  generateSEOAltText(keyword, templateType) {
    return `Abstract visualization representing ${keyword} for ${templateType} - B2B marketing insights by Ignition Studio`;
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
        console.log("✅ Abstract image saved:", filename);
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
      const result = await this.generateFeaturedImage(
        "Data-Driven Decision Making in Marketing",
        "Strategic Framework",
        "Dr. Anya Sharma"
      );
      
      if (result.url) {
        console.log("✅ Test completed successfully!");
        console.log("   Image URL:", result.url);
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