// src/utils/setupGhostAuthors.js - Setup authors in Ghost with proper credentials
const GhostAdminAPI = require('@tryghost/admin-api');
require('dotenv').config();

class GhostAuthorSetup {
  constructor() {
    this.api = new GhostAdminAPI({
      url: process.env.GHOST_API_URL,
      key: process.env.GHOST_ADMIN_API_KEY,
      version: 'v5.0'
    });

    this.authors = [
      {
        name: 'Rajiv Wijaya',
        email: 'rajivwijaya.ignition@gmail.com',
        slug: 'rajiv-wijaya',
        bio: 'B2B brand and communications expert passionate about authentic human connection in business relationships. Shares real-world stories that humanize B2B brands.',
        location: 'Singapore',
        website: 'https://ignitionstudio.co'
      },
      {
        name: 'Dr. Anya Sharma',
        email: 'anyasharma.ignition@gmail.com',
        slug: 'dr-anya-sharma',
        bio: 'B2B Growth Architect leveraging data-driven strategies to drive sustainable growth. Presents clear frameworks, case studies, and actionable insights.',
        location: 'Singapore',
        website: 'https://ignitionstudio.co'
      },
      {
        name: 'Linh Nguyen',
        email: 'linhnguyen.ignition@gmail.com',
        slug: 'linh-nguyen',
        bio: 'Forward-looking B2B strategist passionate about emerging technologies. Connects future trends to practical marketing strategies with optimism.',
        location: 'Singapore',
        website: 'https://ignitionstudio.co'
      }
    ];
  }

  /**
   * Check if author exists in Ghost
   */
  async authorExists(email) {
    try {
      const users = await this.api.users.browse({ filter: `email:${email}` });
      return users.length > 0;
    } catch (error) {
      console.error(`Error checking author ${email}:`, error.message);
      return false;
    }
  }

  /**
   * Get author by email
   */
  async getAuthorByEmail(email) {
    try {
      const users = await this.api.users.browse({ 
        filter: `email:${email}`,
        include: 'roles'
      });
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error(`Error fetching author ${email}:`, error.message);
      return null;
    }
  }

  /**
   * Setup all authors
   */
  async setupAllAuthors() {
    console.log('👥 Setting up Ghost authors...\n');
    console.log('='.repeat(60));
    
    for (const author of this.authors) {
      console.log(`\nProcessing: ${author.name}`);
      console.log('Email:', author.email);
      
      const exists = await this.authorExists(author.email);
      
      if (exists) {
        console.log('✅ Author already exists in Ghost');
        
        // Get author details
        const existingAuthor = await this.getAuthorByEmail(author.email);
        if (existingAuthor) {
          console.log('   ID:', existingAuthor.id);
          console.log('   Slug:', existingAuthor.slug);
          console.log('   Status:', existingAuthor.status);
        }
      } else {
        console.log('⚠️  Author does not exist in Ghost');
        console.log('\n📝 MANUAL SETUP REQUIRED:');
        console.log('   1. Go to Ghost Admin → Settings → Staff');
        console.log('   2. Click "Invite people"');
        console.log(`   3. Enter email: ${author.email}`);
        console.log('   4. Select role: Author');
        console.log('   5. Send invitation');
        console.log(`   6. Login to ${author.email} and accept invitation`);
        console.log(`   7. Set password: iloveIgnition2025!`);
        console.log(`   8. Complete profile with:`);
        console.log(`      - Name: ${author.name}`);
        console.log(`      - Slug: ${author.slug}`);
        console.log(`      - Bio: ${author.bio}`);
        console.log(`      - Location: ${author.location}`);
        console.log(`      - Website: ${author.website}`);
      }
      
      console.log('─'.repeat(60));
    }
    
    console.log('\n✅ Author setup check complete!\n');
    console.log('📌 IMPORTANT NOTES:');
    console.log('   • Ghost API cannot create users directly for security');
    console.log('   • Authors must be invited through Ghost Admin UI');
    console.log('   • Once invited, they can set their own passwords');
    console.log('   • After setup, posts will show correct author attribution\n');
    
    return this.authors;
  }

  /**
   * Test author assignment
   */
  async testAuthorAssignment() {
    console.log('\n🧪 Testing author assignment...\n');
    
    for (const author of this.authors) {
      const existingAuthor = await this.getAuthorByEmail(author.email);
      
      if (existingAuthor) {
        console.log(`✅ ${author.name} is ready for blog posts`);
        console.log(`   Can be referenced by email: ${author.email}`);
      } else {
        console.log(`❌ ${author.name} not found - needs manual setup`);
      }
    }
  }

