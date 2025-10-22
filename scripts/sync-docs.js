/**
 * sync-docs.js
 * Extracts all human-readable documentation and code examples
 * from the Vite docs repo into a single compiled text file.
 */

import fs from "fs";
import path from "path";

const ROOT = "./docs"; // the docs folder root
const OUTPUT = "./compiled-docs.txt";
const VALID_EXT = [".md", ".mdx", ".html"]; // include markdown + html
const EXCLUDE_DIRS = ["images", "public", "_data"]; // skip noise folders

let collected = [];

function crawl(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    // Skip unwanted folders
    if (item.isDirectory() && !EXCLUDE_DIRS.includes(item.name)) {
      crawl(fullPath);
      continue;
    }

    // Process markdown/html documentation files
    if (item.isFile() && VALID_EXT.includes(path.extname(item.name))) {
      const content = fs.readFileSync(fullPath, "utf8");

      // Basic content cleaning rules
      const clean = content
        .replace(/---[\s\S]*?---/g, "") // remove YAML frontmatter
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/\n{3,}/g, "\n\n"); // compress empty lines

      collected.push(`# ${item.name}\n\n${clean.trim()}\n`);
    }
  }
}

// Start recursive crawl
crawl(ROOT);

// Combine and write output
const finalOutput = [
  "VITE DOCUMENTATION\n===================\n",
  ...collected
].join("\n\n");

fs.writeFileSync(OUTPUT, finalOutput, "utf8");

console.log(`✅ Documentation compiled successfully into ${OUTPUT}`);
