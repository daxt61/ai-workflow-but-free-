import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function buildAndRelease() {
  console.log('🚀 Starting Build and Release automation...');

  try {
    // 1. Build the application
    console.log('📦 Building Electron application...');
    execSync('npm run build', { stdio: 'inherit' });

    // 2. Run electron-builder to generate executable
    console.log('🔨 Generating executable...');
    const platform = process.platform === 'win32' ? '--win' : process.platform === 'darwin' ? '--mac' : '--linux';
    execSync(`npx electron-builder ${platform} --dir`, { stdio: 'inherit' });

    // 3. Create releases folder if it doesn't exist
    const releasesDir = path.join(process.cwd(), 'releases');
    if (!fs.existsSync(releasesDir)) {
      fs.mkdirSync(releasesDir);
    }

    // 4. Move artifacts to releases folder
    const distDir = path.join(process.cwd(), 'dist');
    const files = fs.readdirSync(distDir);

    console.log('🚚 Moving artifacts to releases folder...');
    for (const file of files) {
      if (file.endsWith('.exe') || file.endsWith('.dmg') || file.endsWith('.AppImage') || file.endsWith('.zip')) {
        const oldPath = path.join(distDir, file);
        const newPath = path.join(releasesDir, file);
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Released: ${file}`);
      }
    }

    console.log('🎉 Release process completed successfully!');
  } catch (error) {
    console.error('❌ Release process failed:', error);
    process.exit(1);
  }
}

buildAndRelease();
