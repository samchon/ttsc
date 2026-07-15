// Shared scratch-overlay helpers for the lint Go runners (test-go-lint.cjs,
// test-go-coverage.cjs, bench-go-lint.cjs).
//
// Each runner copies `packages/lint/` into a scratch dir, then flattens every
// Go test file under `packages/lint/test/` next to the linthost library sources
// so the tests can reach unexported linthost-package internals. Keeping the
// flatten logic here means the collision guard lives in one place instead of
// three copies that can silently drift apart (issues #622/#624).

const fs = require("node:fs");
const path = require("node:path");

// copyGoTestsFlat flattens every `.go` file under sourceDir into targetDir.
//
// targetDir already holds the linthost library sources (the caller cpSync'd
// `packages/lint` into scratch first), so a test file whose basename matches a
// library source — `engine.go`, `config.go`, `lsp.go`, … — would silently
// overwrite it and produce an inexplicable compile error. Seeding `seen` with
// the basenames already present in targetDir turns that collision, and any
// test-vs-test basename clash, into a loud named error instead of a silent
// overwrite (issue #624).
function copyGoTestsFlat(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const seen = new Set(existingGoBasenames(targetDir));
  for (const file of walkForGoFiles(sourceDir)) {
    const basename = path.basename(file);
    if (seen.has(basename)) {
      throw new Error(
        `lint Go test overlay collision: ${basename} (from ${file}) would ` +
          `overwrite a same-named file already in ${targetDir} (a linthost ` +
          `library source or another test file). Rename the test file.`,
      );
    }
    seen.add(basename);
    fs.copyFileSync(file, path.join(targetDir, basename));
  }
}

// existingGoBasenames lists the `.go` filenames already materialized in dir.
// Only direct children matter: the library sources sit at the linthost package
// root, which is exactly where the flattened test files land.
function existingGoBasenames(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".go"))
    .map((entry) => entry.name);
}

// walkForGoFiles returns every `.go` file under dir, sorted for a deterministic
// copy order so a collision is reported against a stable "first writer".
function walkForGoFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...walkForGoFiles(file));
    } else if (entry.isFile() && entry.name.endsWith(".go")) {
      out.push(file);
    }
  }
  return out.sort();
}

module.exports = { copyGoTestsFlat, walkForGoFiles };
