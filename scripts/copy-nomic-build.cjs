#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "thirdparty", "nomic-app", "dist", "apps", "app");
const dest = path.join(__dirname, "..", "public", "nomic-app");

function rimraf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyDir(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      const srcPath = path.join(from, entry);
      const destPath = path.join(to, entry);
      copyDir(srcPath, destPath);
    }
  } else {
    fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(src)) {
  console.error("Nomic build not found at", src);
  console.error("Run: npm run nomic:build");
  process.exit(1);
}

rimraf(dest);
copyDir(src, dest);
console.log("Copied Nomic build ->", dest);
