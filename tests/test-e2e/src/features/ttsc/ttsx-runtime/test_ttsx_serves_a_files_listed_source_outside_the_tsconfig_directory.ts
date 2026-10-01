import { FixtureFiles } from "../../../internal/FixtureFiles";
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
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx loads an absolute files-listed config outside the tsconfig directory and prints its exact default token, detecting incorrect emit ownership or module classification.
 * @evidence contracts/testing.md#independent-expectations The authored config exports literal config-served-from-emit; parsed JSON must equal that literal object independently of emitted paths.
 * @evidence contracts/testing.md#distinguishing-cases The files list crosses the config-directory boundary under the actual volume root, with ESM and rewritten .ts imports. Same-name and twin-extension ownership have separate tests.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns one actual launcher with explicit project/cwd/no-plugins and a dynamic config import.
 * @evidence contracts/e2e.md#necessary-boundary Absolute compiler files and rootDir emission must map back into runtime loading across directories. Direct ownership units cannot certify the native compiler-to-Node mapping.
 * @evidence contracts/e2e.md#shared-execution One loader/config workspace and host cover this volume-root boundary; source compilation and import share that preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity path.parse(root).root supplies the native volume spelling. Inputs remain immutable and synchronous completion precedes tracked cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original zero status and complete parsed default-config object remain here; direct ownership units complement this real emission/loading connection.
 */
export function test_ttsx_serves_a_files_listed_source_outside_the_tsconfig_directory() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_serves_a_files_listed_source_outside_the_tsconfig_directory/inputs-1"));
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
  }
