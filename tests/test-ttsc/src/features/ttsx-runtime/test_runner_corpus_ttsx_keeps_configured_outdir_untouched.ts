import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: ttsx keeps configured outDir untouched.
 *
 * This ttsx runner corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
  assert.equal(fs.existsSync(path.join(cacheDir, "project")), true);
};
