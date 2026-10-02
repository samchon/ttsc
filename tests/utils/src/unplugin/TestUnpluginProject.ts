import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { TestProject } from "../TestProject";
import { materializeSharedSource as publishSharedSource } from "./materializeSharedSource";

/**
 * Fixture builder for unplugin adapter and transform tests.
 *
 * The generated project contains a TypeScript entrypoint, a tsconfig plugin
 * descriptor, and a tiny Go source transformer. That lets tests exercise the
 * same native source-plugin path that real bundler integrations use.
 */
export namespace TestUnpluginProject {
  let sharedGoPluginRoot: string | undefined;

  /**
   * Options for the synthetic project used by unplugin transform scenarios.
   *
   * `plugins` overrides the default single-plugin descriptor so individual
   * tests can vary plugin ordering, config fields, or the absence of plugins.
   * `source` overrides the TypeScript entrypoint written to `src/main.ts`.
   */
  interface ICreateProjectOptions {
    plugins?: unknown[];
    source?: string;
    /** Private ancestry for tests observing unresolved package candidates. */
    temporaryParent?: string;
  }

  /** Require function scoped to the unplugin package under test. */
  export const REQUIRE_FROM_UNPLUGIN = createRequire(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "unplugin",
      "package.json",
    ),
  );

  // transformTtsc() runs in-process, so seed the same tsgo override that the
  // spawn-based helpers pass explicitly through child-process environments.
  process.env.TTSC_TSGO_BINARY ??= resolveTsgoBinary();
  let sharedCacheDir: string | undefined;

  /**
   * Create a temporary project that transforms `goUpper("...")` through a Go
   * plugin descriptor. Callers can override plugin config or source text to
   * probe adapter-specific behavior without duplicating fixture setup.
   */
  export function createProject(options: ICreateProjectOptions = {}) {
    ensureSharedCacheDir();
    const root = TestProject.tmpdir("ttsc-unplugin-", options.temporaryParent);
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      mainFile(root),
      options.source ??
        'export const value: string = goUpper("plugin");\nconsole.log(value);\n',
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ private: true, type: "commonjs" }, null, 2),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            rootDir: "src",
            outDir: "dist",
            plugins:
              options.plugins === undefined
                ? [{ transform: "./plugin.cjs", name: "fixture" }]
                : options.plugins,
          },
          include: ["src"],
        },
        null,
        2,
      ),
      "utf8",
    );
    writePluginEntry(root);
    return root;
  }

  /**
   * Set `TTSC_CACHE_DIR` once for the process lifetime so Go plugin builds are
   * shared across test cases. Skipped when the caller has already set the env
   * var (e.g. from a parent test runner that manages its own cache dir).
   * Exported for fixture builders that do not go through {@link createProject}
   * (the Vite serve scenarios), which would otherwise rebuild the native
   * compiler host into every fixture's own `node_modules/.cache`.
   */
  export function ensureSharedCacheDir(): void {
    if (process.env.TTSC_CACHE_DIR !== undefined) {
      return;
    }
    sharedCacheDir ??= TestProject.sharedPluginCache();
    process.env.TTSC_CACHE_DIR = sharedCacheDir;
  }

  /**
   * Publish a generated fixture under an immutable content-addressed path.
   *
   * Every process writes a private sibling first, then atomically renames the
   * complete directory. A concurrent publisher either wins the rename or sees
   * the same digest already present, so no compiler can observe a truncated Go
   * source while another test process is materializing it.
   */
  export function materializeSharedSource(
    label: string,
    write: (directory: string) => void,
  ): string {
    return publishSharedSource(
      path.join(
        TestProject.WORKSPACE_ROOT,
        "node_modules",
        ".cache",
        "ttsc-test-unplugin",
      ),
      label,
      write,
    );
  }

  /** Absolute path to the generated TypeScript entrypoint. */
  export function mainFile(root: string): string {
    return path.join(root, "src", "main.ts");
  }

  /** Read the generated entrypoint after a test mutates it. */
  export function mainSource(root: string): string {
    return fs.readFileSync(mainFile(root), "utf8");
  }

  /** Assert that the fixture Go plugin replaced the helper call with output. */
  export function assertTransformedToPlugin(code: string): void {
    assert.match(code, /PLUGIN/);
    assert.doesNotMatch(code, /goUpper/);
  }

  /** Extract JavaScript code chunks from Rollup's mixed output array. */
  export function collectRollupOutputCode(output: readonly unknown[]): string {
    return output
      .filter(
        (chunk): chunk is { code: string } =>
          typeof chunk === "object" &&
          chunk !== null &&
          "code" in chunk &&
          typeof (chunk as { code?: unknown }).code === "string",
      )
      .map((chunk) => chunk.code)
      .join("\n");
  }

  /**
   * The Go source directory the project's plugin descriptor names, resolved
   * from the project root: the directory a transform reports among its plugin
   * sources, and every host watches, once the plugin runs (samchon/ttsc#1487).
   *
   * Read from the descriptor this namespace or a scenario wrote, whose `source`
   * is a string literal.
   */
  export function pluginSource(root: string): string {
    const descriptor = fs.readFileSync(path.join(root, "plugin.cjs"), "utf8");
    const named = /source: ("(?:[^"\\]|\\.)*")/.exec(descriptor)?.[1];
    if (named === undefined)
      throw new Error(`plugin.cjs below ${root} names no source literal`);
    return path.resolve(root, JSON.parse(named) as string);
  }

  /** Write the local CommonJS plugin descriptor consumed by ttsc. */
  export function writePluginEntry(root: string): void {
    const source = sharedNativeFixtureSource();
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      [
        "module.exports = (context) => ({",
        '  name: context.plugin.name ?? "fixture",',
        `  source: ${JSON.stringify(source)},`,
        "});",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  /**
   * Add a package-discovered plugin fixture under node_modules.
   *
   * This mirrors the npm package contract where package.json advertises the
   * ttsc plugin entry and the descriptor resolves its own Go source directory.
   */
  export function writePackagePlugin(root: string, packageName: string): void {
    const projectManifest = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify(
        {
          ...projectManifest,
          devDependencies: {
            ...(projectManifest.devDependencies ?? {}),
            [packageName]: "0.0.0",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const packageRoot = path.join(root, "node_modules", packageName);
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify(
        {
          main: "index.cjs",
          name: packageName,
          ttsc: {
            plugin: {
              transform: packageName,
            },
          },
          version: "0.0.0",
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(packageRoot, "index.cjs"),
      [
        'const path = require("node:path");',
        "",
        "module.exports = (context) => ({",
        "  name: context.plugin.name ?? context.plugin.transform,",
        '  source: path.resolve(context.dirname, "go-plugin"),',
        "});",
        "",
      ].join("\n"),
      "utf8",
    );
    writeGoPlugin(packageRoot);
  }

  /**
   * Copy the authored protocol producer into a private package fixture.
   *
   * Package discovery requires the source below the consumer's package root;
   * source-edit scenarios likewise require bytes that no other consumer owns.
   *
   * @evidence contracts/common.md#principled-implementation Delegating to the authored source copier preserves the package-relative go-plugin location while retaining the exact shared producer bytes.
   * @evidence contracts/common.md#clear-and-simple-design This operation owns only the package-relative destination; the common copier owns its two authored inputs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Private files retain actual Go compilation and source mutation rather than replacing the producer with a fabricated result.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph explains why package discovery and source edits require a private copy despite ordinary source sharing.
   */
  export function writeGoPlugin(root: string): void {
    writeNativeFixtureSource(path.join(root, "go-plugin"));
  }

  /**
   * Copy the common synthetic producer's exact Go inputs. Private copies retain
   * source-edit and package-relative discovery scenarios; ordinary consumers
   * share its immutable content-addressed source instead.
   *
   * @evidence contracts/common.md#principled-implementation Copying the authored go.mod and main.go preserves their bytes and the main.go mutation address used by source invalidation scenarios.
   * @evidence contracts/common.md#clear-and-simple-design One source directory and a two-file copy replace independent generated Go implementations; protocol selection remains in the fixture descriptor config.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Consumers execute the actual authored Go program. The copier adds no product branch, foreign patch or expected-result substitution.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes private mutable copies from the immutable ordinary source and names their discovery and mutation responsibilities.
   */
  export function writeNativeFixtureSource(directory: string): void {
    const source = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "unplugin",
      "test",
      "fixtures",
      "native-transform-producer",
    );
    fs.mkdirSync(directory, { recursive: true });
    for (const file of ["go.mod", "main.go"])
      fs.copyFileSync(path.join(source, file), path.join(directory, file));
  }

  /**
   * Materialize one process-wide authored module for both native entrypoints.
   *
   * Generic and cache-protocol projects and the linked Program probe use one
   * immutable three-file module rather than generating independent producer
   * implementations. Synthetic descriptor config selects its protocol in one
   * main executable; the linked probe uses a separate non-main package and host
   * artifact. Neither source sharing nor a shared main executable establishes
   * one transform generation. The native artifact cache owns source-digest and
   * Go-environment equivalence independently of this publisher.
   * Package-discovery and source-edit fixtures remain private because those
   * cases observe package-relative locations or mutate the source bytes.
   *
   * @evidence contracts/common.md#principled-implementation The publisher hashes the authored three-file module and atomically publishes complete bytes, establishing a common immutable source location for both protocols.
   * @evidence contracts/common.md#clear-and-simple-design One process-held module path coordinates both synthetic protocols and the linked Program probe. Package discovery uses the private two-file copier; source-edit consumers copy the immutable module into their own writable root.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Source and artifact sharing retains native execution. The source path neither fabricates envelopes nor promises reuse across distinct consumer state or options.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish executable source identity, private mutable cases and transform-generation ownership.
   * @evidence contracts/performance.md#reuse-equivalent-work Both protocol consumers compile the same main package at one immutable module location; the linked probe selects its separate non-main package from that module; valid descriptor config chooses an operation at execution time. Changed authored bytes select a different digest on the next publisher invocation, while this process expects fixture inputs to remain frozen.
   * @evidence contracts/performance.md#bound-retention-and-release-resources This namespace retains one source-path string for the process. The publisher owns staging cleanup; content-addressed filesystem artifacts persist in the shared test cache and this function does not reclaim historical digests.
   */
  export function sharedNativeFixtureSource(): string {
    sharedGoPluginRoot ??= materializeSharedSource(
      "native-transform-producer",
      (directory) =>
        TestProject.copyDirectory(
          path.join(
            TestProject.WORKSPACE_ROOT,
            "packages",
            "unplugin",
            "test",
            "fixtures",
            "native-transform-producer",
          ),
          directory,
        ),
    );
    return sharedGoPluginRoot;
  }

  /**
   * Resolve the native TypeScript `tsc` binary for unplugin tests that call
   * transform APIs directly.
   */
  export function resolveTsgoBinary() {
    const packageJson = TestProject.REQUIRE_FROM_TEST.resolve(
      "typescript/package.json",
    );
    const requireFromTypeScript = createRequire(packageJson);
    const platformPackageJson = requireFromTypeScript.resolve(
      `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
    );
    return path.join(
      path.dirname(platformPackageJson),
      "lib",
      process.platform === "win32" ? "tsc.exe" : "tsc",
    );
  }
}
