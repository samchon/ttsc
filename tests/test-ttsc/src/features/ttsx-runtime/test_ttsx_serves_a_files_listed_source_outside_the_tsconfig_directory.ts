import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx serves a `files`-listed source that lives outside the tsconfig
 * directory, under a wide `rootDir`.
 *
 * `@ttsc/lint` evaluates a user `*.config.ts` by writing a loader and a
 * synthetic tsconfig with the volume root as `rootDir` (`/` on POSIX, `C:/` on
 * Windows — a literal `/` is not an ancestor of drive-letter paths, #299) and
 * `files: [loader, config]`, so the config — anywhere on the volume — is part
 * of the build. The runtime hooks must serve such a file from the build's emit
 * (here as an ES module, `module: ESNext`), not type-strip it. The bound is the
 * project's `rootDir`; a root `rootDir` must still include everything (a naive
 * separator append yields `//`, which matches nothing).
 *
 * 1. Create a loader and a config in different directories, with a tsconfig whose
 *    `rootDir` is the volume root and whose `files` lists both by absolute
 *    path.
 * 2. Run ttsx on the loader; it dynamically imports the config and prints it.
 * 3. Assert the config's value round-tripped (it was served, not mis-loaded as
 *    CommonJS where its `export default` would throw).
 */
export const test_ttsx_serves_a_files_listed_source_outside_the_tsconfig_directory =
  () => {
    const root = TestProject.createProject({
      "config/app.config.ts": `export default { token: "config-served-from-emit" };\n`,
      "loader/run.ts": [
        `declare const process: { stdout: { write(text: string): void } };`,
        `const main = async (): Promise<void> => {`,
        `  const mod: { default?: unknown } = await import(`,
        `    "../config/app.config.ts"`,
        `  );`,
        `  process.stdout.write(JSON.stringify(mod.default ?? mod));`,
        `};`,
        `void main();`,
        ``,
      ].join("\n"),
    });
    fs.writeFileSync(
      path.join(root, "loader", "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          allowImportingTsExtensions: true,
          module: "ESNext",
          moduleResolution: "bundler",
          outDir: path.join(root, "loader", "out"),
          rewriteRelativeImportExtensions: true,
          rootDir: path.parse(root).root.replace(/\\/g, "/"),
          skipLibCheck: true,
          strict: false,
          target: "ES2022",
        },
        files: [
          path.join(root, "loader", "run.ts"),
          path.join(root, "config", "app.config.ts"),
        ],
      }),
      "utf8",
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      [
        "--project",
        path.join(root, "loader", "tsconfig.json"),
        "--cwd",
        path.join(root, "loader"),
        "--no-plugins",
        path.join(root, "loader", "run.ts"),
      ],
      { cwd: path.join(root, "loader") },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      token: "config-served-from-emit",
    });
  };
