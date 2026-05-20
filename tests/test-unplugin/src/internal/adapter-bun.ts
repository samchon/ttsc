import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/** Minimal shape of the options object passed to `onLoad` in the Bun plugin API. */
type BunLoadOptions = { filter: RegExp };

/**
 * Minimal shape of a Bun load handler: receives a path and returns transformed
 * contents.
 */
type BunLoader = (args: { path: string }) => Promise<{ contents: string }>;

/**
 * Asserts that the Bun adapter registers an `onLoad` transformer whose filter
 * matches `.ts` source files and whose loader returns plugin-transformed
 * output.
 *
 * Stubs the Bun `setup` API so no real Bun runtime is required; loads the
 * adapter via `TestUnpluginRuntime.loadUnpluginAdapter("bun")`.
 */
async function assertBunAdapterTransformsSource() {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject();
  const loaders: { loader: BunLoader; options: BunLoadOptions }[] = [];
  unpluginBun().setup({
    onLoad(options: BunLoadOptions, loader: BunLoader) {
      loaders.push({ loader, options });
    },
  });

  const registration = loaders[0];
  assert.ok(registration);
  const { loader, options } = registration;
  if (!options.filter.test(TestUnpluginProject.mainFile(root))) {
    throw new Error("Bun adapter did not register a TypeScript source filter");
  }
  const result = await loader({ path: TestUnpluginProject.mainFile(root) });
  TestUnpluginProject.assertTransformedToPlugin(result.contents);
}

export { assertBunAdapterTransformsSource };
