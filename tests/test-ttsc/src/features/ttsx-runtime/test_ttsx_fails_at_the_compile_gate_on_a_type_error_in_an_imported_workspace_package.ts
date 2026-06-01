import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx still fails at the compile gate on a type error inside an
 * imported workspace package.
 *
 * The runtime hooks are deliberately runtime-only: they must not weaken the
 * up-front type-check. ttsx's tsgo build deep-checks the whole program,
 * including workspace neighbours reached through imports, so a type error in a
 * symlinked workspace dependency must abort before the entry ever runs.
 *
 * 1. Create an ESM project plus a symlinked `ws-dep` whose source contains a type
 *    error, imported by the entry.
 * 2. Run ttsx against the entry.
 * 3. Assert it exits non-zero, names the dependency file, and prints no output.
 */
export const test_ttsx_fails_at_the_compile_gate_on_a_type_error_in_an_imported_workspace_package =
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
      "packages/ws-dep/package.json": JSON.stringify({
        name: "ws-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/ws-dep/src/index.ts": `const bad: number = "not a number";\nexport const hello = (): string => \`value-\${bad}\`;\n`,
      "src/main.ts": `import { hello } from "ws-dep";\nconsole.log(hello());\n`,
    });
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
    fs.symlinkSync(
      path.join(root, "packages", "ws-dep"),
      path.join(root, "node_modules", "ws-dep"),
      "junction",
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ws-dep[\\/]src[\\/]index\.ts/);
    assert.equal(result.stdout.trim(), "");
  };
