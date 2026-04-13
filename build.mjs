/**
 * build.mjs — 主网站统一构建脚本
 * 
 * 构建流程：
 * 1. 构建 InfiniteSkill React 应用（输出到 infiniteskill/dist/）
 * 2. 构建 YunType React 应用（输出到 yuntype/dist/）
 * 3. 构建 Cyber Flying Sword React 应用（输出到 cyber-flying-sword/dist/）
 * 4. 组装 public/ 目录：
 *    - public/index.html            ← 主门户
 *    - public/infiniteskill/        ← 编译后的 React 应用
 *    - public/yuntype/              ← 编译后的 React 应用
 *    - public/cyber-flying-sword/   ← 编译后的 React 应用
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

// Step 2: Build YunType
console.log('\n🔨 Building YunType React app...');
execSync('npm install', { cwd: join(ROOT, 'yuntype'), stdio: 'inherit' });
execSync('npm run build', { cwd: join(ROOT, 'yuntype'), stdio: 'inherit' });
console.log('✅ YunType built successfully.');

// Step 3: Build Cyber Flying Sword
console.log('\n🔨 Building Cyber Flying Sword...');
execSync('npm install', { cwd: join(ROOT, 'cyber-flying-sword'), stdio: 'inherit' });
execSync('npm run build', { cwd: join(ROOT, 'cyber-flying-sword'), stdio: 'inherit' });
console.log('✅ Cyber Flying Sword built successfully.');

// Step 4: Assemble public/ directory
console.log('\n📦 Assembling portal output...');

mkdirSync(join(ROOT, 'public'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'infiniteskill'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'yuntype'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'cyber-flying-sword'), { recursive: true });

// Copy portal HTML
copyFileSync(join(ROOT, 'index.html'), join(ROOT, 'public', 'index.html'));
console.log('  ✓ Copied index.html → public/index.html');

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

// Copy Cyber Flying Sword build output
cpSync(
  join(ROOT, 'cyber-flying-sword', 'dist'),
  join(ROOT, 'public', 'cyber-flying-sword'),
  { recursive: true }
);
console.log('  ✓ Copied cyber-flying-sword/dist → public/cyber-flying-sword/');

console.log('\n🚀 Build complete! Output in public/');
