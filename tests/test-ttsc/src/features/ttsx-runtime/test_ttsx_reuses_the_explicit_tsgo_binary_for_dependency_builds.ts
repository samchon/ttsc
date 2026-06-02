import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { spawnWithoutTsgoOverride } from "../../internal/toolchain";

/**
 * Verifies ttsx reuses the explicit tsgo binary for dependency builds.
 *
 * The entry compile gate accepts `--binary`, but raw-`.ts` dependencies compile
 * later inside the runtime hook. That second build must inherit the same tsgo
 * binary, otherwise a custom compiler/debug build works for the entry and then
 * fails or changes behavior for the first dependency loaded at runtime.
 *
 * 1. Create an ESM entry importing a raw-`.ts` dependency.
 * 2. Run ttsx with `--binary` pointing at a scripted fake tsgo and no installed
 *    native-preview package.
 * 3. Assert both the entry and dependency were emitted by that same binary.
 */
export const test_ttsx_reuses_the_explicit_tsgo_binary_for_dependency_builds =
  () => {
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
      "src/main.ts": `import { value } from "raw-dep";\nconsole.log(value());\n`,
      "node_modules/raw-dep/package.json": JSON.stringify({
        name: "raw-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/raw-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "lib",
          rootDir: ".",
        },
        include: ["index.ts"],
      }),
      "node_modules/raw-dep/index.ts": `export const value = (): string => "source-should-not-run";\n`,
    });
    const logFile = path.join(root, "fake-tsgo.log");
    const fakeTsgo = path.join(root, "fake-tsgo.cjs");
    fs.writeFileSync(
      fakeTsgo,
      [
        "#!/usr/bin/env node",
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        "const args = process.argv.slice(2);",
        `fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({ cwd: process.cwd(), args }) + "\\n");`,
        'const outDirAt = args.indexOf("--outDir");',
        'const outDir = outDirAt >= 0 ? args[outDirAt + 1] : path.join(process.cwd(), "dist");',
        'if (process.cwd().endsWith(path.join("node_modules", "raw-dep"))) {',
        '  const out = path.join(outDir, "index.js");',
        "  fs.mkdirSync(path.dirname(out), { recursive: true });",
        '  fs.writeFileSync(out, "export const value = () => \\"explicit-binary-dependency\\";\\n", "utf8");',
        "} else {",
        '  const out = path.join(outDir, "main.js");',
        "  fs.mkdirSync(path.dirname(out), { recursive: true });",
        '  fs.writeFileSync(out, "import { value } from \\"raw-dep\\";\\nconsole.log(value());\\n", "utf8");',
        "}",
      ].join("\n"),
      "utf8",
    );
    fs.chmodSync(fakeTsgo, 0o755);

    const result = spawnWithoutTsgoOverride(
      TestProject.TTSX_BIN,
      ["--binary", fakeTsgo, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "explicit-binary-dependency");

    const invocations = fs
      .readFileSync(logFile, "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as { cwd: string });
    assert.equal(invocations.length, 2);
    assert.deepEqual(
      invocations.map((entry) => path.relative(root, entry.cwd) || "."),
      [".", path.join("node_modules", "raw-dep")],
    );
  };
