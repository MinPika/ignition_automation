// test.js - Test the complete Phase 2 system
const BlogGenerator = require('./src/automation/blogGenerator');

async function runTests() {
  console.log('🧪 TESTING PHASE 2 IMPLEMENTATION\n');
  console.log('='.repeat(70) + '\n');
  
  const generator = new BlogGenerator();
  
  // Test 1: System connections
  console.log('TEST 1: System Connections');
  console.log('-'.repeat(70));
  const systemsReady = await generator.testGeneration();
  console.log('\n');
  
  if (!systemsReady) {
    console.error('❌ System tests failed. Please check API keys and connections.');
    return;
  }
  
  // Test 2: Topic deduplication
  console.log('TEST 2: Topic Deduplication System');
  console.log('-'.repeat(70));
  console.log('Checking topic usage statistics...\n');
  generator.getTopicStats();
  console.log('\n');
  
  // Test 3: Generate a complete blog post
  console.log('TEST 3: Generate Complete Blog Post');
  console.log('-'.repeat(70));
  console.log('Generating blog with image, SEO, and deduplication...\n');
  
  try {
    const result = await generator.generateAndCreateBlog();
    
    console.log('\n✅ GENERATION SUCCESSFUL!\n');
    console.log('Post Details:');
    console.log('  Title:', result.post.title);
    console.log('  Post ID:', result.post.id);
    console.log('  Edit URL:', `${process.env.GHOST_API_URL}/ghost/#/editor/post/${result.post.id}`);
    console.log('\nConfiguration:');
    console.log('  Persona:', result.configuration.persona);
    console.log('  Keyword:', result.configuration.keyword);
    console.log('  Template:', result.configuration.template);
    console.log('\nImage:');
    console.log('  Generated:', result.image.url ? 'Yes' : 'No');
    if (result.image.url) {
      console.log('  URL:', result.image.url);
      console.log('  Alt text:', result.image.altText);
    }
    
    console.log('\n📊 Updated topic statistics:');
    generator.getTopicStats();
    
  } catch (error) {
    console.error('\n❌ GENERATION FAILED:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🎉 PHASE 2 TESTING COMPLETE');
  console.log('='.repeat(70));
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});