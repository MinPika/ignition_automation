const GhostAdminAPI = require('@tryghost/admin-api');
require('dotenv').config();

class AuthorSetup {
  constructor() {
    this.api = new GhostAdminAPI({
      url: process.env.GHOST_API_URL,
      key: process.env.GHOST_ADMIN_API_KEY,
      version: 'v5.0'
    });
  }

  async createAuthor(name, email) {
    try {
      const author = await this.api.users.add({
        name: name,
        email: email,
        roles: ['Author']
      });
      console.log('✅ Author created:', author.name, '(' + author.email + ')');
      return author;
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Author already exists:', email);
        return true;
      }
      console.error('❌ Error creating author:', error.message);
      throw error;
    }
  }

  async setupAllAuthors() {
    const authors = [
      { name: 'Rajiv Wijaya', email: 'hello@ignitionstudio.co' },
      { name: 'Dr. Anya Sharma', email: 'hello@ignitionstudio.co' },
      { name: 'Linh Nguyen', email: 'hello@ignitionstudio.co' }
    ];

    for (const author of authors) {
      await this.createAuthor(author.name, author.email);
    }
  }
}

module.exports = AuthorSetup;