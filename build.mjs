/**
 * build.mjs — 主网站统一构建脚本
 * 
 * 构建流程：
 * 1. 构建 InfiniteSkill React 应用（输出到 infiniteskill/dist/）
 * 2. 构建 YunType React 应用（输出到 yuntype/dist/）
 * 3. 构建 AI Slides React 应用（输出到 ai-slides/dist/）
 * 4. 构建 AI Presentation React 应用（输出到 ai-presentation/dist/）
 * 5. 构建 Cyber Flying Sword React 应用（输出到 cyber-flying-sword/dist/）
 * 6. 构建 StoryForge React 应用（输出到 storyforge/dist/）
 * 7. 构建 novel-game React 应用（输出到 novel-game/dist/）
 * 8. 构建 AI 视觉场景库（输出到 awesome-gpt-image-2/dist/）
 * 9. 组装 public/ 目录：
 *    - public/index.html            ← 主门户
 *    - public/infiniteskill/        ← 编译后的 React 应用
 *    - public/yuntype/              ← 编译后的 React 应用
 *    - public/ai-slides/            ← 编译后的 React 应用
 *    - public/ai-presentation/      ← 编译后的 React 应用
 *    - public/cyber-flying-sword/   ← 编译后的 React 应用
 *    - public/storyforge/           ← 编译后的 React 应用
 *    - public/awesome-gpt-image-2/   ← 编译后的 React 应用
 */

