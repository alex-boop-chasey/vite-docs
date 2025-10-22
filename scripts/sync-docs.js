/**
 * sync-docs.js
 * Extracts all human-readable documentation and code examples
 * from the Vite docs repo into a single compiled text file,
 * organized by folder section (Guide, Config, API, etc.)
 */

import fs from "fs";
import path from "path";

const ROOT = "../docs"; // folder where vite docs live
const OUTPUT = "../compiled-docs.txt";
const VALID_EXT = [".md", ".mdx", ".html"];
const EXCLUDE_DIRS = ["images", "public", "_data", ".vitepress"];

let collected = [];

/** Recursively crawls a directory and groups files by their parent folder name */
function crawl(dir, groupName = "General") {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(item.name)) {
        crawl(fullPath, item.name);
      }
      continue;
    }

    if (item.isFile() && VALID_EXT.includes(path.extname(item.name))) {
      const content = fs.readFileSync(fullPath, "utf8");

      // Basic content cleaning
      const clean = content
        .replace(/---[\s\S]*?---/g, "") // remove YAML frontmatter
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/\n{3,}/g, "\n\n"); // compress empty lines

      if (!collected[groupName]) collected[groupName] = [];
      collected[groupName].push(`# ${item.name}\n\n${clean.trim()}\n`);
    }
  }
}

// Crawl the docs root
crawl(ROOT);

// Assemble the output by section
let finalOutput = "VITE DOCUMENTATION\n===================\n\n";

for (const section in collected) {
  finalOutput += `\n\n## ${section.toUpperCase()}\n\n`;
  finalOutput += collected[section].join("\n\n");
}

fs.writeFileSync(OUTPUT, finalOutput, "utf8");

console.log(`✅ Documentation compiled successfully into ${OUTPUT}`);
