import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Invoke the built turbopack loader and return the transformed content, the
 * source map it handed back beside it, and the files it registered through the
 * webpack loader context's `addDependency(file)` — the channel that feeds
 * Turbopack's `fileDependencies` invalidation set — and, in
 * `contextDependencies`, the directories it registered through
 * `addContextDependency(directory)`, Turbopack's directory channel, which the
 * real loader context offers as well. The context's `rootContext` is the
 * project directory, the nearest ancestor of the module holding a
 * `tsconfig.json`, as Turbopack gives it. Setting `omitAddDependency` models a
 * minimal/older loader context that does not expose the method at all, proving
 * the loader stays optional about it. With `emitErrors`, the context offers
 * `emitError` as Turbopack's loader runtime does, and the errors the loader
 * emitted come back in `emitted`.
 */
export async function runTurbopackLoaderWithContext(props: {
  resourcePath: string;
  source: string;
  options?: unknown;
  omitAddDependency?: boolean;
  emitErrors?: boolean;
}): Promise<{
  cacheableCalls: boolean[];
  content: string;
  contextDependencies: string[];
  dependencies: string[];
  emitted: Error[];
  map?: unknown;
}> {
  const loader = await TestUnpluginRuntime.loadUnpluginAdapter("turbopack");
  const cacheableCalls: boolean[] = [];
  const contextDependencies: string[] = [];
  const dependencies: string[] = [];
  const emitted: Error[] = [];
  return new Promise<{
    cacheableCalls: boolean[];
    content: string;
    contextDependencies: string[];
    dependencies: string[];
    emitted: Error[];
    map?: unknown;
  }>((resolve, reject) => {
    const context: Record<string, unknown> = {
      resourcePath: props.resourcePath,
      rootContext: projectDirectory(props.resourcePath),
      getOptions: () => props.options,
      cacheable: function (this: unknown, flag: boolean): void {
        // Capture `this` binding: the loader must call cacheable bound to the
        // webpack loader context, not the transform hooks object.
        assert.equal(this, context, "cacheable lost its context binding");
        cacheableCalls.push(flag);
      },
      async:
        () =>
        (error?: unknown, content?: string, map?: unknown): void => {
          if (error !== undefined && error !== null) {
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
          }
          resolve({
            cacheableCalls,
            content: content ?? "",
            contextDependencies,
            dependencies,
            emitted,
            ...(map === undefined ? {} : { map }),
          });
        },
    };
    if (props.emitErrors === true) {
      context.emitError = function (this: unknown, error: Error): void {
        assert.equal(this, context, "emitError lost its context binding");
        emitted.push(error);
      };
    }
    if (props.omitAddDependency !== true) {
      context.addDependency = function (this: unknown, file: string): void {
        // Capture `this` binding: the loader must call addDependency bound to
        // the webpack loader context, not the transform hooks object.
        assert.equal(this, context, "addDependency lost its context binding");
        dependencies.push(file);
      };
      context.addContextDependency = function (
        this: unknown,
        directory: string,
      ): void {
        assert.equal(
          this,
          context,
          "addContextDependency lost its context binding",
        );
        contextDependencies.push(directory);
      };
    }
    loader.call(context, props.source);
  });
}

/** The nearest ancestor of `file` that holds a `tsconfig.json`. */
function projectDirectory(file: string): string {
  for (let directory = path.dirname(file); ; ) {
    if (fs.existsSync(path.join(directory, "tsconfig.json"))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) return path.dirname(file);
    directory = parent;
  }
}
