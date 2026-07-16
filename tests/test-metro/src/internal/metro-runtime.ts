import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Runtime import helpers for the built `@ttsc/metro` package.
 *
 * Tests load the compiled ESM output through file URLs so they validate the
 * package exactly as Node loads it after a build, the same approach the
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

  /** Load the internal upstream-resolution module. */
  export async function loadUpstream(): Promise<any> {
    return import(libUrl("core/upstream"));
  }

  /**
   * Load the internal fingerprint module (`prepareSnapshot`,
   * `computeProjectFingerprint`, `readSnapshotState`).
   */
  export async function loadFingerprint(): Promise<any> {
    return import(libUrl("core/fingerprint"));
  }

  // The transformer keeps module-level singletons (resolved options + transform
  // cache), exactly as Metro loads it once per worker. To exercise distinct
  // option sets across cases, each load is cache-busted with a unique query so
  // the test gets a fresh module instance.
  let freshCounter = 0;

  /**
   * Load a fresh instance of the transformer module (`transform`,
   * `getCacheKey`, …).
   */
  export async function loadFreshTransformer(): Promise<any> {
    freshCounter += 1;
    return import(`${libUrl("transformer")}?case=${freshCounter}`);
  }

  let fakeUpstreamPath: string | undefined;
  let fakeUpstreamNoCacheKeyPath: string | undefined;

  /**
   * Write (once) a fake upstream Metro transformer and return its absolute
   * path.
   *
   * `transform` echoes everything it receives back inside the returned `ast`,
   * so a test can assert exactly what the ttsc stage handed downstream.
   * `getCacheKey` echoes its forwarded arguments, so a test can prove the args
   * (e.g. `projectRoot`) reach the upstream key.
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
        "exports.getCacheKey = function (...args) {",
        '  return "fake-upstream:" + JSON.stringify(args[0] ?? null);',
        "};",
        "",
      ].join("\n"),
      "utf8",
    );
    fakeUpstreamPath = file;
    return file;
  }

  /**
   * A fake upstream that exports `transform` only (no `getCacheKey`), to
   * exercise the branch where the upstream contributes no cache key.
   */
  export function fakeUpstreamWithoutCacheKeyOnDisk(): string {
    if (fakeUpstreamNoCacheKeyPath !== undefined) {
      return fakeUpstreamNoCacheKeyPath;
    }
    const dir = TestProject.tmpdir("ttsc-metro-upstream-nokey-");
    const file = path.join(dir, "upstream.cjs");
    fs.writeFileSync(
      file,
      [
        "exports.transform = async function (params) {",
        "  return { ast: { __fakeUpstream: true, src: params.src } };",
        "};",
        "",
      ].join("\n"),
      "utf8",
    );
    fakeUpstreamNoCacheKeyPath = file;
    return file;
  }

  let fakeUpstreamThrowingCacheKeyPath: string | undefined;

  /**
   * A fake upstream whose `getCacheKey` throws, to exercise the inner catch in
   * `upstreamCacheKey` (a throwing upstream key must not crash cache keying).
   */
  export function fakeUpstreamThrowingCacheKeyOnDisk(): string {
    if (fakeUpstreamThrowingCacheKeyPath !== undefined) {
      return fakeUpstreamThrowingCacheKeyPath;
    }
    const dir = TestProject.tmpdir("ttsc-metro-upstream-throw-");
    const file = path.join(dir, "upstream.cjs");
    fs.writeFileSync(
      file,
      [
        "exports.transform = async function (params) {",
        "  return { ast: { __fakeUpstream: true, src: params.src } };",
        "};",
        "exports.getCacheKey = function () {",
        '  throw new Error("upstream getCacheKey boom");',
        "};",
        "",
      ].join("\n"),
      "utf8",
    );
    fakeUpstreamThrowingCacheKeyPath = file;
    return file;
  }

  let throwingUpstreamPath: string | undefined;
  let missingDepUpstreamPath: string | undefined;

  /**
   * A fake upstream module that throws while initializing (a top-level
   * `throw`), modelling an installed transformer that rejects the current
   * runtime ABI. Its resolution succeeds, so the loader must classify it as a
   * broken module, not as an absent candidate.
   */
  export function throwingUpstreamOnDisk(): string {
    if (throwingUpstreamPath !== undefined) {
      return throwingUpstreamPath;
    }
    const dir = TestProject.tmpdir("ttsc-metro-upstream-broken-");
    const file = path.join(dir, "upstream.cjs");
    fs.writeFileSync(
      file,
      'throw new Error("upstream dependency ABI mismatch");\n',
      "utf8",
    );
    throwingUpstreamPath = file;
    return file;
  }

  /**
   * A fake upstream module that resolves but `require`s a transitive dependency
   * that is not installed, so loading it throws `MODULE_NOT_FOUND` for that
   * dependency — never for the candidate itself. The loader must report the
   * dependency failure rather than claiming the candidate is absent.
   */
  export function missingDependencyUpstreamOnDisk(): string {
    if (missingDepUpstreamPath !== undefined) {
      return missingDepUpstreamPath;
    }
    const dir = TestProject.tmpdir("ttsc-metro-upstream-missingdep-");
    const file = path.join(dir, "upstream.cjs");
    fs.writeFileSync(
      file,
      'require("@@ttsc-metro-absent-transitive-dependency@@");\n',
      "utf8",
    );
    missingDepUpstreamPath = file;
    return file;
  }

  /**
   * Set the worker-env options, load a fresh transformer, run `body`, and
   * always restore the previous env. Used by transform and cache-key tests that
   * need a worker scoped to a specific option set.
   */
  export async function withTransformerEnv(
    options: Record<string, unknown>,
    body: (mod: any) => unknown,
  ): Promise<any> {
    const { ENV_KEY, serializeOptions } = await loadOptions();
    const previous = process.env[ENV_KEY];
    process.env[ENV_KEY] = serializeOptions(options);
    try {
      const mod = await loadFreshTransformer();
      return await body(mod);
    } finally {
      if (previous === undefined) {
        delete process.env[ENV_KEY];
      } else {
        process.env[ENV_KEY] = previous;
      }
    }
  }

  /**
   * Convenience over {@link withTransformerEnv}: run one transform and return
   * its result.
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
    return withTransformerEnv(props.options, (mod) =>
      mod.transform({ options: {}, ...props.params }),
    );
  }
}