  /**
   * List all authors in Ghost
   */
  async listAllAuthors() {
    try {
      console.log('\n📋 All authors in Ghost:\n');
      const users = await this.api.users.browse({ 
        limit: 'all',
        include: 'roles'
      });
      
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Slug: ${user.slug}`);
        
        // Safely handle roles
        if (user.roles && Array.isArray(user.roles)) {
          console.log(`   Role: ${user.roles.map(r => r.name).join(', ')}`);
        } else {
          console.log(`   Role: N/A`);
        }
        
        console.log(`   Status: ${user.status || 'N/A'}`);
        console.log('');
      });
      
      return users;
    } catch (error) {
      console.error('Error listing authors:', error.message);
      
      // Try without roles if include fails
      try {
        console.log('\n⚠️  Retrying without role information...\n');
        const users = await this.api.users.browse({ limit: 'all' });
        
        users.forEach((user, index) => {
          console.log(`${index + 1}. ${user.name}`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Slug: ${user.slug}`);
          console.log(`   Status: ${user.status || 'active'}`);
          console.log('');
        });
        
        return users;
      } catch (retryError) {
        console.error('Retry also failed:', retryError.message);
        return [];
      }
    }
  }

  /**
   * Get detailed author info
   */
  async getAuthorDetails(email) {
    try {
      const author = await this.getAuthorByEmail(email);
      
      if (!author) {
        console.log(`❌ Author not found: ${email}`);
        return null;
      }
      
      console.log('\n📋 Author Details:\n');
      console.log('Name:', author.name);
      console.log('Email:', author.email);
      console.log('Slug:', author.slug);
      console.log('Bio:', author.bio || 'Not set');
      console.log('Location:', author.location || 'Not set');
      console.log('Website:', author.website || 'Not set');
      console.log('Status:', author.status);
      console.log('Created:', author.created_at);
      
      if (author.roles && Array.isArray(author.roles)) {
        console.log('Roles:', author.roles.map(r => r.name).join(', '));
      }
      
      return author;
    } catch (error) {
      console.error('Error getting author details:', error.message);
      return null;
    }
  }

  /**
   * Update author profile (if needed)
   */
  async updateAuthorProfile(email, updates) {
    try {
      const author = await this.getAuthorByEmail(email);
      
      if (!author) {
        console.log(`❌ Author not found: ${email}`);
        return null;
      }
      
      console.log(`📝 Updating profile for ${author.name}...`);
      
      const updatedAuthor = await this.api.users.edit({
        id: author.id,
        ...updates
      });
      
      console.log('✅ Profile updated successfully!');
      return updatedAuthor;
    } catch (error) {
      console.error('Error updating author:', error.message);
      return null;
    }
  }

  /**
   * Verify all authors have complete profiles
   */
  async verifyProfiles() {
    console.log('\n🔍 Verifying author profiles...\n');
    console.log('='.repeat(60));
    
    const issues = [];
    
    for (const expectedAuthor of this.authors) {
      console.log(`\nChecking: ${expectedAuthor.name}`);
      
      const author = await this.getAuthorByEmail(expectedAuthor.email);
      
      if (!author) {
        console.log('❌ Author not found in Ghost');
        issues.push({
          author: expectedAuthor.name,
          issue: 'Not found in Ghost - needs invitation'
        });
        continue;
      }
      
      // Check required fields
      const checks = {
        'Name': author.name === expectedAuthor.name,
        'Slug': author.slug === expectedAuthor.slug,
        'Bio': !!author.bio && author.bio.length > 10,
        'Location': !!author.location,
        'Website': !!author.website,
        'Status': author.status === 'active'
      };
      
      let allGood = true;
      
      for (const [field, passed] of Object.entries(checks)) {
        if (passed) {
          console.log(`   ✅ ${field}: OK`);
        } else {
          console.log(`   ⚠️  ${field}: Missing or incorrect`);
          allGood = false;
          issues.push({
            author: expectedAuthor.name,
            issue: `${field} needs update`
          });
        }
      }
      
      if (allGood) {
        console.log('   ✅ Profile complete!');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (issues.length === 0) {
      console.log('✅ All author profiles are complete!\n');
    } else {
      console.log(`⚠️  Found ${issues.length} issue(s):\n`);
      issues.forEach(issue => {
        console.log(`   - ${issue.author}: ${issue.issue}`);
      });
      console.log('');
    }
    
    return issues;
  }
}

module.exports = GhostAuthorSetup;