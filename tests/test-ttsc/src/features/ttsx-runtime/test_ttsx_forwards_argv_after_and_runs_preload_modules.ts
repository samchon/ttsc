import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx forwards argv after -- and runs preload modules.
 *
 * `-r`/`--require` tells ttsx to load modules before the entry, similar to
 * `node -r`. Arguments after `--` must be forwarded verbatim to the entry's
 * `process.argv`. Both behaviours must compose: preloads run first, then the
 * entry receives the argv tail.
 *
 * 1. Create a CJS preload that sets a global flag and an entry that reads it.
 * 2. Run ttsx with `-r ./preload.cjs <entry> -- --flag value`.
 * 3. Assert the entry sees both the preload global and the forwarded argv.
 */
export const test_ttsx_forwards_argv_after_and_runs_preload_modules = () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "preload.cjs": `globalThis.__ttsxPreload = "loaded";\n`,
    "src/main.ts": `
      declare const process: { argv: string[] };
      console.log(JSON.stringify({
        preload: (globalThis as any).__ttsxPreload,
        argv: process.argv.slice(2),
      }));
    `,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    [
      "--cwd",
      root,
      "-r",
      "./preload.cjs",
      "src/main.ts",
      "--",
      "--flag",
      "value",
    ],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    preload: "loaded",
    argv: ["--flag", "value"],
  });
};
