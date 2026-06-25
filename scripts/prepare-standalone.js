const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");
const staticDir = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

if (!fs.existsSync(standaloneDir)) {
  console.error("Run `npm run build` first. Standalone output not found.");
  process.exit(1);
}

copyRecursive(staticDir, path.join(standaloneDir, ".next", "static"));
copyRecursive(publicDir, path.join(standaloneDir, "public"));

console.log("Standalone bundle prepared at .next/standalone");
