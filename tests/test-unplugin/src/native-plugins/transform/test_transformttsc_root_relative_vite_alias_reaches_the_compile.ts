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
