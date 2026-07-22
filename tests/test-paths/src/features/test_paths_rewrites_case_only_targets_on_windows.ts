import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestPaths } from "../internal/TestPaths";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies paths: Windows aliases use the compiler host's file identity.
 *
 * The plugin used case-preserving map keys after tsgo had already accepted a
 * case-only target, leaving the alias in emitted JavaScript. Source lookup must
 * canonicalize every exact, extension, and index candidate with the host rule.
 *
 * 1. Create lowercase sources and uppercase exact and extensionless aliases.
 * 2. Compile the project through the real Windows ttsc and paths plugin.
 * 3. Assert every alias becomes the relative emitted JavaScript path.
 */
export const test_paths_rewrites_case_only_targets_on_windows = () => {
  if (process.platform !== "win32") return;

  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        forceConsistentCasingInFileNames: false,
        paths: {
          "@exact": ["./SRC/EXACT.TS"],
          "@extensionless": ["./SRC/EXTENSIONLESS"],
          "@explicit": ["./SRC/EXPLICIT.TS"],
          "@directory": ["./SRC/DIRECTORY"],
        },
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@ttsc/paths" }],
      },
      include: ["src"],
    }),
    "src/exact.ts": `export const exact = "exact";\n`,
    "src/extensionless.ts": `export const extensionless = "extensionless";\n`,
    "src/explicit.ts": `export const explicit = "explicit";\n`,
    "src/directory/index.ts": `export const directory = "directory";\n`,
    "src/main.ts": [
      `import { exact } from "@exact";`,
      `import { extensionless } from "@extensionless";`,
      `import { explicit } from "@explicit";`,
      `import { directory } from "@directory";`,
      `export const value = exact + extensionless + explicit + directory;`,
      ``,
    ].join("\n"),
  });
  TestPaths.seedPackage(root);

  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestPaths.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);

  const output = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  for (const alias of ["@exact", "@extensionless", "@explicit", "@directory"])
    assert.doesNotMatch(output, new RegExp(alias));
  assert.match(output, /require\("\.\/exact\.js"\)/i);
  assert.match(output, /require\("\.\/extensionless\.js"\)/i);
  assert.match(output, /require\("\.\/explicit\.js"\)/i);
  assert.match(output, /require\("\.\/directory\/index\.js"\)/i);
};
