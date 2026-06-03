import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: ttsx keeps configured outDir untouched.
 *
 * Ttsx must never write to or delete the project's configured `outDir`. It uses
 * an explicit `--cache-dir` for compilation output so that a deployed `dist/`
 * tree survives a `ttsx` invocation without being overwritten or gaining extra
 * files like a `package.json` module type marker.
 *
 * 1. Create a project with an existing `dist/keep.txt` and a custom cache dir.
 * 2. Run ttsx with `--cache-dir`.
 * 3. Assert `dist/keep.txt` is unchanged, no `.js` or `package.json` appeared in
 *    `dist/`, and the per-run cache output was cleaned.
 */
export const test_runner_corpus_ttsx_keeps_configured_outdir_untouched = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ type: "module" }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        moduleResolution: "bundler",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "dist/keep.txt": "do-not-delete",
    "src/helper.ts": `export const message: string = "cache-only-run";\n`,
    "src/main.ts": `import { message } from "./helper";\nconsole.log(message);\n`,
  });
  const cacheDir = path.join(root, ".ttsx-cache");

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "cache-only-run");
  assert.equal(
    fs.readFileSync(path.join(root, "dist", "keep.txt"), "utf8"),
    "do-not-delete",
  );
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  assert.equal(fs.existsSync(path.join(root, "dist", "package.json")), false);
  const projectCache = path.join(cacheDir, "project");
  assert.equal(fs.existsSync(projectCache), true);
  assert.deepEqual(fs.readdirSync(projectCache), []);
};
