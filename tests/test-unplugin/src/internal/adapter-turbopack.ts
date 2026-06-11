import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Invoke the built turbopack loader entrypoint with a minimal fake of the
 * webpack loader context Turbopack provides (`async()`, `resourcePath`,
 * `getOptions()`), returning the content the loader hands to the callback.
 */
async function runTurbopackLoader(props: {
  resourcePath: string;
  source: string;
  options?: unknown;
}): Promise<string> {
  const loader = await TestUnpluginRuntime.loadUnpluginAdapter("turbopack");
  return new Promise<string>((resolve, reject) => {
    const context = {
      resourcePath: props.resourcePath,
      getOptions: () => props.options,
      async:
        () =>
        (error?: unknown, content?: string): void => {
          if (error !== undefined && error !== null) {
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
          }
          resolve(content ?? "");
        },
    };
    loader.call(context, props.source);
  });
}

/**
 * Asserts the loader transforms TypeScript source through the webpack loader
 * contract using the project's own tsconfig-declared plugins — the exact way
 * Turbopack invokes loaders registered in `turbopack.rules`.
 */
async function assertTurbopackLoaderTransformsSource(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const output = await runTurbopackLoader({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  });
  TestUnpluginProject.assertTransformedToPlugin(output);
}

/**
 * Asserts the rule's `options` object reaches the transform: a plugin list
 * passed through loader options must override the tsconfig-declared plugins,
 * here proven by the fixture's `go-prefix` operation reshaping the output.
 */
async function assertTurbopackLoaderForwardsRuleOptions(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const output = await runTurbopackLoader({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "A:" }],
    },
  });
  assert.match(output, /"A:plugin"/);
}

/**
 * Asserts the loader's own filter: declaration files and `node_modules` paths
 * pass through byte-for-byte. A broad `*.ts` rule glob routes everything with
 * the extension through the loader, so the loader must mirror the unplugin
 * adapters' `transformInclude` guard itself.
 */
async function assertTurbopackLoaderPassesThroughFilteredPaths(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const declaration = "declare const ambient: number;\n";
  const declarationOut = await runTurbopackLoader({
    resourcePath: path.join(root, "src", "ambient.d.ts"),
    source: declaration,
  });
  assert.equal(declarationOut, declaration);

  const vendored = 'export const value: string = goUpper("plugin");\n';
  const vendoredOut = await runTurbopackLoader({
    resourcePath: path.join(root, "node_modules", "pkg", "main.ts"),
    source: vendored,
  });
  assert.equal(vendoredOut, vendored);
}

export {
  assertTurbopackLoaderForwardsRuleOptions,
  assertTurbopackLoaderPassesThroughFilteredPaths,
  assertTurbopackLoaderTransformsSource,
};
