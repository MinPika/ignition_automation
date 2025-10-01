const BlogGenerator = require('./src/automation/blogGenerator');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function interactiveSchedule() {
  const generator = new BlogGenerator();
  
  console.log('\n=== Schedule Custom Blog Post ===\n');
  
  const dateStr = await question('Enter date (YYYY-MM-DD): ');
  const timeStr = await question('Enter time (HH:MM in 24hr format): ');
  
  const publishDate = new Date(`${dateStr}T${timeStr}:00+08:00`);
  
  console.log(`\nScheduling for: ${publishDate.toLocaleString()}`);
  console.log(`Time until publish: ${generator.scheduler.getTimeUntilPublish(publishDate)}\n`);
  
  const confirm = await question('Proceed? (y/n): ');
  
  if (confirm.toLowerCase() === 'y') {
    const result = await generator.generateAndCreateBlog(null, null, null, publishDate);
    console.log('\nScheduled!');
    console.log('Title:', result.post.title);
    console.log('Edit URL:', `${process.env.GHOST_API_URL}/ghost/#/editor/post/${result.post.id}`);
  } else {
    console.log('Cancelled.');
  }
  
  rl.close();
}

interactiveSchedule().catch(console.error);