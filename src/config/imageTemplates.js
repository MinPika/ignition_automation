const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class ImageGenerator {
  constructor() {
    this.hfApiKey = process.env.HUGGINGFACE_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.imageDir = path.join(__dirname, '../../generated/images');
    fs.ensureDirSync(this.imageDir);
  }

  async generateFeaturedImage(keyword, templateType, persona) {
    const prompt = this.buildImagePrompt(keyword, templateType, persona);
    const filename = this.generateFilename(keyword, templateType);
    
    // Try Hugging Face first (free and reliable)
    try {
      console.log('🎨 Generating image with Hugging Face...');
      return await this.generateWithHuggingFace(prompt, filename, keyword, templateType);
    } catch (error) {
      console.log('⚠️ Hugging Face failed:', error.message);
      
      // Fallback to text description for Ghost
      return this.getFallbackImage(filename, keyword, templateType);
    }
  }

  async generateWithHuggingFace(prompt, filename, keyword, templateType) {
    // Using FLUX.1 as it's one of the best free models
    const modelUrl = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev';
    
    const response = await axios({
      method: 'POST',
      url: modelUrl,
      headers: {
        'Authorization': `Bearer ${this.hfApiKey}`,
        'Content-Type': 'application/json'
      },
      data: { 
        inputs: prompt,
        parameters: {
          guidance_scale: 7.5,
          num_inference_steps: 28,
          width: 1024,
          height: 768
        }
      },
      responseType: 'arraybuffer',
      timeout: 90000 // FLUX can take longer
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const imagePath = path.join(this.imageDir, filename);
    await fs.writeFile(imagePath, Buffer.from(response.data));
    
    console.log('✅ Image generated with FLUX.1:', filename);
    
    return {
      filename: filename,
      path: imagePath,
      altText: this.generateAltText(keyword, templateType),
      provider: 'huggingface-flux',
      uploadPath: imagePath // Ghost can use this later
    };
  }

  // Future: Gemini image generation (when available)
  async generateWithGemini(prompt, filename, keyword, templateType) {
    // Note: Gemini's image generation might be limited or require different API
    // This is a placeholder for future implementation
    console.log('🔮 Gemini image generation not yet implemented');
    throw new Error('Gemini image generation not available');
  }

  getFallbackImage(filename, keyword, templateType) {
    console.log('📷 Using text-only fallback');
    return {
      filename: `text-only-${filename}`,
      path: null,
      altText: this.generateAltText(keyword, templateType),
      provider: 'fallback',
      note: 'Text-only post - add featured image manually in Ghost editor'
    };
  }

  buildImagePrompt(keyword, templateType, persona) {
    const baseStyle = "professional editorial illustration, corporate business theme, clean minimalist design, muted color palette, single person maximum, modern office environment";
    
    const templatePrompts = {
      'Strategic Framework': 'business professional analyzing strategic data on digital screens, charts and frameworks visible',
      'Case Study Analysis': 'businessperson reviewing case study documents with success metrics and graphs in background',
      'Vision & Outlook': 'professional looking toward future cityscape, innovation and growth symbols, forward-thinking atmosphere',
      'How-To / Playbook': 'person demonstrating business methodology with step-by-step visual guides and tools'
    };

    const personaPrompts = {
      'Rajiv Wijaya': 'warm human-centered atmosphere, storytelling elements, collaborative environment',
      'Dr. Anya Sharma': 'analytical data-focused setting, structured organized workspace, research atmosphere',
      'Linh Nguyen': 'futuristic tech-forward environment, innovation symbols, cutting-edge technology'
    };

    const templatePrompt = templatePrompts[templateType] || 'generic business professional environment';
    const personaPrompt = personaPrompts[persona] || 'neutral professional setting';
    
    return `${templatePrompt}, ${personaPrompt}, ${baseStyle}, related to ${keyword}, high quality, photorealistic`;
  }

  generateFilename(keyword, templateType) {
    const slug = keyword.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 40);
    
    const templateSlug = templateType.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    const timestamp = Date.now();
    return `${slug}-${templateSlug}-${timestamp}.jpg`;
  }

  generateAltText(keyword, templateType) {
    return `Professional illustration showing ${keyword} concepts in ${templateType} format for B2B marketing strategy`;
  }

  async testConnection() {
    try {
      console.log('🧪 Testing image generation system...');
      const testResult = await this.generateFeaturedImage(
        'Test Marketing Strategy', 
        'Strategic Framework', 
        'Dr. Anya Sharma'
      );
      
      if (testResult.provider === 'fallback') {
        console.log('⚠️ Image generation using fallback (API limits or model loading)');
      } else {
        console.log('✅ Image generation working:', testResult.provider);
      }
      
      return true;
    } catch (error) {
      console.log('⚠️ Image generation test failed, using fallback mode');
      return true; // Don't fail the whole system
    }
  }
}

module.exports = ImageGenerator;