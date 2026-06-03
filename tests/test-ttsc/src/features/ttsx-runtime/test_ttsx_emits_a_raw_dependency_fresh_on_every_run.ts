import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies `ttsx` emits a raw `.ts` dependency fresh on every run.
 *
 * Like ts-node, the runner compiles each TypeScript source on demand through a
 * persistent per-run host rather than into a durable on-disk cache. There is no
 * dependency cache to grow stale: an unchanged source always yields the same
 * output, and an edit is reflected on the very next run with no invalidation
 * step to get wrong.
 *
 * 1. Run once and assert the original value prints.
 * 2. Run again unchanged and assert the same value prints.
 * 3. Edit the dependency's source and assert the new value prints next run.
 */
export const test_ttsx_emits_a_raw_dependency_fresh_on_every_run = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ type: "module", private: true }),
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
    "node_modules/cache-dep/package.json": JSON.stringify({
      name: "cache-dep",
      version: "1.0.0",
      type: "module",
      exports: { ".": "./src/index.ts" },
    }),
    "node_modules/cache-dep/src/index.ts": `export const value = (): string => "v1";\n`,
    "src/main.ts": `import { value } from "cache-dep";\nconsole.log(value());\n`,
  });

  const run = () =>
    TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
      cwd: root,
    });

  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout.trim(), "v1");

  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout.trim(), "v1");

  fs.writeFileSync(
    path.join(root, "node_modules", "cache-dep", "src", "index.ts"),
    `export const value = (): string => "v2";\n`,
  );

  const third = run();
  assert.equal(third.status, 0, third.stderr);
  assert.equal(third.stdout.trim(), "v2");
};
