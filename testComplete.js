// testComplete.js - Complete system test with validation
const BlogGenerator = require('./src/automation/blogGenerator');
const TopicHistory = require('./src/utils/topicHistory');
const GhostAuthorSetup = require('./src/utils/setupGhostAuthors');

async function runCompleteTests() {
  console.log('🧪 COMPLETE SYSTEM TEST - PHASE 3\n');
  console.log('='.repeat(70) + '\n');
  
  const generator = new BlogGenerator();
  const topicHistory = new TopicHistory();
  const authorSetup = new GhostAuthorSetup();
  
  // Test 1: System connections
  console.log('TEST 1: System Connections');
  console.log('-'.repeat(70));
  const systemsReady = await generator.testGeneration();
  console.log('\n');
  
  if (!systemsReady) {
    console.error('❌ System tests failed. Please check API keys and connections.');
    return;
  }
  
  // Test 2: Author setup verification
  console.log('TEST 2: Author Setup Verification');
  console.log('-'.repeat(70));
  await authorSetup.testAuthorAssignment();
  console.log('\n');
  
  // Test 3: Topic history validation
  console.log('TEST 3: Topic & Title History Validation');
  console.log('-'.repeat(70));
  const historyValid = topicHistory.validateHistory();
  if (historyValid) {
    const stats = topicHistory.getStats();
    console.log('\n📊 Current Statistics:');
    for (const persona in stats) {
      if (persona === '_global') continue;
      console.log(`   ${persona}: ${stats[persona].totalUsed} topics used`);
    }
    if (stats._global) {
      console.log(`   Total unique titles: ${stats._global.totalTitles}`);
    }
  }
  console.log('\n');
  
  // Test 4: Generate with validation
  console.log('TEST 4: Generate Blog Post with Complete Validation');
  console.log('-'.repeat(70));
  console.log('Generating blog with content validation, deduplication, and SEO checks...\n');
  
  try {
    const result = await generator.generateAndCreateBlog();
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ GENERATION SUCCESSFUL!');
    console.log('='.repeat(70));
    
    console.log('\n📋 Post Details:');
    console.log('  Title:', result.post.title);
    console.log('  Post ID:', result.post.id);
    console.log('  Status:', result.post.status);
    console.log('  Edit URL:', `${process.env.GHOST_API_URL}/ghost/#/editor/post/${result.post.id}`);
    
    console.log('\n👤 Configuration:');
    console.log('  Persona:', result.configuration.persona);
    console.log('  Keyword:', result.configuration.keyword);
    console.log('  Template:', result.configuration.template);
    
    console.log('\n🎨 Image:');
    console.log('  Generated:', result.image.url ? 'Yes ✅' : 'No ⚠️');
    if (result.image.url) {
      console.log('  URL:', result.image.url);
      console.log('  Style:', result.image.style || 'N/A');
      console.log('  Alt text:', result.image.altText);
    }
    
    console.log('\n🔍 Validation Results:');
    console.log('  Valid:', result.validation.valid ? '✅' : '❌');
    console.log('  Errors:', result.validation.errors.length);
    console.log('  Warnings:', result.validation.warnings.length);
    
    console.log('\n📊 Content Metrics:');
    console.log('  Word count:', result.validation.metrics.wordCount);
    console.log('  Paragraphs:', result.validation.metrics.paragraphCount);
    console.log('  Headings:', result.validation.metrics.headingCount);
    console.log('  Links:', result.validation.metrics.linkCount);
    
    if (result.seoReport) {
      console.log('\n🎯 SEO Score:', `${result.seoReport.overall.score}/100 (Grade: ${result.seoReport.overall.grade})`);
      
      if (result.validation.warnings.length > 0) {
        console.log('\n⚠️  Warnings (first 3):');
        result.validation.warnings.slice(0, 3).forEach(w => console.log(`  - ${w}`));
        if (result.validation.warnings.length > 3) {
          console.log(`  ... and ${result.validation.warnings.length - 3} more`);
        }
      }
    }
    
  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ GENERATION FAILED');
    console.error('='.repeat(70));
    console.error('\nError:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
  
  // Test 5: Updated statistics
  console.log('\n' + '='.repeat(70));
  console.log('TEST 5: Post-Generation Statistics');
  console.log('='.repeat(70));
  generator.getTopicStats();
  
  console.log('\n' + '='.repeat(70));
  console.log('🎉 COMPLETE SYSTEM TEST FINISHED');
  console.log('='.repeat(70));
  console.log('\n📋 Next Steps:');
  console.log('  1. Review the generated post in Ghost Admin');
  console.log('  2. Check author attribution is correct');
  console.log('  3. Verify featured image appears properly');
  console.log('  4. Validate SEO metadata in Ghost');
  console.log('  5. Run batch generation if single post looks good\n');
}

// Run tests
runCompleteTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});