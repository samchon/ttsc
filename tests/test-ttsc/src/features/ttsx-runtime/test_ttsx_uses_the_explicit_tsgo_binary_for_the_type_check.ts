import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { spawnWithoutTsgoOverride } from "../../internal/toolchain";

/**
 * Verifies ttsx uses the `--binary` tsgo for the type-check.
 *
 * `--binary` overrides the tsgo the runner resolves for its `--noEmit` gate, so
 * a custom compiler or debug build governs the type-check. Emission is the
 * driver host's job (not the supplied binary's), so the override is honored for
 * checking and the program still runs from the driver-emitted source.
 *
 * 1. Create an ESM entry importing a raw-`.ts` dependency.
 * 2. Run ttsx with `--binary` pointing at a scripted fake tsgo and no installed
 *    native-preview package.
 * 3. Assert the fake binary ran the type-check and the program ran from source.
 */
export const test_ttsx_uses_the_explicit_tsgo_binary_for_the_type_check = () => {
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
    "node_modules/raw-dep/index.ts": `export const value = (): string => "explicit-binary-source";\n`,
  });
  const logFile = path.join(root, "fake-tsgo.log");
  const fakeTsgo = path.join(root, "fake-tsgo.cjs");
  fs.writeFileSync(
    fakeTsgo,
    [
      "#!/usr/bin/env node",
      'const fs = require("node:fs");',
      "const args = process.argv.slice(2);",
      `fs.appendFileSync(${JSON.stringify(logFile)}, args.join(" ") + "\\n");`,
      // The runner only type-checks through this binary; a no-op success is a
      // clean check with no diagnostics.
      'if (args.includes("--version")) { console.log("Version 7.0.0-dev.FAKE"); }',
      "process.exit(0);",
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
  assert.equal(result.stdout.trim(), "explicit-binary-source");
  assert.match(
    fs.readFileSync(logFile, "utf8"),
    /--noEmit/,
    "the explicit tsgo binary ran the type-check",
  );
};
