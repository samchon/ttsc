import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Runtime import helpers for the built `@ttsc/metro` package.
 *
 * Tests load the compiled ESM output through file URLs so they validate the
 * package exactly as Node loads it after a build — the same approach the
 * `@ttsc/unplugin` suite uses for its adapters.
 */
export namespace TestMetroRuntime {
  /** Resolve a built entrypoint under `packages/metro/lib`. */
  export function libPath(entry: string, extension: "js" | "mjs"): string {
    return path.resolve(
      TestProject.WORKSPACE_ROOT,
      "packages/metro/lib",
      `${entry}.${extension}`,
    );
  }

  /** Convert a built ESM entrypoint into a dynamic-importable file URL. */
  export function libUrl(entry: string): string {
    return pathToFileURL(libPath(entry, "mjs")).href;
  }

  /** Load the package entry (`withTtsc`, types). */
  export async function loadIndex(): Promise<any> {
    return import(libUrl("index"));
  }

  /**
   * Load the internal options module (`serializeOptions`,
   * `resolveOptionsFromEnv`, `ENV_KEY`).
   */
  export async function loadOptions(): Promise<any> {
    return import(libUrl("core/options"));
  }

  // The transformer keeps module-level singletons (resolved options + transform
  // cache), exactly as Metro loads it once per worker. To exercise distinct
  // option sets across cases, each load is cache-busted with a unique query so
  // the test gets a fresh module instance.
  let freshCounter = 0;

  /**
   * Load a fresh instance of the transformer module (`transform`,
   * `getCacheKey`).
   */
  export async function loadFreshTransformer(): Promise<any> {
    freshCounter += 1;
    return import(`${libUrl("transformer")}?case=${freshCounter}`);
  }

  let fakeUpstreamPath: string | undefined;

  /**
   * Write (once) a fake upstream Metro transformer and return its absolute
   * path.
   *
   * The fake echoes everything it receives back inside the returned `ast`, so a
   * test can assert exactly what the ttsc stage handed downstream (the original
   * source for pass-through files, the plugin-transformed source otherwise)
   * without needing a real Babel/Expo transformer.
   */
  export function fakeUpstreamPathOnDisk(): string {
    if (fakeUpstreamPath !== undefined) {
      return fakeUpstreamPath;
    }
    const dir = TestProject.tmpdir("ttsc-metro-upstream-");
    const file = path.join(dir, "upstream.cjs");
    fs.writeFileSync(
      file,
      [
        "exports.transform = async function (params) {",
        "  return {",
        "    ast: {",
        "      __fakeUpstream: true,",
        "      src: params.src,",
        "      filename: params.filename,",
        "      options: params.options,",
        "      plugins: params.plugins,",
        "    },",
        "  };",
        "};",
        'exports.getCacheKey = function () { return "fake-upstream-cache-key"; };',
        "",
      ].join("\n"),
      "utf8",
    );
    fakeUpstreamPath = file;
    return file;
  }

  /**
   * Set the worker-env options, load a fresh transformer, run one transform,
   * and always restore the previous env. Mirrors how Metro invokes the
   * transformer with worker-side options coming from {@link withTtsc}.
   */
  export async function runTransform(props: {
    options: Record<string, unknown>;
    params: {
      src: string;
      filename: string;
      options?: Record<string, unknown>;
      [key: string]: unknown;
    };
  }): Promise<{ ast: Record<string, unknown> }> {
    const { ENV_KEY, serializeOptions } = await loadOptions();
    const previous = process.env[ENV_KEY];
    process.env[ENV_KEY] = serializeOptions(props.options);
    try {
      const mod = await loadFreshTransformer();
      return await mod.transform({ options: {}, ...props.params });
    } finally {
      if (previous === undefined) {
        delete process.env[ENV_KEY];
      } else {
        process.env[ENV_KEY] = previous;
      }
    }
  }
}
