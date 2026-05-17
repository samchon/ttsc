// Migrate /docs/*.md → website/src/content/docs/**/*.mdx
//
// Rewrites these intra-docs link forms:
//   ./00-foo.md            → /docs/<new-path>
//   ./00-foo.md#anchor     → /docs/<new-path>#anchor
//   (./XX-...)             → (/docs/<new-path>)
//
// Plus relative paths into the repo (../packages/foo/) → GitHub URLs.
// Plus repo-root README.md references handled where they appear.

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(REPO_ROOT, "docs");
const DST = path.resolve(__dirname, "../src/content/docs");
const GITHUB_TREE = "https://github.com/samchon/ttsc/tree/master";

const MAP = {
  "README.md": "index.mdx",
  "00-consumer-quickstart.md": "setup.mdx",
  "01-getting-started.md": "plugin-development/getting-started.mdx",
  "02-protocol.md": "plugin-development/protocol.mdx",
  "03-tsgo.md": "plugin-development/tsgo.mdx",
  "04-local-dev.md": "plugin-development/local-dev.mdx",
  "05-internals.md": "internals/architecture.mdx",
  "06-publishing.md": "plugin-development/publishing.mdx",
  "07-testing.md": "plugin-development/testing.mdx",
  "08-recipes.md": "plugin-development/recipes.mdx",
  "09-pitfalls.md": "plugin-development/pitfalls.mdx",
  "10-reference-plugins.md": "plugins/reference.mdx",
  "11-ttsx-runtime.md": "cli/ttsx.mdx",
  "12-workspace-release.md": "internals/workspace-release.mdx",
  "13-format-print-width.md": "lint/format-print-width.mdx",
  "14-prettier-migration.md": "lint/prettier-migration.mdx",
  "15-ttscserver.md": "cli/ttscserver.mdx",
  "16-vscode-extension.md": "editor/vscode.mdx",
};

function toRoute(mdxRel) {
  // plugin-development/getting-started.mdx → /docs/plugin-development/getting-started
  // index.mdx → /docs
  const noExt = mdxRel.replace(/\.mdx$/, "");
  if (noExt === "index") return "/docs";
  return `/docs/${noExt}`;
}

function rewriteContent(text, currentSourceName) {
  // 1) Intra-docs links: ./00-foo.md or 00-foo.md anywhere inside (./ ... )
  text = text.replace(
    /\.\/([\w-]+\.md)(#[\w-]+)?/g,
    (_match, file, anchor) => {
      const dst = MAP[file];
      if (!dst) return _match;
      return toRoute(dst) + (anchor || "");
    },
  );

  // 2) Bare README.md references (rare)
  text = text.replace(/\(README\.md\)/g, "(/docs)");

  // 3) Parent-directory references → absolute GitHub URLs
  //    (../packages/...) (../tests/...) (../config/...) (../scripts/...)
  text = text.replace(
    /\(\.\.\/((packages|tests|config|scripts|articles|assets|experimental)[^)\s]*)\)/g,
    (_match, p) => `(${GITHUB_TREE}/${p})`,
  );

  // 4) Drop leading "ttsc Guide Documents" h1 when present in README.md
  //    (replaced by frontmatter title in the migrated index page).
  if (currentSourceName === "README.md") {
    text = text.replace(/^#\s+ttsc Guide Documents\s*\n+/, "");
  }

  return text;
}

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function migrate() {
  fs.rmSync(DST, { recursive: true, force: true });
  fs.mkdirSync(DST, { recursive: true });

  for (const [src, dstRel] of Object.entries(MAP)) {
    const srcPath = path.join(SRC, src);
    const dstPath = path.join(DST, dstRel);
    if (!fs.existsSync(srcPath)) {
      console.warn(`[migrate-docs] missing source: ${src}`);
      continue;
    }
    let body = fs.readFileSync(srcPath, "utf8");
    body = rewriteContent(body, src);

    ensureDir(dstPath);
    fs.writeFileSync(dstPath, body, "utf8");
    console.log(`[migrate-docs] ${src} → ${dstRel}`);
  }
}

migrate();
