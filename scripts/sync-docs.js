// sync-docs.js
// Universal docs compiler for Vite / Astro / Tailwind / etc.

import fs from 'fs';
import path from 'path';

// --- Configuration ---
const DOCS_DIR = path.resolve('./docs'); // Change if needed
const OUTPUT_FILE = path.resolve('./compiled-docs.txt');

// --- Helper: recursively collect all .md and .html files ---
function getAllDocs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllDocs(fullPath));
    } else if (/\.(md|html)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

// --- Helper: strip unwanted HTML and keep readable content ---
function cleanContent(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '') // remove remaining tags
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// --- Main: extract and combine ---
function compileDocs() {
  const files = getAllDocs(DOCS_DIR);
  let output = '=== VITE DOCUMENTATION ===\n\n';

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    output += `# ${path.basename(file)}\n\n${cleanContent(content)}\n\n---\n\n`;
  }

  fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
  console.log(`✅ Documentation compiled to ${OUTPUT_FILE}`);
}

compileDocs();
