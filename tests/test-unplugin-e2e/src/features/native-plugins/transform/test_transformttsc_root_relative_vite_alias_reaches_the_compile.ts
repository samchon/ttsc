import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a root-relative Vite alias reaches the compile as the root's
 * directory, over a tsconfig mapping for the same key (samchon/ttsc#1399).
 *
 * The project maps `@/*` to `./src/*`, and Vite maps `@` to `/src`. Both mean
 * the root's `src`. The adapter read `/src` as the filesystem root, and its
 * overlay, which lets aliases win, replaced the project's correct mapping with
 * that wrong one, so a project that type-checked with `tsc` failed under the
 * adapter.
 *
 * 1. Declare `@/*` in the tsconfig and pass Vite's `{ "@": "/src" }` with its
 *    root.
 * 2. Transform through a fixture that reads the generated tsconfig.
 * 3. Assert the first `@` target is the root's `src`.
 *
 * @evidence contracts/testing.md#behavioral-verification Assert-paths fixture returns PLUGIN only when root-relative /src alias overlays @/* with actual project src.
 * @evidence contracts/testing.md#independent-expectations Configured expected root/src is independent of generated overlay; fixture reads overlay delivered to native compiler.
 * @evidence contracts/testing.md#distinguishing-cases Existing tsconfig mapping and Vite root-relative replacement for same alias.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_root_relative_vite_alias_reaches_the_compile is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built public transformation invokes actual config discovery/overlay and native compiler or fixture plugin. The assertions establish that the selected config/alias reaches that producer, beyond portable option calculations.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API serve this entry's transformations; related repeats reuse configuration/artifact setup. Changed source/options need separate producer calls only for the distinctions above. Portable option policy is not claimed as a separate native boundary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Assert-paths fixture returns PLUGIN only when root-relative /src alias overlays @/* with actual project src. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_root_relative_vite_alias_reaches_the_compile(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = fs.realpathSync.native(
    TestUnpluginProject.createProject({ plugins: [] }),
  );
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.paths = { "@/*": ["./src/*"] };
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2));
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "assert-paths",
        key: "@",
        target: path.join(root, "src").replace(/\\/g, "/"),
      },
    ],
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    [{ find: "@", replacement: "/src", root }],
  );
  assert.ok(result, "the generated paths must send @ to the root's src");
  assert.match(result.code, /"PLUGIN"/);
}
