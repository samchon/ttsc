import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

interface IRealNativeEnvelopeGraph {
  candidates?: Record<string, string[]>;
  configs: string[];
  edges: Record<string, string[]>;
  globals: string[];
  inputHashes?: Record<string, string | null>;
  inputObservations?: Record<
    string,
    {
      accessibleEntries?: { directories: string[]; files: string[] };
      directoryExists?: boolean;
      fileExists?: boolean;
      readFile?: { hash?: string; ok: boolean };
      realpath?: { ok: boolean; path?: string };
      stat?: "directory" | "file" | "missing";
    }
  >;
  inputRealpaths?: Record<string, string | null>;
  resolutionInputs?: string[];
}

interface IRealNativeEnvelopeTransformation {
  graph?: IRealNativeEnvelopeGraph;
  type: string;
  typescript?: Record<string, string>;
}

type RealNativeEnvelopeCache = Map<
  string,
  Promise<{
    projectSnapshotComplete?: boolean;
    result: IRealNativeEnvelopeTransformation;
  }>
>;

interface IRealNativeEnvelopeApi {
  beginTtscTransformBuild(cache: RealNativeEnvelopeCache): void;
  createTtscTransformCache(): RealNativeEnvelopeCache;
  resetTtscTransformCache(cache: RealNativeEnvelopeCache): void;
  resolveOptions(options: {
    compilerOptions?: Record<string, unknown>;
    project: string;
  }): unknown;
  transformTtsc(
    file: string,
    source: string,
    options: unknown,
    aliases: undefined,
    cache?: RealNativeEnvelopeCache,
  ): Promise<{ code: string } | undefined>;
}

/** A real native-host project whose linked plugin observes Program invocations. */
export interface IRealNativeEnvelopeFixture {
  /** Type-root directory whose child membership affects the whole Program. */
  automaticTypesDirectory: string;
  /** Selected declaration whose compiler proof must survive the JSON boundary. */
  declaration: string;
  /** Source kept outside the Program by an inherited templated outDir. */
  excludedSource: string;
  /** Existing package directory that the resolver probed only as a file. */
  fileCandidateDirectory: string;
  /** Missing source that supersedes the package's selected JavaScript entry. */
  missingCandidate: string;
  /** Sibling source modules delivered independently by a bundler. */
  modules: string[];
  /** Whether this fixture carries the full resolver-owner and suffix corpus. */
  resolutionCorpus: boolean;
  /** Real resolver candidates grouped by the path owner that produced them. */
  resolutionCandidateGroups: Record<string, string[]>;
  /** Project root containing the tsconfig, plugin descriptor, and packages. */
  root: string;
  /** Log outside the project, appended once from each linked ApplyProgram call. */
  runLog: string;
}

interface IRealNativeEnvelopeFixtureOptions {
  /** Stage config and declaration races across consecutive compile attempts. */
  raceInputsAcrossAttempts?: boolean;
  /** Include the full resolver-owner and module-suffix probe corpus. */
  resolutionCorpus?: boolean;
}

let sharedContributorRoot: string | undefined;

/**
 * Materialize a package-resolution fixture driven by ttsc's utility host.
 *
 * The Go package is deliberately not `main`: ttsc copies it into the ordinary
 * utility host as a linked contributor, whose no-op `ApplyProgram` method runs
 * in the same native invocation that produces `driver.NewTransformGraph`.
 */