import { execSync } from 'child_process';
import { cpSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

// Step 1: Build InfiniteSkill
console.log('\n🔨 Building InfiniteSkill React app...');
execSync('npm install', { cwd: join(ROOT, 'infiniteskill'), stdio: 'inherit' });
execSync('npm run build', { cwd: join(ROOT, 'infiniteskill'), stdio: 'inherit' });
console.log('✅ InfiniteSkill built successfully.');

// Step 2: Build YunType
console.log('\n🔨 Building YunType React app...');
execSync('npm install', { cwd: join(ROOT, 'yuntype'), stdio: 'inherit' });
execSync('npm run build', { cwd: join(ROOT, 'yuntype'), stdio: 'inherit' });
console.log('✅ YunType built successfully.');

// Step 3: Build AI Slides
console.log('\n🔨 Building AI Slides React app...');
execSync('npm install', { cwd: join(ROOT, 'ai-slides'), stdio: 'inherit' });
execSync('npm run build', { cwd: join(ROOT, 'ai-slides'), stdio: 'inherit' });
console.log('✅ AI Slides built successfully.');

// Step 4: Build AI Presentation
console.log('\n🔨 Building AI Presentation React app...');
execSync('npm install', { cwd: join(ROOT, 'ai-presentation'), stdio: 'inherit' });
execSync('npm run build', { cwd: join(ROOT, 'ai-presentation'), stdio: 'inherit' });
console.log('✅ AI Presentation built successfully.');

// Step 5: Build Cyber Flying Sword
console.log('\n🔨 Building Cyber Flying Sword...');
execSync('npm install', { cwd: join(ROOT, 'cyber-flying-sword'), stdio: 'inherit' });
execSync('npm run build', { cwd: join(ROOT, 'cyber-flying-sword'), stdio: 'inherit' });
console.log('✅ Cyber Flying Sword built successfully.');

// Step 6: Build StoryForge
console.log('\n🔨 Building StoryForge React app...');
execSync('npm install', { cwd: join(ROOT, 'storyforge'), stdio: 'inherit' });
execSync('npm run build', { cwd: join(ROOT, 'storyforge'), stdio: 'inherit' });
console.log('✅ StoryForge built successfully.');

// Step 7: Build novel-game
console.log('\n🔨 Building novel-game React app...');
execSync('npm install', { cwd: join(ROOT, 'novel-game'), stdio: 'inherit' });
execSync('npm run build', { cwd: join(ROOT, 'novel-game'), stdio: 'inherit' });
console.log('✅ novel-game built successfully.');

// Step 8: Build AI Visual Patterns
console.log('\n🔨 Building AI Visual Patterns...');
execSync('npm install', { cwd: join(ROOT, 'awesome-gpt-image-2'), stdio: 'inherit' });
execSync('VITE_BASE_PATH=/awesome-gpt-image-2/ npm run build', { cwd: join(ROOT, 'awesome-gpt-image-2'), stdio: 'inherit' });
console.log('✅ AI Visual Patterns built successfully.');

// Step 9: Assemble public/ directory
console.log('\n📦 Assembling portal output...');

mkdirSync(join(ROOT, 'public'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'infiniteskill'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'yuntype'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'ai-slides'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'ai-presentation'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'cyber-flying-sword'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'storyforge'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'novel-game'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'awesome-gpt-image-2'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'wechat-plugin'), { recursive: true });

// Copy portal HTML
copyFileSync(join(ROOT, 'index.html'), join(ROOT, 'public', 'index.html'));
console.log('  ✓ Copied index.html → public/index.html');

const portalHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const aiToolsMatch = portalHtml.match(/const aiTools=\[(.*?)\];/s);
if (!aiToolsMatch) {
  throw new Error('Cannot find aiTools data in index.html');
}
writeFileSync(join(ROOT, 'ai-tools-data.js'), `window.AI_TOOLS = [${aiToolsMatch[1]}];\n`);
console.log('  ✓ Generated ai-tools-data.js from index.html');

copyFileSync(join(ROOT, 'sinan.html'), join(ROOT, 'public', 'sinan.html'));
console.log('  ✓ Copied sinan.html → public/sinan.html');

copyFileSync(join(ROOT, 'ai-tools-data.js'), join(ROOT, 'public', 'ai-tools-data.js'));
console.log('  ✓ Copied ai-tools-data.js → public/ai-tools-data.js');

// Copy game page
copyFileSync(join(ROOT, 'game.html'), join(ROOT, 'public', 'game.html'));
console.log('  ✓ Copied game.html → public/game.html');

// Copy InfiniteSkill build output
cpSync(
  join(ROOT, 'infiniteskill', 'dist'),
  join(ROOT, 'public', 'infiniteskill'),
  { recursive: true }
);
console.log('  ✓ Copied infiniteskill/dist → public/infiniteskill/');

// Copy YunType build output
cpSync(
  join(ROOT, 'yuntype', 'dist'),
  join(ROOT, 'public', 'yuntype'),
  { recursive: true }
);
console.log('  ✓ Copied yuntype/dist → public/yuntype/');

// Copy AI Slides build output
cpSync(
  join(ROOT, 'ai-slides', 'dist'),
  join(ROOT, 'public', 'ai-slides'),
  { recursive: true }
);
console.log('  ✓ Copied ai-slides/dist → public/ai-slides/');

// Copy AI Presentation build output
cpSync(
  join(ROOT, 'ai-presentation', 'dist'),
  join(ROOT, 'public', 'ai-presentation'),
  { recursive: true }
);
console.log('  ✓ Copied ai-presentation/dist → public/ai-presentation/');

// Copy Cyber Flying Sword build output
cpSync(
  join(ROOT, 'cyber-flying-sword', 'dist'),
  join(ROOT, 'public', 'cyber-flying-sword'),
  { recursive: true }
);
console.log('  ✓ Copied cyber-flying-sword/dist → public/cyber-flying-sword/');

// Copy StoryForge build output
cpSync(
  join(ROOT, 'storyforge', 'dist'),
  join(ROOT, 'public', 'storyforge'),
  { recursive: true }
);
console.log('  ✓ Copied storyforge/dist → public/storyforge/');

// Copy novel-game build output
cpSync(
  join(ROOT, 'novel-game', 'dist'),
  join(ROOT, 'public', 'novel-game'),
  { recursive: true }
);
console.log('  ✓ Copied novel-game/dist → public/novel-game/');

// Copy AI Visual Patterns build output
cpSync(
  join(ROOT, 'awesome-gpt-image-2', 'dist'),
  join(ROOT, 'public', 'awesome-gpt-image-2'),
  { recursive: true }
);
console.log('  ✓ Copied awesome-gpt-image-2/dist → public/awesome-gpt-image-2/');

// Copy WeChat plugin static page
cpSync(
  join(ROOT, 'wechat-plugin'),
  join(ROOT, 'public', 'wechat-plugin'),
  { recursive: true }
);
console.log('  ✓ Copied wechat-plugin → public/wechat-plugin/');

console.log('\n🚀 Build complete! Output in public/');
