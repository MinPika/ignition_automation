// testScheduling.js - Test the scheduling system
const BlogGenerator = require('./src/automation/blogGenerator');

async function testScheduling() {
  console.log('🧪 TESTING SCHEDULING SYSTEM\n');
  console.log('='.repeat(70) + '\n');
  
  const generator = new BlogGenerator();
  
  // Test 1: View scheduling presets
  console.log('TEST 1: Available Scheduling Presets');
  console.log('-'.repeat(70));
  generator.getSchedulingPresets();
  console.log('\n');
  
  // Test 2: Preview default schedule (3x week Mon/Wed/Fri)
  console.log('TEST 2: Preview Next 5 Publishing Slots (Default: Mon/Wed/Fri)');
  console.log('-'.repeat(70));
  generator.previewSchedule(5);
  
  // Test 3: Preview alternative schedule (2x week Tue/Thu)
  console.log('TEST 3: Preview Alternative Schedule (Tue/Thu)');
  console.log('-'.repeat(70));
  generator.previewSchedule(5, '2x-week-tf');
  
  // Test 4: Generate one scheduled post
  console.log('TEST 4: Generate One Scheduled Post');
  console.log('-'.repeat(70));
  console.log('Generating a post scheduled for next available slot...\n');
  
  try {
    const nextPublishDate = generator.scheduler.getNextPublishDate();
    console.log(`📅 Will schedule for: ${generator.scheduler.formatPublishDate(nextPublishDate)}\n`);
    
    const result = await generator.generateAndCreateBlog(null, null, null, nextPublishDate);
    
    console.log('\n✅ SCHEDULED POST CREATED!\n');
    console.log('Post Details:');
    console.log('  Title:', result.post.title);
    console.log('  Status:', result.post.status);
    console.log('  Scheduled for:', generator.scheduler.formatPublishDate(result.configuration.publishDate));
    console.log('  Time until publish:', generator.scheduler.getTimeUntilPublish(result.configuration.publishDate));
    console.log('  Edit URL:', `${process.env.GHOST_API_URL}/ghost/#/editor/post/${result.post.id}`);
    
  } catch (error) {
    console.error('\n❌ SCHEDULING TEST FAILED:', error.message);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🎉 SCHEDULING TESTS COMPLETE');
  console.log('='.repeat(70));
}

// Run tests
testScheduling().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});