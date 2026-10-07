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
 *
 * @evidence contracts/common.md#principled-implementation Synthetic projects name actual authored Go protocol source and execute the same descriptor and compiler paths as native adapter consumers.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns fixture construction and ordinary immutable native source selection; private mutable copies remain explicit operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Generated descriptors select real Go source, not expected transform results; package discovery and source mutation keep their required private inputs.
 * @evidence contracts/common.md#meaningful-documentation The paragraph describes the TS entry, plugin descriptor and native producer purpose; member prose describes sharing boundaries.
 * @evidence contracts/portability.md#os-neutral-implementation Native joins, filesystem writes and package-based compiler resolution preserve platform paths; the descriptor serializes its source string through JSON.
 * @evidence contracts/performance.md#efficient-algorithms Project writing scales with input bytes; shared source publication hashes the authored tree and avoids copying installed dependencies.
 * @evidence contracts/performance.md#reuse-equivalent-work The process-wide source location and cache are shared only for frozen authored inputs; product build witnesses still own artifact validity.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Project roots are tracked by TestProject; one source-path string remains process-held and published digest directories persist without historical eviction.
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
   *
   * @evidence contracts/common.md#principled-implementation The helper writes a strict CommonJS fixture, chooses the caller's explicit plugins or the default descriptor and supplies actual native source.
   * @evidence contracts/common.md#clear-and-simple-design One operation prepares the entry, config and descriptor using existing shared-cache and temporary-root owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The goUpper source is authored stimulus for the synthetic native producer; its output is still computed by the actual compiler path.
   * @evidence contracts/common.md#meaningful-documentation The paragraph explains source and plugin overrides and why the fixture selects a native transformer.
   * @evidence contracts/portability.md#os-neutral-implementation Native filesystem joins locate generated files, and JSON serialization preserves descriptor values without shell interpolation.
   * @evidence contracts/performance.md#efficient-algorithms A constant number of metadata files plus the source text are written; native shared-source preparation is delegated.
   * @evidence contracts/performance.md#reuse-equivalent-work Ordinary consumers share a process cache and immutable authored source; each project's mutable TS/config files are allocated anew.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The unique project is tracked until process exit, including partial preparation failures; the shared source publisher owns staging release.
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
   *
   * @evidence contracts/common.md#principled-implementation An existing TTSC_CACHE_DIR is preserved; otherwise the shared allocation owner supplies exactly one process cache location.
   * @evidence contracts/common.md#clear-and-simple-design One environment-setting boundary serves both generated projects and Vite fixture builders.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit environment override is a supported owner choice; no compiler result or cache witness is invented.
   * @evidence contracts/common.md#meaningful-documentation The paragraphs state process lifetime, caller override precedence and why direct Vite preparation also calls this owner.
   * @evidence contracts/portability.md#os-neutral-implementation The helper passes the selected native directory as an environment value without shell quoting or separator rewriting.
   * @evidence contracts/performance.md#efficient-algorithms After first allocation, selection and assignment are constant work.
   * @evidence contracts/performance.md#reuse-equivalent-work All later consumers use the same configured root while production content witnesses decide artifact reuse; callers must not change shared inputs concurrently.
   * @evidence contracts/performance.md#bound-retention-and-release-resources At most one shared path string is held here; its allocated root remains TestProject exit-owned unless transferred for unresolved readers. The environment assignment persists for this test process.
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
   *
   * @evidence contracts/common.md#principled-implementation The common publisher hashes and atomically publishes the caller's complete source under the checkout-owned test cache.
   * @evidence contracts/common.md#clear-and-simple-design This adapter chooses one shared cache parent and delegates hashing, contention and staging cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The writer supplies actual source files; publication does not certify a compiler artifact or transform result.
   * @evidence contracts/common.md#meaningful-documentation The paragraphs explain private staging and atomic publication before consumers receive the path.
   * @evidence contracts/portability.md#os-neutral-implementation Native joins and rename handle platform paths; content framing uses portable relative names in the delegated publisher.
   * @evidence contracts/performance.md#efficient-algorithms Each invocation writes and hashes its supplied tree; an existing destination is rehashed only after publication contention.
   * @evidence contracts/performance.md#reuse-equivalent-work Equivalent source bytes at the same label and parent share a digest directory after content comparison; changing bytes chooses another digest.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The publisher removes private staging on failure or contention; completed digest directories remain in the shared test cache without automatic eviction.
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

  /**
   * Absolute path to the generated TypeScript entrypoint.
   *
   * @evidence contracts/common.md#principled-implementation Joining the root with the helper's src/main.ts convention identifies its authored entrypoint.
   * @evidence contracts/common.md#clear-and-simple-design One path constructor keeps entry selection consistent with project creation and reading.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed relative location is the fixture contract, not a product-specific output exception.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the generated entry path.
   * @evidence contracts/portability.md#os-neutral-implementation Native join preserves the caller root's platform path spelling.
   * @evidence contracts/performance.md#efficient-algorithms A fixed number of path operations processes the root string.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This path constructor shares no observed filesystem or compilation result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned path string owns no handle or background work.
   */
  export function mainFile(root: string): string {
    return path.join(root, "src", "main.ts");
  }

  /**
   * Read the generated entrypoint after a test mutates it.
   *
   * @evidence contracts/common.md#principled-implementation The current generated entry is read as UTF-8 after native entry-path construction.
   * @evidence contracts/common.md#clear-and-simple-design One read delegates filename selection to mainFile.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual mutated fixture bytes supply the result; stale expected source is not substituted.
   * @evidence contracts/common.md#meaningful-documentation The headline explains reading after caller mutation.
   * @evidence contracts/portability.md#os-neutral-implementation Native join and readFile use the filesystem's real path semantics.
   * @evidence contracts/performance.md#efficient-algorithms One complete read allocates storage proportional to entry bytes.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every call rereads mutable fixture content without retained snapshots.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous read closes before return; the caller receives the text without retained helper state.
   */
  export function mainSource(root: string): string {
    return fs.readFileSync(mainFile(root), "utf8");
  }

  /**
   * Assert that the fixture Go plugin replaced the helper call with output.
   *
   * @evidence contracts/common.md#principled-implementation The two independent text assertions require the authored PLUGIN marker and removal of its goUpper stimulus.
   * @evidence contracts/common.md#clear-and-simple-design A small shared assertion keeps the fixture's transform oracle in one place.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts These literals belong to the synthetic producer contract; actual emitted code is supplied by the caller and no product behavior is special-cased.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the intended native replacement; it does not claim full JavaScript semantic equivalence.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation String assertions cross no native process or filesystem boundary.
   * @evidence contracts/performance.md#efficient-algorithms Each regular-expression check scans the supplied code text with constant pattern size.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each supplied output is asserted anew; no prior assertion result is reused.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The assertion retains no handle, task or cache.
   */
  export function assertTransformedToPlugin(code: string): void {
    assert.match(code, /PLUGIN/);
    assert.doesNotMatch(code, /goUpper/);
  }

  /**
   * Extract JavaScript code chunks from Rollup's mixed output array.
   *
   * @evidence contracts/common.md#principled-implementation Only non-null object chunks with a string code member contribute text, preserving their input order with newline separators.
   * @evidence contracts/common.md#clear-and-simple-design A filter and projection handle Rollup's mixed output without interpreting asset fields.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual supplied chunks determine the result; no expected bundle is inserted.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies JavaScript-only extraction from mixed Rollup output.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation projects in-memory objects and performs no native boundary operation.
   * @evidence contracts/performance.md#efficient-algorithms The input array is visited by filter and map, then joined; temporary arrays and result bytes scale with chunks and code length.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Mutable output arrays are read per call without cached projections.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only call-local arrays and the returned string are allocated; no persistent resource is owned.
   */
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
   *
   * @evidence contracts/common.md#principled-implementation The helper reads the authored descriptor's JSON string literal and resolves it from the fixture root; absent literals fail explicitly.
   * @evidence contracts/common.md#clear-and-simple-design One narrow extractor supplies the exact source location observed by topology scenarios.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The parser is limited to descriptors written by this namespace or compatible authored scenarios; it does not pretend to evaluate arbitrary JS descriptors.
   * @evidence contracts/common.md#meaningful-documentation The paragraph states the string-literal premise and watched-source purpose.
   * @evidence contracts/portability.md#os-neutral-implementation Native resolve interprets descriptor-relative paths; JSON decoding preserves backslashes and native absolute source spelling.
   * @evidence contracts/performance.md#efficient-algorithms One descriptor read and a linear literal search process its text.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Descriptor contents may change between scenarios, so every call rereads them.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous read closes before return and no parsed descriptor is retained.
   */
  export function pluginSource(root: string): string {
    const descriptor = fs.readFileSync(path.join(root, "plugin.cjs"), "utf8");
    const named = /source: ("(?:[^"\\]|\\.)*")/.exec(descriptor)?.[1];
    if (named === undefined)
      throw new Error(`plugin.cjs below ${root} names no source literal`);
    return path.resolve(root, JSON.parse(named) as string);
  }

  /**
   * Write the local CommonJS plugin descriptor consumed by ttsc.
   *
   * @evidence contracts/common.md#principled-implementation A CommonJS descriptor serializes the immutable source path and selects its name from the actual plugin context.
   * @evidence contracts/common.md#clear-and-simple-design One writer connects private project metadata to the shared authored source owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The descriptor still invokes the real native compiler protocol; source sharing does not fabricate a transform answer.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the local CommonJS descriptor; sharedNativeFixtureSource documents its frozen source premise.
   * @evidence contracts/portability.md#os-neutral-implementation JSON.stringify escapes the native path for JavaScript rather than applying shell or separator rewriting.
   * @evidence contracts/performance.md#efficient-algorithms One small descriptor is written after delegated source publication.
   * @evidence contracts/performance.md#reuse-equivalent-work Ordinary descriptors share one process-held native source path; the actual native artifact cache independently validates compiler inputs.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the descriptor file; the shared publisher owns staging cleanup and keeps completed digest directories.
   */
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
   *
   * @evidence contracts/common.md#principled-implementation The fixture advertises an actual package-discovered descriptor and writes native source at its package-relative go-plugin location.
   * @evidence contracts/common.md#clear-and-simple-design Project dependency metadata and the package entrypoint are constructed together so resolution sees one coherent fixture package.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The synthetic version and package metadata are fixture inputs; actual package resolution and Go execution remain required.
   * @evidence contracts/common.md#meaningful-documentation The paragraphs explain the npm-style plugin contract and package-relative source discovery.
   * @evidence contracts/portability.md#os-neutral-implementation Native joins and JSON encoding construct package files; the descriptor uses node:path to resolve its own source on each platform.
   * @evidence contracts/performance.md#efficient-algorithms A fixed number of metadata files and the two authored native files are written; existing manifest parsing scales with its bytes.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each mutable package fixture is written into its caller-owned root; it is not shared as an immutable package result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller's tracked project owns all writes; failures can leave partial package files and no child is started here.
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
   *
   * @evidence contracts/portability.md#os-neutral-implementation The delegated native copier uses platform path joins and byte-copy APIs; no source-path casing assumptions are introduced.
   * @evidence contracts/performance.md#efficient-algorithms Two fixed authored native files are copied once, with cost proportional to their bytes.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Package-relative mutable copies deliberately remain independent and are not reused as shared state.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller's project owns copied files and any partial copy after failure; synchronous copying retains no handle.
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
   *
   * @evidence contracts/portability.md#os-neutral-implementation Native joins and copyFile address the authored fixture and destination without shell commands or case folding.
   * @evidence contracts/performance.md#efficient-algorithms Two fixed files are copied once; byte size determines IO cost.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each requested private destination receives its own writable files; shared immutable selection is a separate owner.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns destination files and partial preparation; synchronous operations leave no outstanding task or handle.
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
   *
   * @evidence contracts/portability.md#os-neutral-implementation Native joins locate the authored module and delegated copying preserves filenames; publication uses native rename and portable digest framing.
   * @evidence contracts/performance.md#efficient-algorithms First use copies and hashes the complete three-file module; later calls return the process-held path without rescanning frozen authored inputs.
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
   *
   * @evidence contracts/common.md#principled-implementation The actual typescript manifest scopes resolution of its matching platform package before selecting the native executable.
   * @evidence contracts/common.md#clear-and-simple-design One resolver supplies the direct transform APIs' compiler override.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing native packages fail actual resolution rather than selecting an arbitrary toolchain fallback.
   * @evidence contracts/common.md#meaningful-documentation The paragraph identifies native compiler resolution for in-process transform calls.
   * @evidence contracts/portability.md#os-neutral-implementation Platform package naming and the win32 .exe suffix follow the dependency contract; native joins preserve paths.
   * @evidence contracts/performance.md#efficient-algorithms Two package resolutions and fixed path operations avoid any workspace tree scan.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation caches no resolution; the module's environment initialization chooses its process lifetime separately.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No process, handle or retained mutable state is acquired by package resolution.
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
