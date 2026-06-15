import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const source = ".github/assets/draftlet-icon.png";

const extensionOut = "apps/extension/public";
const desktopOut = "apps/desktop/assets";

await mkdir(extensionOut, { recursive: true });
await mkdir(desktopOut, { recursive: true });

const extensionSizes = [16, 32, 48, 96, 128];

for (const size of extensionSizes) {
  await sharp(source)
    .resize(size, size, {
      fit: "cover",
      position: "center",
    })
    .png()
    .toFile(`${extensionOut}/icon-${size}.png`);
}

await sharp(source)
  .resize(512, 512, {
    fit: "cover",
    position: "center",
  })
  .png()
  .toFile(`${desktopOut}/icon.png`);

await sharp(source)
  .resize(1024, 1024, {
    fit: "cover",
    position: "center",
  })
  .png()
  .toFile(`${desktopOut}/icon-1024.png`);

await sharp(source)
  .resize(96, 96, {
    fit: "cover",
    position: "center",
  })
  .png()
  .toFile(`${desktopOut}/favicon-96x96.png`);

await sharp(source)
  .resize(180, 180, {
    fit: "cover",
    position: "center",
  })
  .png()
  .toFile(`${desktopOut}/apple-touch-icon.png`);

console.log("Generated Draftlet icons:");
console.log(`- ${extensionOut}/icon-16.png`);
console.log(`- ${extensionOut}/icon-32.png`);
console.log(`- ${extensionOut}/icon-48.png`);
console.log(`- ${extensionOut}/icon-96.png`);
console.log(`- ${extensionOut}/icon-128.png`);
console.log(`- ${desktopOut}/icon.png`);
console.log(`- ${desktopOut}/icon-1024.png`);
