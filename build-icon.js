// One-shot helper: crop sheet1.png → icon.png (256×256) and icon.ico for .exe.
const { app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const pngToIco = (await import('png-to-ico')).default;
  const sheet = path.join(__dirname, 'assets', 'cat', 'sheet1.png');
  const full = nativeImage.createFromPath(sheet);
  if (full.isEmpty()) {
    console.error('sheet1.png not found');
    app.exit(1);
    return;
  }
  const { width, height } = full.getSize();
  const cellW = Math.floor(width / 6);
  const cellH = Math.floor(height / 3);
  const cropped = full.crop({ x: 0, y: 0, width: cellW, height: cellH });

  // Multi-size PNG buffers for ICO
  const sizes = [16, 32, 48, 64, 128, 256];
  const buffers = sizes.map(s =>
    cropped.resize({ width: s, height: s, quality: 'best' }).toPNG()
  );

  // Save 256 PNG too (for app icon at runtime)
  const pngOut = path.join(__dirname, 'assets', 'cat', 'icon.png');
  fs.writeFileSync(pngOut, buffers[buffers.length - 1]);

  // Generate ICO
  try {
    const icoBuf = await pngToIco(buffers);
    const icoOut = path.join(__dirname, 'assets', 'cat', 'icon.ico');
    fs.writeFileSync(icoOut, icoBuf);
    console.log('wrote', icoOut);
  } catch (e) {
    console.error('failed to make ICO:', e.message);
  }

  app.exit(0);
});
