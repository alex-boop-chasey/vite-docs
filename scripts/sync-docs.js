/**
 * sync-vite-docs.js
 *
 * Compiles the full Vite documentation into one clean text file,
 * suitable for AI ingestion.
 *
 * Based on the React sync-docs template you’re using elsewhere,
 * with adjustments for Vite’s repo layout.
 *
 * Assumptions (from your file tree):
 *   Repo root: /Users/home/Sites/docs/vite/vite-docs
 *   Docs live in: <root>/docs
 *      - /docs/guide
 *      - /docs/config
 *      - /docs/plugins
 *      - /docs/changes
 *      - /docs/blog  (release / announcement posts)
 *      - /docs/*.md  (index, team, releases, etc.)
 *
 * Output:
 *   /scripts/compiled-vite-docs.txt
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const ROOT_DIR = path.resolve(".."); // one level up from /scripts
const DOCS_DIR = path.join(ROOT_DIR, "docs"); // Vite docs live here
const OUTPUT_FILE = path.join(process.cwd(), "compiled-vite-docs.txt");

// Change this to false if you ever want to skip blog/changelog style pages
const INCLUDE_BLOG_AND_RELEASE_NOTES = true;

console.log("⚡ Compiling full Vite documentation...");

if (!fs.existsSync(DOCS_DIR)) {
  console.error(`❌ Docs folder not found: ${DOCS_DIR}`);
  process.exit(1);
}

// We'll accumulate cleaned text here before final normalization
let output = "# Vite Documentation\n\n";
let fileCount = 0;

// We’ll optionally embed snippet files if they’re imported.
// Vite docs sometimes reference code in ./examples or ./snippets.
const SNIPPET_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".html",
  ".css",
  ".vite.config.js",
  ".vite.config.ts"
];

/**
 * Extract YAML-style frontmatter (at the top of many .md files).
 * Returns:
 *   { body: string, meta: object }
 */
function extractFrontmatter(content) {
  const match = content.match(/^---([\s\S]*?)---/);
  if (!match) return { body: content, meta: {} };

  try {
    const meta = yaml.load(match[1]);
    const body = content.replace(/^---[\s\S]*?---/, "");
    return { body, meta };
  } catch {
    // If parsing fails, just return untouched body minus that block
    const body = content.replace(/^---[\s\S]*?---/, "");
    return { body, meta: {} };
  }
}

/**
 * Attempt to inline code snippets that are imported.
 * We scan for paths that look like "./snippets/xxx", "./examples/xxx", etc.
 * and, if we find a matching file next to the doc, we append it in a fenced block.
 */
function inlineSnippetsIntoDoc(content, fullPath) {
  // Find quoted imports e.g. "./snippets/foo.js" or "../examples/basic.ts"
  const snippetMatches = content.match(/['"].*?(snippets|examples).*?['"]/g) || [];

  for (const match of snippetMatches) {
    const rel = match.replace(/['"]/g, "");
    const abs = path.resolve(path.dirname(fullPath), rel);

    if (!fs.existsSync(abs)) continue;

    const ext = path.extname(abs);
    if (!SNIPPET_EXTENSIONS.includes(ext)) continue;

    try {
      const code = fs.readFileSync(abs, "utf8");

      content +=
        "\n\n```" +
        ext.replace(".", "") +
        "\n" +
        code.trim() +
        "\n```\n";
    } catch (err) {
      console.warn(`⚠️  Skipped snippet: ${abs}`, err.message);
    }
  }

  return content;
}

/**
 * Decide if a doc should be included.
 * We allow everything in /docs by default.
 * If INCLUDE_BLOG_AND_RELEASE_NOTES is false, we skip /docs/blog and
 * files like releases.md or changelog-like content in /changes.
 */
function shouldIncludeFile(fullPath) {
  // Normalize path chunks for decision making
  const lower = fullPath.toLowerCase();

  if (!INCLUDE_BLOG_AND_RELEASE_NOTES) {
    if (lower.includes("/blog/")) return false;
    if (lower.includes("/changes/")) return false;
    if (lower.endsWith("releases.md")) return false;
    if (lower.endsWith("release-notes.md")) return false;
  }

  return true;
}

/**
 * Recursively walk through DOCS_DIR, pull .md/.mdx files,
 * clean them, and append them to `output`.
 */
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Recurse into subfolders
    if (entry.isDirectory()) {
      // We still recurse into blog/changes etc. but we may skip files later
      if (!entry.name.startsWith(".")) {
        walk(fullPath);
      }
      continue;
    }

    // Only process markdown-y sources
    if (
      entry.name.endsWith(".md") ||
      entry.name.endsWith(".mdx") ||
      entry.name.endsWith(".markdown")
    ) {
      if (!shouldIncludeFile(fullPath)) {
        continue;
      }

      try {
        let raw = fs.readFileSync(fullPath, "utf8");

        // Extract metadata frontmatter (title, description, etc.) and strip it
        const { body, meta } = extractFrontmatter(raw);
        let content = body;

        // Core cleanup:
        // - remove inline imports, exports, jsx comments, etc.
        // - normalize fenced code languages
        // - strip raw HTML tags unless they are code/pre
        content = content
          .replace(/import .*? from .*/g, "")
          .replace(/export (const|default) .*/g, "")
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // strip JSX block comments
          .replace(/```(tsx|jsx|ts|js|javascript|typescript|html|css|bash|sh)/g, "```")
          .replace(/<.*?>/g, (tag) => {
            const t = tag.toLowerCase();
            if (t.startsWith("<code") || t.startsWith("<pre")) return tag;
            return "";
          });

        // Inline related snippets (examples, config samples, etc.)
        content = inlineSnippetsIntoDoc(content, fullPath);

        // Pick a nice section title
        // Prefer frontmatter.title, else use filename
        const baseTitle = path.basename(fullPath, path.extname(fullPath));
        const title = meta.title || baseTitle;

        // Compose cleaned section block
        output += `\n---\n# ${title}\n\n${content.trim()}\n`;
        fileCount++;
      } catch (err) {
        console.warn(`⚠️  Skipped unreadable file: ${fullPath}`, err.message);
      }
    }
  }
}

/**
 * Global cleanup pass to:
 * - collapse ugly whitespace
 * - remove duplicated headers ("# Title" directly repeated)
 * - normalize section separators
 */
function finalizeOutput(text) {
  return (
    text
      // If somehow a header is duplicated immediately, keep just one
      .replace(/(#+ .+)\n+\1/g, "$1")
      // Collapse 3+ blank lines to max 2
      .replace(/\n{3,}/g, "\n\n")
      // Ensure consistent spacing around our '---' section marker
      .replace(/\n---\n+/g, "\n\n---\n\n")
      // Trim only right-side spaces per line
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      // Global trim and ensure trailing newline
      .trim() + "\n"
  );
}

// Walk the docs tree and build up output
walk(DOCS_DIR);

// Final cleanup for AI consumption
output = finalizeOutput(output);

// Write result
fs.writeFileSync(OUTPUT_FILE, output, "utf8");

console.log(`✅ ${fileCount} Markdown pages processed`);
console.log(`🎉 All Vite docs compiled to: ${OUTPUT_FILE}`);
