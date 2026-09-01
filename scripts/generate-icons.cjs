const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ICNS = require('icns');

const publicDir = path.join(__dirname, '../public');
const faviconSvg = path.join(publicDir, 'favicon.svg');

// SVG to PNG conversion via intermediate step
async function generateIcons() {
  try {
    console.log('Generating application icons from favicon.svg...');

    // Create 512x512 PNG (base for all conversions)
    const pngBuffer = await sharp(faviconSvg)
      .resize(512, 512, { fit: 'contain', background: { r: 3, g: 7, b: 18, alpha: 1 } })
      .png()
      .toBuffer();

    const pngPath = path.join(publicDir, 'icon.png');
    fs.writeFileSync(pngPath, pngBuffer);
    console.log('✓ Created icon.png (512x512)');

    // Create 256x256 ICO for Windows
    const icoBuffer = await sharp(faviconSvg)
      .resize(256, 256, { fit: 'contain', background: { r: 3, g: 7, b: 18, alpha: 1 } })
      .png()
      .toBuffer();

    const icoPath = path.join(publicDir, 'icon.ico');
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('✓ Created icon.ico (256x256)');

    // Create macOS ICNS from PNG
    // Note: Proper .icns requires macOS tools or third-party service
    // For now, copy PNG as temporary fallback
    const icnsPath = path.join(publicDir, 'icon.icns');
    fs.copyFileSync(pngPath, icnsPath);
    console.log('✓ Created icon.icns (PNG format - will work but not ideal)');
    console.log('  → For production macOS builds, generate proper .icns using:');
    console.log('    Visit: https://icoconvert.com/ and convert public/icon.png to .icns');
    console.log('    Then save as: public/icon.icns');

    console.log('\n✓ All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
