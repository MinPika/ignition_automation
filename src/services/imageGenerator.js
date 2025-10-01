// src/services/imageGenerator.js
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
   * Generate abstract featured image (McKinsey/GitHub Insights style)
   */
  async generateFeaturedImage(keyword, templateType, persona) {
    const prompt = this.buildAbstractImagePrompt(keyword, templateType);
    const filename = this.generateSEOFilename(keyword, templateType);

    try {
      console.log(`🎨 Generating abstract image for ${keyword}...`);
      const filePath = await this.generateImageFromPrompt(prompt, filename);

      console.log("☁️  Uploading to Ghost...");
      const ghostUrl = await this.uploadToGhost(filePath);

      return {
        filename,
        path: filePath,
        url: ghostUrl,
        altText: this.generateSEOAltText(keyword, templateType),
        provider: "gemini-abstract",
      };
    } catch (err) {
      console.error("⚠️  Image generation failed:", err.message);
      return this.getFallback(keyword, templateType);
    }
  }

  /**
   * Build prompt for DIVERSE abstract images
   * Multiple visual styles, colors, and compositions
   */
  buildAbstractImagePrompt(keyword, templateType) {
    // Randomly select visual style for variety
    const visualStyles = [
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

    // Randomly select a style
    const style = visualStyles[Math.floor(Math.random() * visualStyles.length)];

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
`;

    return baseRequirements;
  }

  getVisualMetaphor(keyword) {
    // Generate visual metaphor based on keyword content
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
      'sustainable': 'cycles, renewal, continuous flow'
    };

    // Find relevant metaphor
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

    return `${slug}-${templateSlug}-abstract-${Date.now()}.png`;
  }

  /**
   * Generate keyword-rich alt text (SEO optimised)
   */
  generateSEOAltText(keyword, templateType) {
    return `Abstract visualisation representing ${keyword} for ${templateType} - B2B marketing insights`;
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
    if (!candidate) throw new Error("No candidates returned by Gemini");

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
   * Upload image to Ghost
   */
  async uploadToGhost(filePath) {
    try {
      // Ghost Admin API expects file path as string, not stream
      const result = await this.ghost.images.upload({ file: filePath });
      console.log("✅ Uploaded to Ghost:", result.url);
      return result.url;
    } catch (err) {
      console.error("❌ Ghost upload failed:", err.message);
      throw err;
    }
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
      note: "No image generated - please add abstract image manually in Ghost editor",
    };
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
      console.log("✅ Test completed:", result);
      return true;
    } catch (err) {
      console.error("❌ Test failed:", err.message);
      return false;
    }
  }
}

module.exports = ImageGenerator;