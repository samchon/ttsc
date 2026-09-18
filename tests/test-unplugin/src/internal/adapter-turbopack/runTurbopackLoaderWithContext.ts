import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Invoke the built turbopack loader and return both the transformed content and
 * the files it registered through the webpack loader context's
 * `addDependency(file)` — the channel that feeds Turbopack's `fileDependencies`
 * invalidation set. Setting `omitAddDependency` models a minimal/older loader
 * context that does not expose the method at all, proving the loader stays
 * optional about it.
 */
export async function runTurbopackLoaderWithContext(props: {
  resourcePath: string;
  source: string;
  options?: unknown;
  omitAddDependency?: boolean;
}): Promise<{
  cacheableCalls: boolean[];
  content: string;
  dependencies: string[];
}> {
  const loader = await TestUnpluginRuntime.loadUnpluginAdapter("turbopack");
  const cacheableCalls: boolean[] = [];
  const dependencies: string[] = [];
  return new Promise<{
    cacheableCalls: boolean[];
    content: string;
    dependencies: string[];
  }>((resolve, reject) => {
    const context: Record<string, unknown> = {
      resourcePath: props.resourcePath,
      getOptions: () => props.options,
      cacheable: function (this: unknown, flag: boolean): void {
        // Capture `this` binding: the loader must call cacheable bound to the
        // webpack loader context, not the transform hooks object.
        assert.equal(this, context, "cacheable lost its context binding");
        cacheableCalls.push(flag);
      },
      async:
        () =>
        (error?: unknown, content?: string): void => {
          if (error !== undefined && error !== null) {
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
          }
          resolve({ cacheableCalls, content: content ?? "", dependencies });
        },
    };
    if (props.omitAddDependency !== true) {
      context.addDependency = function (this: unknown, file: string): void {
        // Capture `this` binding: the loader must call addDependency bound to
        // the webpack loader context, not the transform hooks object.
        assert.equal(this, context, "addDependency lost its context binding");
        dependencies.push(file);
      };
    }
    loader.call(context, props.source);
  });
}
