/**
 * build.mjs — 主网站统一构建脚本
 * 
 * 构建流程：
 * 1. 构建 InfiniteSkill React 应用（输出到 infiniteskill/dist/）
 * 2. 组装 public/ 目录：
 *    - public/index.html     ← 主门户
 *    - public/infiniteskill/ ← 编译后的 React 应用
 */

import { execSync } from 'child_process';
import { cpSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

// Step 1: Build InfiniteSkill
console.log('\n🔨 Building InfiniteSkill React app...');
execSync('npm install', { cwd: join(ROOT, 'infiniteskill'), stdio: 'inherit' });
execSync('npm run build', { cwd: join(ROOT, 'infiniteskill'), stdio: 'inherit' });
console.log('✅ InfiniteSkill built successfully.');

// Step 2: Assemble public/ directory
console.log('\n📦 Assembling portal output...');

mkdirSync(join(ROOT, 'public'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'infiniteskill'), { recursive: true });

// Copy portal HTML
copyFileSync(join(ROOT, 'index.html'), join(ROOT, 'public', 'index.html'));
console.log('  ✓ Copied index.html → public/index.html');

// Copy InfiniteSkill build output
cpSync(
  join(ROOT, 'infiniteskill', 'dist'),
  join(ROOT, 'public', 'infiniteskill'),
  { recursive: true }
);
console.log('  ✓ Copied infiniteskill/dist → public/infiniteskill/');

console.log('\n🚀 Build complete! Output in public/');