export function createRealNativeEnvelopeFixture(
  options: IRealNativeEnvelopeFixtureOptions = {},
): IRealNativeEnvelopeFixture {
  TestUnpluginProject.ensureSharedCacheDir();
  const resolutionCorpus = options.resolutionCorpus === true;
  const root = TestProject.tmpdir("ttsc-unplugin-real-envelope-");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-real-envelope-log-"),
    "program-runs.bin",
  );
  const modules = [
    ...Array.from({ length: 4 }, (_, index) =>
      path.join(root, "src", `mod${index}.ts`),
    ),
    path.join(root, "src", "predicate.cts"),
  ];
  const declaration = path.join(
    root,
    "node_modules",
    "typed-dep",
    "dist",
    "index.d.ts",
  );
  const excludedDirectory =
    options.raceInputsAcrossAttempts === true ? "generated-next" : "generated";
  const excludedSource = path.join(
    root,
    "src",
    excludedDirectory,
    "ignored.ts",
  );
  const missingCandidate = path.join(
    root,
    "node_modules",
    "linked-pkg",
    "index.ts",
  );
  const fileCandidateDirectory = path.join(root, "node_modules", "punycode.js");
  const automaticTypesDirectory = path.join(root, "node_modules", "@types");
  const resolutionCandidateGroups: Record<string, string[]> = resolutionCorpus
    ? {
        "package exports subpath": [
          path.join(
            root,
            "node_modules",
            "exports-pkg",
            "dist",
            "feature.native.ts",
          ),
        ],
        "package main target": [
          path.join(root, "node_modules", "linked-pkg", "index.native.ts"),
        ],
        "package types target": [
          path.join(
            root,
            "node_modules",
            "typed-dep",
            "dist",
            "index.native.d.ts",
          ),
        ],
        paths: [path.join(root, "paths", "value.native.ts")],
        relative: [
          path.join(root, "src", "relative.native.ts"),
          path.join(root, "src", "relative.ts"),
          path.join(root, "src", "relative.native.tsx"),
          path.join(root, "src", "relative.tsx"),
          path.join(root, "src", "relative.native.d.ts"),
          path.join(root, "src", "relative.d.ts"),
          path.join(root, "src", "relative.native.js"),
          path.join(root, "src", "react.native.tsx"),
          path.join(root, "src", "react.tsx"),
          path.join(root, "src", "react.native.ts"),
          path.join(root, "src", "react.ts"),
          path.join(root, "src", "react.native.d.ts"),
          path.join(root, "src", "react.d.ts"),
          path.join(root, "src", "react.native.jsx"),
          path.join(root, "src", "esm.native.mts"),
          path.join(root, "src", "esm.mts"),
          path.join(root, "src", "esm.native.d.mts"),
          path.join(root, "src", "esm.d.mts"),
          path.join(root, "src", "esm.native.mjs"),
          path.join(root, "src", "common.native.cts"),
          path.join(root, "src", "common.cts"),
          path.join(root, "src", "common.native.d.cts"),
          path.join(root, "src", "common.d.cts"),
          path.join(root, "src", "common.native.cjs"),
        ],
        rootDirs: [
          path.join(root, "src", "rooted.native.ts"),
          path.join(root, "generated", "rooted.native.ts"),
        ],
      }
    : {};

  TestProject.writeFiles(root, {
    "go.mod": "module example.com/ttscunpluginrealenvelope\n\ngo 1.26\n",
    "package.json": JSON.stringify({ private: true, type: "module" }, null, 2),
    "compile-probe/probe.go": [
      "package cacheprobe",
      "",
      "import (",
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      "",
      '  "github.com/samchon/ttsc/packages/ttsc/driver"',
      ")",
      "",
      "type plugin struct{}",
      "",
      "func (plugin) ApplyProgram(_ *driver.Program, context driver.PluginContext) error {",
      '  runLog, ok := context.Entry.Config["runLog"].(string)',
      '  if !ok || runLog == "" {',
      '    return fmt.Errorf("real-envelope compile probe requires a runLog string")',
      "  }",
      "  if !filepath.IsAbs(runLog) {",
      "    runLog = filepath.Join(context.Cwd, runLog)",
      "  }",
      "  file, err := os.OpenFile(runLog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)",
      "  if err != nil {",
      "    return err",
      "  }",
      "  info, err := file.Stat()",
      "  if err != nil {",
      "    _ = file.Close()",
      "    return err",
      "  }",
      "  attempt := info.Size()",
      "  if _, err := file.Write([]byte{1}); err != nil {",
      "    _ = file.Close()",
      "    return err",
      "  }",
      "  if err := file.Close(); err != nil {",
      "    return err",
      "  }",
      '  raceAttempt, _ := context.Entry.Config["raceAttempt"].(float64)',
      "  if attempt == int64(raceAttempt) {",
      '    raceFile, _ := context.Entry.Config["raceFile"].(string)',
      '    raceContent, _ := context.Entry.Config["raceContent"].(string)',
      '    if raceFile != "" && raceContent != "" {',
      "      if !filepath.IsAbs(raceFile) {",
      "        raceFile = filepath.Join(context.Cwd, raceFile)",
      "      }",
      "      if err := os.WriteFile(raceFile, []byte(raceContent), 0o644); err != nil {",
      "        return err",
      "      }",
      "    }",
      "  }",
      "  return nil",
      "}",
      "",
      "func init() {",
      "  driver.RegisterPlugin(plugin{})",
      "}",
      "",
    ].join("\n"),
    "tsconfig.json": JSON.stringify(
      {
        extends: "./presets/base.json",
        compilerOptions: {
          allowJs: true,
          module: "NodeNext",
          moduleResolution: "NodeNext",
          moduleSuffixes: [".native", ""],
          noImplicitAny: false,
          plugins: [
            {
              name: "real-envelope-compile-probe",
              raceAttempt:
                options.raceInputsAcrossAttempts === true ? 99 : undefined,
              raceContent:
                options.raceInputsAcrossAttempts === true
                  ? "export interface Shared { label: string; revision?: number; }\n"
                  : undefined,
              raceFile:
                options.raceInputsAcrossAttempts === true
                  ? declaration
                  : undefined,
              runLog,
              transform: "./plugin.cjs",
            },
          ],
          ...(resolutionCorpus
            ? {
                jsx: "preserve",
                paths: { "@fixture/value": ["./paths/value"] },
                rootDirs: ["src", "generated"],
              }
            : {}),
          strict: true,
          target: "ES2022",
          types: ["*"],
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "presets/base.json": JSON.stringify({
      compilerOptions: {
        outDir: "${configDir}\\src\\generated",
        rootDir: "${configDir}",
      },
    }),
    [`src/${excludedDirectory}/ignored.ts`]:
      'export const ignored = "the templated outDir excludes this source";\n',
    "node_modules/typed-dep/package.json": JSON.stringify(
      {
        main: "dist/index.js",
        name: "typed-dep",
        type: "module",
        types: "dist/index.d.ts",
        version: "0.0.0",
      },
      null,
      2,
    ),
    "node_modules/typed-dep/dist/index.d.ts":
      "export interface Shared { label: string; }\n",
    "node_modules/typed-dep/dist/index.js": 'export const runtime = "typed";\n',
    "node_modules/@types/fixture-types/index.d.ts":
      "declare const realEnvelopeFixtureGlobal: string;\n",
    ...(resolutionCorpus
      ? {
          "node_modules/linked-pkg/package.json": JSON.stringify(
            {
              main: "index.js",
              name: "linked-pkg",
              type: "module",
              version: "0.0.0",
            },
            null,
            2,
          ),
          "node_modules/linked-pkg/index.d.ts":
            "export declare const linked: string;\n",
          "node_modules/linked-pkg/index.js": 'export const linked = "js";\n',
          "node_modules/exports-pkg/package.json": JSON.stringify(
            {
              exports: { "./feature": "./dist/feature.js" },
              name: "exports-pkg",
              type: "module",
              version: "0.0.0",
            },
            null,
            2,
          ),
          "node_modules/exports-pkg/dist/feature.js":
            'export const feature = "exports";\n',
          "generated/rooted.js": 'export const rooted = "rootDirs";\n',
          "paths/value.js": 'export const pathValue = "paths";\n',
          "src/esm.mjs": 'export const esm = "mjs";\n',
          "src/react.jsx": 'export const jsx = "jsx";\n',
          "src/relative.js": 'export const relative = "relative";\n',
        }
      : {}),
    "node_modules/punycode/package.json": JSON.stringify(
      {
        main: "punycode.js",
        name: "punycode",
        version: "0.0.0",
      },
      null,
      2,
    ),
    "node_modules/punycode/punycode.js":
      "module.exports = { encode(value) { return value; } };\n",
    "node_modules/punycode.js/package.json": JSON.stringify(
      {
        main: "punycode.js",
        name: "punycode.js",
        version: "0.0.0",
      },
      null,
      2,
    ),
    "node_modules/punycode.js/punycode.js":
      "module.exports = { encode(value) { return `other:${value}`; } };\n",
    "src/common.cjs": 'exports.common = "cjs";\n',
    ...Object.fromEntries(
      modules.map((file, index) => [
        path.relative(root, file),
        file.endsWith(".cts")
          ? [
              'import { common } from "./common.cjs";',
              ...(resolutionCorpus
                ? ['import { pathValue } from "@fixture/value";']
                : []),
              'import { encode } from "punycode";',
              "",
              `export const predicate = encode("proof") + common${resolutionCorpus ? " + pathValue" : ""};`,
              "",
            ].join("\n")
          : [
              'import type { Shared } from "typed-dep";',
              ...(resolutionCorpus
                ? [
                    'import { linked } from "linked-pkg";',
                    ...(index === 0
                      ? [
                          'import { esm } from "./esm.mjs";',
                          'import { relative } from "./relative.js";',
                        ]
                      : []),
                    ...(index === 2
                      ? ['import { rooted } from "./rooted.js";']
                      : []),
                    ...(index === 3
                      ? [
                          'import { feature } from "exports-pkg/feature";',
                          'import { jsx } from "./react.jsx";',
                        ]
                      : []),
                  ]
                : []),
              "",
              resolutionCorpus
                ? `export const value${index}: Shared = { label: [linked, ${JSON.stringify(String(index))}${index === 0 ? ", esm, relative" : index === 2 ? ", rooted" : index === 3 ? ", feature, jsx" : ""}].join(":") };`
                : `export const value${index}: Shared = { label: ${JSON.stringify(String(index))} };`,
              "",
            ].join("\n"),
      ]),
    ),
  });
  const contributorRoot = sharedRealNativeContributor(root);
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    [
      "module.exports = (context) => ({",
      '  name: context.plugin.name ?? "real-envelope-compile-probe",',
      `  source: ${JSON.stringify(contributorRoot)},`,
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  return {
    automaticTypesDirectory,
    declaration,
    excludedSource,
    fileCandidateDirectory,
    missingCandidate,
    modules,
    resolutionCorpus,
    resolutionCandidateGroups,
    root,
    runLog,
  };
}

function sharedRealNativeContributor(root: string): string {
  sharedContributorRoot ??= path.join(
    TestUnpluginProject.materializeSharedSource(
      "real-native-envelope-module",
      (moduleRoot) => {
        fs.writeFileSync(
          path.join(moduleRoot, "go.mod"),
          "module example.com/ttscunpluginrealenvelope\n\ngo 1.26\n",
          "utf8",
        );
        const contributor = path.join(moduleRoot, "compile-probe");
        fs.mkdirSync(contributor, { recursive: true });
        fs.copyFileSync(
          path.join(root, "compile-probe", "probe.go"),
          path.join(contributor, "probe.go"),
        );
      },
    ),
    "compile-probe",
  );
  return sharedContributorRoot;
}

/** Assert persistent and build-scoped core delivery plus Vite wiring. */
export async function assertRealEnvelopeServesSiblingModulesFromOneCompile(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await loadApi();
  await assertCoreLifecycle(api, fixture, false, { strict: true });
  await assertCoreLifecycle(api, fixture, true);
  await assertViteLifecycle(fixture);
}

/**
 * Assert wrapper-state and compiler-input races stabilize in bounded
 * lifecycles.
 */
export async function assertRealEnvelopeInputRaceStabilizesWithinSharedGeneration(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture({
    raceInputsAcrossAttempts: true,
  });
  const api = await loadApi();
  const options = api.resolveOptions({
    compilerOptions: { strict: true },
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  const leafConfig = path.join(fixture.root, "tsconfig.json");
  const baseConfig = path.join(fixture.root, "presets", "base.json");
  const originalWriteFileSync = fs.writeFileSync;
  let configRaced = false;
  Object.defineProperty(fs, "writeFileSync", {
    configurable: true,
    value: ((...args: unknown[]): unknown => {
      const output = Reflect.apply(originalWriteFileSync, fs, args);
      const [file, contents] = args;
      if (
        configRaced ||
        typeof file !== "string" ||
        typeof contents !== "string" ||
        path.basename(file) !== "tsconfig.json" ||
        path.resolve(file) === path.resolve(leafConfig)
      ) {
        return output;
      }
      let extended: unknown;
      try {
        extended = (JSON.parse(contents) as { extends?: unknown }).extends;
      } catch {
        return output;
      }
      if (
        typeof extended !== "string" ||
        path.resolve(extended) !== path.resolve(leafConfig)
      ) {
        return output;
      }
      configRaced = true;
      originalWriteFileSync(
        baseConfig,
        JSON.stringify({
          compilerOptions: {
            outDir: "${configDir}\\src\\generated-next",
            rootDir: "${configDir}",
          },
        }),
        "utf8",
      );
      return output;
    }) as typeof fs.writeFileSync,
    writable: true,
  });
  try {
    assert.ok(
      await api.transformTtsc(
        fixture.modules[0]!,
        fs.readFileSync(fixture.modules[0]!, "utf8"),
        options,
        undefined,
        undefined,
      ),
    );
  } finally {
    Object.defineProperty(fs, "writeFileSync", {
      configurable: true,
      value: originalWriteFileSync,
      writable: true,
    });
  }
  assert.equal(
    configRaced,
    true,
    "the fixture must replace the inherited config after wrapper materialization",
  );
  assert.equal(
    programRuns(fixture.runLog),
    2,
    "a cache-optional delivery must discard the mixed wrapper state and retry once",
  );
  assert.match(fs.readFileSync(baseConfig, "utf8"), /generated-next/);

  const parsed = JSON.parse(fs.readFileSync(leafConfig, "utf8")) as {
    compilerOptions: { plugins: Array<Record<string, unknown>> };
  };
  parsed.compilerOptions.plugins[0]!.raceAttempt = 0;
  fs.writeFileSync(leafConfig, JSON.stringify(parsed, null, 2), "utf8");
  resetRunLog(fixture.runLog);

  const cache = api.createTtscTransformCache();
  try {
    await Promise.all(
      fixture.modules.map((file) =>
        api.transformTtsc(
          file,
          fs.readFileSync(file, "utf8"),
          options,
          undefined,
          cache,
        ),
      ),
    );
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "concurrent modules must share the failed declaration attempt and its stable retry",
    );
    assert.match(fs.readFileSync(fixture.declaration, "utf8"), /revision/);
    assert.equal(cache.size, 1);
    const stableGeneration = [...cache.values()][0]!;
    assert.equal((await stableGeneration).projectSnapshotComplete, true);
    await assertProductionEnvelope(cache, fixture);

    for (const file of fixture.modules) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "every later module must reuse only the stabilized native generation",
    );
    assert.equal([...cache.values()][0], stableGeneration);
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/** Assert a newly available superseding candidate replaces one generation. */
export async function assertRealEnvelopeCandidateAppearanceReplacesGeneration(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture({ resolutionCorpus: true });
  const api = await loadApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  try {
    await deliver(api, cache, options, fixture.modules[0]!);
    assert.equal(programRuns(fixture.runLog), 1);
    await assertProductionEnvelope(cache, fixture);

    fs.writeFileSync(
      fixture.missingCandidate,
      'export const linked = "typescript";\n',
      "utf8",
    );
    await deliver(api, cache, options, fixture.modules[1]!);
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "a superseding package candidate must replace the generation before its next importer is delivered",
    );
    for (const file of fixture.modules.slice(2, -1)) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "sibling deliveries must reuse the generation created after candidate appearance",
    );

    fs.rmSync(fixture.fileCandidateDirectory, { recursive: true });
    fs.writeFileSync(
      fixture.fileCandidateDirectory,
      "exports.encode = function encode(value) { return `file:${value}`; };\n",
      "utf8",
    );
    await deliver(api, cache, options, fixture.modules.at(-1)!);
    assert.equal(
      programRuns(fixture.runLog),
      3,
      "replacing a failed file-candidate directory with a selectable file must replace the generation",
    );

    const generatedTypes = path.join(
      fixture.automaticTypesDirectory,
      "generated-ambient",
    );
    fs.mkdirSync(generatedTypes, { recursive: true });
    fs.writeFileSync(
      path.join(generatedTypes, "index.d.ts"),
      "declare const generatedAmbient: string;\n",
      "utf8",
    );
    await deliver(api, cache, options, fixture.modules[0]!);
    assert.equal(
      programRuns(fixture.runLog),
      4,
      "adding an automatic type package must replace the generation before a bundler can reuse it",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/** Assert a changed selected declaration replaces one persistent generation. */
export async function assertRealEnvelopeDeclarationChangeReplacesGeneration(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await loadApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  try {
    await deliver(api, cache, options, fixture.modules[0]!);
    assert.equal(programRuns(fixture.runLog), 1);
    await assertProductionEnvelope(cache, fixture);

    fs.writeFileSync(
      fixture.declaration,
      "export interface Shared { label: string; revision?: number; }\n",
      "utf8",
    );
    await deliver(api, cache, options, fixture.modules[1]!);
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "a selected declaration edit must replace the generation before its next importer is delivered",
    );
    for (const file of fixture.modules.slice(2)) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "sibling deliveries must reuse the generation created after the declaration edit",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/** Drive one core cache lifecycle and assert its real envelope before reuse. */
async function assertCoreLifecycle(
  api: IRealNativeEnvelopeApi,
  fixture: IRealNativeEnvelopeFixture,
  buildScoped: boolean,
  compilerOptions?: Record<string, unknown>,
): Promise<void> {
  const cache = api.createTtscTransformCache();
  if (buildScoped) api.beginTtscTransformBuild(cache);
  const options = api.resolveOptions({
    ...(compilerOptions === undefined ? {} : { compilerOptions }),
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  try {
    await deliver(api, cache, options, fixture.modules[0]!);
    assert.equal(programRuns(fixture.runLog), 1);
    await assertProductionEnvelope(cache, fixture);
    for (const file of fixture.modules.slice(1)) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      1,
      `${buildScoped ? "build-scoped" : "persistent"} delivery must serve every sibling module from one production host invocation`,
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/** Drive the public Vite adapter over the same production-host fixture. */
async function assertViteLifecycle(
  fixture: IRealNativeEnvelopeFixture,
): Promise<void> {
  const { createServer } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN(
    "vite",
  ) as {
    createServer(config: object): Promise<any>;
  };
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const viteRoot = fs.realpathSync.native(fixture.root);
  resetRunLog(fixture.runLog);
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: [unpluginVite()],
    root: viteRoot,
    server: { hmr: false, middlewareMode: true, watch: null },
  });
  try {
    const graph =
      server.environments?.client?.moduleGraph ?? server.moduleGraph;
    const entries: Array<{ file: string; node: any }> = [];
    for (const file of fixture.modules) {
      const url = `/${path.relative(fixture.root, file).split(path.sep).join("/")}`;
      const result = await server.transformRequest(url);
      assert.ok(result?.code, `Vite must transform ${url}`);
      const node = await graph.getModuleByUrl(url);
      assert.ok(node, `Vite's module graph must contain ${url}`);
      assert.ok(
        node.transformResult,
        `Vite must cache the first transform result for ${url}`,
      );
      entries.push({ file, node });
    }
    assert.equal(
      programRuns(fixture.runLog),
      1,
      "the Vite watcherless lifecycle must serve every sibling module from one production host invocation",
    );

    const events = spyReloadEvents(server);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    assert.ok(
      entries.every(
        ({ node }) =>
          node.transformResult !== null && node.transformResult !== undefined,
      ),
      "several unchanged polls must preserve every cached transform",
    );
    assert.equal(
      events.length,
      0,
      "an extension-shaped directory must not be mistaken for an appearing file",
    );

    // Vite can transpile TypeScript even if the ttsc adapter bypasses a module,
    // so returned code alone does not prove the request crossed our transform
    // hook. Replace the exact failed file predicate with a selectable file and
    // require the adapter's private poll to invalidate its importer.
    const predicate = entries.find(({ file }) =>
      file.endsWith("predicate.cts"),
    );
    assert.ok(predicate, "the Vite graph must contain the predicate importer");
    const unrelated = entries.filter((entry) => entry !== predicate);
    fs.rmSync(fixture.fileCandidateDirectory, { recursive: true });
    fs.writeFileSync(
      fixture.fileCandidateDirectory,
      "exports.encode = function encode(value) { return `file:${value}`; };\n",
      "utf8",
    );
    await waitFor(
      () =>
        predicate.node.transformResult === null ||
        predicate.node.transformResult === undefined,
      "the predicate importer to be invalidated after its directory became a file",
    );
    assert.ok(
      unrelated.every(
        ({ node }) =>
          node.transformResult !== null && node.transformResult !== undefined,
      ),
      "the file predicate must invalidate only importers that own it",
    );
    assert.ok(
      events.some((event) => event.type === "full-reload"),
      "the directory-to-file transition must announce a full reload",
    );
    assert.equal(
      programRuns(fixture.runLog),
      1,
      "candidate notification must invalidate the importer without compiling until Vite requests it again",
    );
  } finally {
    await server.close();
  }
}

/** Load the compiled public unplugin API exercised by consumers. */
async function loadApi(): Promise<IRealNativeEnvelopeApi> {
  return (await TestUnpluginRuntime.loadUnpluginApi()) as IRealNativeEnvelopeApi;
}

/** Deliver one source file through the public transform API. */
async function deliver(
  api: IRealNativeEnvelopeApi,
  cache: RealNativeEnvelopeCache,
  options: unknown,
  file: string,
): Promise<void> {
  await api.transformTtsc(
    file,
    fs.readFileSync(file, "utf8"),
    options,
    undefined,
    cache,
  );
}

/** Poll an asynchronous adapter consequence until it is observed. */
async function waitFor(
  predicate: () => boolean,
  what: string,
  timeout = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`timed out waiting for ${what}`);
}

/** Record every Vite reload channel without requiring a connected client. */
function spyReloadEvents(server: any): Array<{ type?: string }> {
  const events: Array<{ type?: string }> = [];
  const seen = new Set<object>();
  for (const channel of [
    server.ws,
    server.hot,
    server.environments?.client?.hot,
  ]) {
    if (
      channel === null ||
      channel === undefined ||
      typeof channel.send !== "function" ||
      seen.has(channel)
    ) {
      continue;
    }
    seen.add(channel);
    channel.send = (payload: { type?: string }) => {
      events.push(payload);
    };
  }
  return events;
}

/** Inspect the actual generation admitted by @ttsc/unplugin. */
async function assertProductionEnvelope(
  cache: RealNativeEnvelopeCache,
  fixture: IRealNativeEnvelopeFixture,
): Promise<void> {
  assert.equal(cache.size, 1, "one project must own one cached generation");
  const generation = [...cache.values()][0];
  assert.ok(generation, "the first delivery must admit a generation");
  const { result } = await generation;
  assert.equal(result.type, "success");
  assert.ok(result.typescript, "the native host must return TypeScript output");
  for (const file of fixture.modules) {
    const key = findGraphSpelling(
      fixture.root,
      Object.keys(result.typescript),
      file,
    );
    assert.ok(
      key,
      `the native envelope must contain the sibling output ${graphKey(fixture.root, file)}`,
    );
  }
  assert.equal(
    findGraphSpelling(
      fixture.root,
      Object.keys(result.typescript),
      fixture.excludedSource,
    ),
    undefined,
    "an unrelated compiler overlay must not move an inherited configDir outDir to scratch",
  );

  const graph = result.graph;
  assert.ok(
    graph,
    "the production native host must return its reference graph",
  );
  const candidates = Object.values(graph.candidates ?? {}).flat();
  assert.ok(candidates.length > 0, "the real graph must contain candidates");
  const realized = new Set([
    ...Object.keys(graph.edges),
    ...Object.values(graph.edges).flat(),
    ...graph.globals,
    ...graph.configs,
    ...Object.keys(graph.candidates ?? {}),
  ]);
  const candidateOnly = candidates.filter(
    (candidate) => !realized.has(candidate),
  );
  assert.ok(
    candidateOnly.length > 0,
    "the fixture must produce a candidate that is not a realized graph member",
  );
  const unproven = candidateOnly.find(
    (candidate) =>
      !Object.prototype.hasOwnProperty.call(
        graph.inputHashes ?? {},
        candidate,
      ) &&
      !Object.prototype.hasOwnProperty.call(
        graph.inputRealpaths ?? {},
        candidate,
      ),
  );
  assert.ok(
    unproven,
    "the fixture must produce a predicate-only path with no legacy compiler hash or realpath projection",
  );
  const automaticTypes = findGraphSpelling(
    fixture.root,
    graph.resolutionInputs ?? [],
    fixture.automaticTypesDirectory,
  );
  assert.ok(
    automaticTypes,
    "the production graph must retain automatic type-root membership",
  );
  assert.ok(
    graph.inputObservations?.[automaticTypes]?.accessibleEntries,
    "the automatic type root must carry its compiler-time accessible entries",
  );

  if (fixture.resolutionCorpus) {
    const knownCandidate = findGraphSpelling(
      fixture.root,
      candidates,
      fixture.missingCandidate,
    );
    assert.ok(
      knownCandidate,
      `the real graph must retain the superseding package candidate ${graphKey(fixture.root, fixture.missingCandidate)}`,
    );
    assert.equal(fs.existsSync(fixture.missingCandidate), false);
  }

  const fileCandidateDirectory = findGraphSpelling(
    fixture.root,
    candidates,
    fixture.fileCandidateDirectory,
  );
  assert.ok(
    fileCandidateDirectory,
    `the real graph must retain the file probe for ${graphKey(fixture.root, fixture.fileCandidateDirectory)}`,
  );
  assert.equal(fs.statSync(fixture.fileCandidateDirectory).isDirectory(), true);
  assert.equal(
    graph.inputObservations?.[fileCandidateDirectory]?.fileExists,
    false,
    "an existing directory must remain a failed file predicate on the production wire",
  );

  if (fixture.resolutionCorpus) {
    for (const [owner, expected] of Object.entries(
      fixture.resolutionCandidateGroups,
    )) {
      for (const file of expected) {
        const candidate = findGraphSpelling(fixture.root, candidates, file);
        assert.ok(
          candidate,
          `the real ${owner} resolver must retain ${graphKey(fixture.root, file)}`,
        );
        assert.equal(
          graph.inputObservations?.[candidate]?.fileExists,
          false,
          `the real ${owner} probe must carry its failed file predicate for ${graphKey(fixture.root, file)}`,
        );
      }
    }
  }

  const declaration = findGraphSpelling(
    fixture.root,
    Object.values(graph.edges).flat(),
    fixture.declaration,
  );
  assert.ok(
    declaration,
    `the selected declaration must be a realized edge: ${graphKey(fixture.root, fixture.declaration)}`,
  );
  assert.match(
    graph.inputHashes?.[declaration] ?? "",
    /^[0-9a-f]{64}$/,
    "the selected declaration must carry a compiler content proof",
  );
  assert.equal(
    typeof graph.inputRealpaths?.[declaration],
    "string",
    "the selected declaration must carry a compiler realpath proof",
  );
}

/** Find the producer's spelling for one semantic filesystem path. */
function findGraphSpelling(
  root: string,
  spellings: readonly string[],
  file: string,
): string | undefined {
  const expected = comparablePath(file);
  return spellings.find(
    (spelling) =>
      comparablePath(graphAbsolutePath(root, spelling)) === expected,
  );
}

/** Resolve one relative-or-absolute graph key to a native absolute path. */
function graphAbsolutePath(root: string, spelling: string): string {
  const native = spelling.split("/").join(path.sep);
  return path.resolve(
    path.isAbsolute(native) ? native : path.join(root, native),
  );
}

/** Apply the host filesystem's path-case contract for semantic comparisons. */
function comparablePath(file: string): string {
  const resolved = physicalPath(file);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Resolve aliases even when the final candidate does not exist yet. */
function physicalPath(file: string): string {
  let existing = path.resolve(file);
  const missing: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    missing.unshift(path.basename(existing));
    existing = parent;
  }
  try {
    existing = fs.realpathSync.native(existing);
  } catch {
    // The lexical root is still the only usable identity on an unreadable path.
  }
  return path.resolve(existing, ...missing);
}

/** Convert an absolute fixture path into the native envelope's key vocabulary. */
function graphKey(root: string, file: string): string {
  const relative = path.relative(root, file);
  const selected =
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
      ? relative
      : path.resolve(file);
  return selected.split(path.sep).join("/");
}

/** Reset the observer without introducing a file under the project root. */
function resetRunLog(runLog: string): void {
  fs.writeFileSync(runLog, Buffer.alloc(0));
}

/** Count linked ApplyProgram calls from the one-byte append protocol. */
function programRuns(runLog: string): number {
  return fs.existsSync(runLog) ? fs.statSync(runLog).size : 0;
}
