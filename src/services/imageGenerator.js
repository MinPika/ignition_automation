// src/services/imageGenerator.js
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const GhostAdminAPI = require("@tryghost/admin-api");
require("dotenv").config();

class ImageGenerator {
  constructor() {
    // Google Gemini client
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    this.model = "gemini-2.5-flash-image-preview";

    // Local image dir
    this.imageDir = path.join(process.cwd(), "generated/images");
    if (!fs.existsSync(this.imageDir)) {
      fs.mkdirSync(this.imageDir, { recursive: true });
    }

    // Ghost API client
    this.ghost = new GhostAdminAPI({
      url: process.env.GHOST_API_URL,
      key: process.env.GHOST_ADMIN_API_KEY,
      version: "v5.0",
    });
  }

  /**
   * Main method: generate and upload image
   */
  async generateFeaturedImage(keyword, templateType, persona) {
    const prompt = this.buildImagePrompt(keyword, templateType, persona);
    const filename = this.generateFilename(keyword, templateType);

    try {
      console.log(`🎨 Generating image with ${this.model}…`);
      const filePath = await this.generateImageFromPrompt(prompt, filename);

      console.log("☁️ Uploading image to Ghost as Featured Image…");
      const ghostUrl = await this.uploadToGhost(filePath);

      return {
        filename,
        path: filePath,
        url: ghostUrl,
        altText: this.generateAltText(keyword, templateType),
        provider: "gemini",
      };
    } catch (err) {
      console.error("⚠️ Image generation failed:", err.message);
      return this.getFallback(keyword, templateType);
    }
  }

  /**
   * Call Gemini API to generate an image
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
        console.log("✅ Gemini image saved:", outPath);
        return outPath;
      }
    }

    throw new Error("No inlineData (image) found in Gemini response");
  }

  /**
   * Upload the generated image into Ghost
   */
  async uploadToGhost(filePath) {
    try {
      const fileStream = fs.createReadStream(filePath);
      const result = await this.ghost.images.upload({ file: fileStream });
      console.log("✅ Uploaded to Ghost:", result.url);
      return result.url;
    } catch (err) {
      console.error("❌ Ghost upload failed:", err.message);
      throw err;
    }
  }

  /**
   * Text-only fallback
   */
  getFallback(keyword, templateType) {
    console.log("📷 Using fallback (no image)");
    return {
      filename: null,
      path: null,
      url: null,
      altText: this.generateAltText(keyword, templateType),
      provider: "fallback",
      note: "No image generated, please add manually in Ghost editor",
    };
  }

  /**
   * Utility: build prompt
   */
  buildImagePrompt(keyword, templateType, persona) {
    const baseStyle =
      "professional editorial illustration, corporate theme, clean minimal design, muted colors, modern B2B marketing atmosphere";

    const templatePrompts = {
      "Strategic Framework":
        "business consultant reviewing strategic diagrams and frameworks",
      "Case Study Analysis":
        "professional analyzing documents with graphs and metrics in background",
      "Vision & Outlook":
        "futuristic leader overlooking cityscape, innovation symbols, growth theme",
      "How-To / Playbook":
        "consultant demonstrating a step-by-step process visually",
    };

    const personaPrompts = {
      "Rajiv Wijaya":
        "human-centered, storytelling vibe, collaborative setting",
      "Dr. Anya Sharma":
        "analytical, structured data-driven office atmosphere",
      "Linh Nguyen":
        "futuristic tech-forward environment, AI innovation motifs",
    };

    return `${templatePrompts[templateType] || "business professional"}, ${
      personaPrompts[persona] || "neutral consultant style"
    }, ${baseStyle}, related to ${keyword}, high-quality photorealistic image`;
  }

  /**
   * Utility: filename
   */
  generateFilename(keyword, templateType) {
    const slug = keyword
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 40);

    const templateSlug = templateType
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    return `${slug}-${templateSlug}-${Date.now()}.png`;
  }

  /**
   * Utility: alt text
   */
  generateAltText(keyword, templateType) {
    return `Illustration of ${keyword} in ${templateType} context for B2B marketing`;
  }

  /**
   * Test method
   */
  async testConnection() {
    try {
      const result = await this.generateFeaturedImage(
        "Nano Banana Strategy",
        "Vision & Outlook",
        "Linh Nguyen"
      );
      console.log("✅ Test completed:", result);
    } catch (err) {
      console.error("❌ Test failed:", err.message);
    }
  }
}

module.exports = ImageGenerator;
