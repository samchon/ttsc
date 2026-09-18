import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { captureBunLoader } from "./captureBunLoader";

/**
 * Asserts excluded files and no-op transforms fall through to Bun's next
 * loader.
 *
 * Bun stops at the first `onLoad` callback that returns a value. The adapter's
 * broad TypeScript filter therefore must consult the shared `transformInclude`
 * predicate before reading and return `undefined` when the path is excluded or
 * the transform produced no code.
 */
export async function assertBunAdapterFallsThroughWhenItDoesNotTransform(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const { loader } = await captureBunLoader(
    unpluginBun({
      plugins: [],
    }),
    "bundler",
  );

  assert.equal(
    await loader({
      path: path.join(
        TestUnpluginProject.createProject(),
        "node_modules",
        "missing",
        "index.ts",
      ),
    }),
    undefined,
    "an excluded path must not be read or claim the loader chain",
  );

  const root = TestUnpluginProject.createProject({ plugins: [] });
  assert.equal(
    await loader({ path: TestUnpluginProject.mainFile(root) }),
    undefined,
    "a no-op transform must fall through to Bun's built-in TypeScript loader",
  );
}
