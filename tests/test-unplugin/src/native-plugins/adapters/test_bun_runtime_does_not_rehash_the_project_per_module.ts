import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureBunLoader } from "../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies Bun's runtime-only plugin shape keeps one immutable generation for
 * the process-scoped module-loading session.
 *
 * `Bun.plugin()` exposes `onLoad` but no `onStart`. One setup invocation is one
 * process-scoped module-loading session, so the adapter must start a build
 * scope during setup rather than leave the shared cache in persistent mode.
 */
export async function test_bun_runtime_does_not_rehash_the_project_per_module(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "echo-file",
        path: "src/secondary.ts",
      },
    ],
  });
  const secondary = path.join(root, "src", "secondary.ts");
  fs.writeFileSync(secondary, "export const secondary = 1;\n", "utf8");
  const { loader } = await captureBunLoader(unpluginBun());

  const first = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(first);

  // A persistent-validation cache would observe this unrelated input change
  // and reject the next lazy module. Runtime setup deliberately fences one
  // immutable module-loading session, so the already compiled lazy output
  // remains deliverable without a project-wide validation pass.
  fs.writeFileSync(
    TestUnpluginProject.mainFile(root),
    "export const broken = true;\n",
    "utf8",
  );
  const lazy = await loader({ path: secondary });
  assert.ok(lazy);
  assert.match(lazy.contents, /secondary = 1/);
}
