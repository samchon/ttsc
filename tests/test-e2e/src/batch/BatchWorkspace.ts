import {
  FileSystemIterator,
  TestProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

import factory, { TsPrinter } from "../../../../packages/factory/src/index";
import { buildSourcePlugin } from "../../../../packages/ttsc/lib/plugin/internal/source/buildSourcePlugin.js";
import { copiesPluginSourceEntry } from "../../../../packages/ttsc/lib/plugin/internal/source/copiesPluginSourceEntry.js";
import { ensureExecutableGoToolchain } from "../../../../packages/ttsc/lib/plugin/internal/source/ensureExecutableGoToolchain.js";
import { resolveGoCompiler } from "../../../../packages/ttsc/lib/plugin/internal/source/resolveGoCompiler.js";
import { resolveSourceBuildCachePaths } from "../../../../packages/ttsc/lib/plugin/internal/source/resolveSourceBuildCachePaths.js";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { prepareEvidenceDependencies } from "../../../utils/src/evidence/prepareEvidenceDependencies";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { shellQuote } from "../internal/ttsc/internal/source-build";

/** Owns the one corpus all nine real boundary sessions consume. */
export namespace BatchWorkspace {
  export interface Workspace {
    root: string;
    graphNegativeRoot: string;
    cache: string;
    installedTtsx: string;
    programRunLog: string;
    contextReceipt: string;
    factoryContextProbe: string;
    factoryEsmContextProbe: string;
    configPathReceipt: string;
    pathsReceipt: string;
    casePolicyReceipt: string;
    projectAlias: string;
    installationOnly: boolean;
    sourcePublication?: { binary: string; root: string };
    expected: readonly { title: string; units: number[] }[];
  }
  let preparation: Promise<Workspace> | undefined;
  let reuseFailure: Error | undefined;

  /** Borrow the immutable prepared input graph; preparation happens once. */
  export function open(): Promise<Workspace> {
    if (reuseFailure !== undefined) return Promise.reject(reuseFailure);
    return (preparation ??= prepare());
  }

  /** Compare every delivered value with its pre-print UTF-16 input oracle. */
  export function assertResult(
    value: unknown,
    expected: Workspace["expected"],
    emitted = false,
  ): void {
    assert.ok(value !== null && typeof value === "object");
    const result = value as {
      authoredMarker: unknown;
      linkedValue: unknown;
      mapPositionProbe: unknown;
      answer: unknown;
      data: unknown;
      neighbor: unknown;
      values: unknown;
      nativePipeline: unknown;
      nativeNeighbor: unknown;
      nativeOrdered: unknown;
      nativeOrderedNeighbor: unknown;
      defaultOnlyCallRetained: unknown;
      nativeNumeric: unknown;
      numericNeighbor: unknown;
    };
    const failures: Error[] = [];
    const check = (name: string, run: () => void): void => {
      try {
        run();
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
    };
    check("authored source marker", () =>
      assert.equal(result.authoredMarker, "authored-marker"),
    );
    check("resolved linked package binding", () =>
      assert.equal(result.linkedValue, "linked"),
    );
    check("retained source map coordinate control", () =>
      assert.equal(result.mapPositionProbe, "map-coordinate-control"),
    );
    check("retained contract value", () => assert.equal(result.answer, 42));
    check("resolved JSON alias", () => assert.equal(result.data, 42));
    check("unchanged JSON neighbor", () =>
      assert.equal(result.neighbor, "retained"),
    );
    check(
      emitted ? "native emitted string" : "API preserves parsed source text",
      () =>
        assert.equal(
          result.nativePipeline,
          emitted ? "A:PLUGIN:z" : "__TTSC_NATIVE_PIPELINE__",
        ),
    );
    check("unchanged native neighbor", () =>
      assert.equal(result.nativeNeighbor, "native-neighbor-retained"),
    );
    check(
      emitted
        ? "native emitted ordered entries"
        : "API does not impersonate EmitTransform",
      () =>
        assert.equal(
          result.nativeOrdered,
          emitted ? "A:PLUGIN:z" : "__TTSC_ORDERED__:plugin",
        ),
    );
    check("unchanged ordered neighbor", () =>
      assert.equal(result.nativeOrderedNeighbor, "ordered-neighbor-retained"),
    );
    check("native numeric emit versus original API initializer", () =>
      assert.equal(result.nativeNumeric, emitted ? 100 : 0),
    );
    check("unchanged numeric neighbor", () =>
      assert.equal(result.numericNeighbor, 0),
    );
    check("project strip configuration retains default-only call", () =>
      assert.equal(result.defaultOnlyCallRetained, true),
    );
    assertValues(result.values, expected);
    if (failures.length)
      throw new AggregateError(failures, "Shared boundary assertions failed");
  }

  /** Compare observed native values without inventing unrelated utility results. */
  export function assertValues(
    input: unknown,
    expected: Workspace["expected"],
  ): void {
    const failures: Error[] = [];
    const check = (name: string, run: () => void): void => {
      try {
        run();
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
    };
    assert.ok(Array.isArray(input));
    const values = input;
    check("complete JSX population", () =>
      assert.equal(values.length, expected.length),
    );
    expected.forEach((row, index) =>
      check(row.title, () => {
        const actual = values[index];
        assert.equal(typeof actual, "string");
        assert.deepEqual(
          (actual as string).split("").map((unit) => unit.charCodeAt(0)),
          row.units,
        );
      }),
    );
    if (failures.length)
      throw new AggregateError(failures, "Shared boundary assertions failed");
  }

  /** Read native ApplyProgram admission receipts, never emitted-value evidence. */
  export function readContextReceipts(
    workspace: Workspace,
  ): Record<string, unknown>[] {
    if (!fs.existsSync(workspace.contextReceipt)) return [];
    return fs
      .readFileSync(workspace.contextReceipt, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  /** Read actual native option delivery without treating it as a content proof. */
  export function readConfigPathReceipts(
    workspace: Workspace,
  ): Record<string, unknown>[] {
    if (!fs.existsSync(workspace.configPathReceipt)) return [];
    return fs
      .readFileSync(workspace.configPathReceipt, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  /**
   * Read actual parsed Program paths without deriving them from a config file.
   *
   * @evidence contracts/common.md#principled-implementation JSONL rows are read from the actual native fixture receipt; callers compare independent configured targets rather than deriving a native certificate from authored tsconfig bytes.
   * @evidence contracts/common.md#clear-and-simple-design One reader supplies the existing host's offset-based receipt window; it creates no producer, session or input profile.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No process interception, compiler DTO or inferred paths replace the supported Go Program Options observation. An absent receipt stays empty and cannot satisfy the caller's required native row.
   * @evidence contracts/common.md#meaningful-documentation The headline distinguishes actual parsed Program options from config-file interpretation; the return type preserves null versus keyed targets for the caller's literal assertions.
   */
  export function readPathsReceipts(
    workspace: Workspace,
  ): { name: string; paths: Record<string, string[]> | null }[] {
    if (!fs.existsSync(workspace.pathsReceipt)) return [];
    return fs
      .readFileSync(workspace.pathsReceipt, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  /** Match one native sequence and the caller's authored discovery mode. */
  export function assertContextReceipts(
    records: Record<string, unknown>[],
    prefix = "a:",
    orderedPrefix = "a:",
    automaticDiscovery = true,
  ): void {
    assert.ok(
      records.length > 0,
      "the actual native producer must admit configured entries",
    );
    assert.equal(
      records.some((record) => record.name === "native-order-disabled"),
      false,
    );
    const automatic = records.filter(
      (record) => record.name === "native-auto-discovery",
    );
    if (automaticDiscovery)
      assert.ok(
        automatic.length > 0,
        "the package marker must select its real automatic native entry despite hidden package.json exports",
      );
    else
      assert.deepEqual(
        automatic,
        [],
        "explicit plugin entries must suppress automatic dependency discovery",
      );
    for (const record of automatic)
      assert.deepEqual(record, {
        name: "native-auto-discovery",
        operation: "identity",
        prefix: null,
        suffix: null,
      });
    const names = [
      "shared-real-program-probe",
      "native-order-prefix",
      "native-order-identity",
      "native-order-upper",
      "native-order-suffix",
    ];
    const start = records.findIndex(
      (record) => record.name === names[0] && record.prefix === prefix,
    );
    assert.notEqual(
      start,
      -1,
      "the observed producer must receive the selected base configuration",
    );
    assert.deepEqual(records.slice(start, start + names.length), [
      { name: names[0], operation: null, prefix, suffix: ":z" },
      {
        name: names[1],
        operation: "prefix",
        prefix: orderedPrefix,
        suffix: null,
      },
      { name: names[2], operation: "identity", prefix: null, suffix: null },
      { name: names[3], operation: "upper", prefix: null, suffix: null },
      { name: names[4], operation: "suffix", prefix: null, suffix: ":z" },
    ]);
  }

  /** Interpret actual bundle bytes as an independent JavaScript value oracle. */
  export function readBundle(code: string): unknown {
    const context = vm.createContext({
      console: { info() {}, debug() {}, warn() {} },
    });
    vm.runInContext(code, context, { timeout: 30_000 });
    return JSON.parse(JSON.stringify(context.TTSC_BATCH_RESULT));
  }

  /** Decode the single labeled payload without borrowing test-runner output. */
  export function readPayload(stdout: string): unknown {
    const lines = stdout
      .split(/\r?\n/)
      .filter((line) => line.startsWith("TTSC_BATCH:"));
    assert.equal(
      lines.length,
      1,
      "exactly one source program result is required",
    );
    return JSON.parse(lines[0]!.slice("TTSC_BATCH:".length));
  }

  /** Keep uncertain process inputs and refuse later borrowers of that graph. */
  export function retain(reason: string): void {
    reuseFailure ??= new Error("Shared input reuse is blocked: " + reason);
    if (preparation !== undefined)
      void preparation.then(({ root }) =>
        TestProject.retainTemporaryDirectory(root, reason),
      );
  }

  /** Release shared inputs only after all consumers have returned. */
  export async function close(): Promise<void> {
    if (reuseFailure !== undefined) return;
    if (preparation === undefined) return;
    const { root, projectAlias, graphNegativeRoot } = await preparation;
    if (!fs.existsSync(root)) return;
    if (root !== projectAlias)
      fs.rmSync(path.dirname(projectAlias), {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    fs.rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    fs.rmSync(graphNegativeRoot, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }

  async function prepare(): Promise<Workspace> {
    const root = TestProject.tmpdir("ttsc-shared-boundaries-");
    // Retain throughout the run. The runner explicitly releases only its own
    // completed consumers; a rejected or unknown lifetime keeps all inputs.
    TestProject.retainTemporaryDirectory(
      root,
      "Shared boundary consumers have not completed",
    );
    const inputs = await FileSystemIterator.read(
      path.resolve(import.meta.dirname, "../../fixtures/shared"),
    );
    await FileSystemIterator.write(root, inputs);
    const graphNegativeRoot = TestProject.tmpdir(
      "ttsc-shared-graph-uninstalled-",
    );
    TestProject.retainTemporaryDirectory(
      graphNegativeRoot,
      "Graph negative resolution readers have not completed",
    );
    await FileSystemIterator.write(
      path.join(root, "tools/graph-native"),
      await FileSystemIterator.read(
        path.resolve(
          import.meta.dirname,
          "../../fixtures/graph/installedTargetBoundary/inputs-1",
        ),
      ),
    );
    await FileSystemIterator.write(
      graphNegativeRoot,
      await FileSystemIterator.read(
        path.resolve(
          import.meta.dirname,
          "../../fixtures/graph/installedTargetBoundary/inputs-2",
        ),
      ),
    );
    await FileSystemIterator.write(
      path.join(root, "tools/public-lint"),
      await FileSystemIterator.read(
        path.resolve(import.meta.dirname, "../../fixtures/lint/write-boundary"),
      ),
    );
    await FileSystemIterator.write(
      path.join(root, "tools/graph-http"),
      await FileSystemIterator.read(
        path.resolve(
          import.meta.dirname,
          "../../fixtures/graph/ttscgraph_view_owns_http_server_lifecycle/inputs-1",
        ),
      ),
    );
    for (const name of ["native-vite-watch", "native-vite-external"])
      fs.mkdirSync(path.join(root, "tools", name), { recursive: true });
    const installationOnly = process.argv.includes("--installation");
    const target = `${process.platform}-${process.arch}`;
    const pnpm = (args: string[], cwd: string): void => {
      execFileSync("pnpm", args, {
        cwd,
        shell: process.platform === "win32",
        stdio: "inherit",
      });
    };
    for (const name of ["ttsc", `ttsc-${target}`])
      pnpm(
        ["pack", "--out", path.join(root, `${name}.tgz`)],
        path.join(TestProject.WORKSPACE_ROOT, "packages", name),
      );
    const authoredManifest = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        ...authoredManifest,
        private: true,
        type: "commonjs",
        dependencies: {
          ttsc: "file:./ttsc.tgz",
          [`@ttsc/${target}`]: `file:./ttsc-${target}.tgz`,
          typescript: "7.0.2",
        },
      }),
    );
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
        .imports,
      {
        "#local-descriptor": "./descriptors/input.cjs",
        "#installed-descriptor": "batch-descriptor-input",
        "#missing-local-descriptor": "./descriptors/optional.cjs",
        "#missing-package-descriptor": "batch-absent-descriptor-input",
      },
      "installation dependencies must preserve the authored descriptor import map",
    );
    pnpm(["install", "--ignore-scripts", "--no-frozen-lockfile"], root);
    const installed = createRequire(path.join(root, "package.json"));
    const sdk = path.dirname(installed.resolve("ttsc/package.json"));
    assert.equal(
      fs.realpathSync
        .native(sdk)
        .startsWith(fs.realpathSync.native(root) + path.sep),
      true,
      "SDK must resolve inside the owned installed consumer",
    );
    const installedTtsx = path.join(sdk, "lib/launcher/ttsx.js");
    assert.ok(
      fs.existsSync(installedTtsx),
      "packed SDK must publish its actual runtime launcher",
    );
    const modules = path.join(root, "node_modules");
    if (!installationOnly)
      prepareEvidenceDependencies(modules, "snapshot", "installed");
    fs.symlinkSync(
      path.join(root, "src/linked-value"),
      path.join(modules, "batch-linked-value"),
      "junction",
    );
    for (const name of installationOnly
      ? []
      : ["banner", "paths", "strip", "wasm", "playground", "unplugin"])
      fs.symlinkSync(
        path.join(TestProject.WORKSPACE_ROOT, "packages", name),
        path.join(modules, "@ttsc", name),
        "junction",
      );
    for (const name of [
      "path-dependency",
      "trace-dependency",
      "batch-record-dependency",
    ]) {
      const target = path.join(modules, name);
      fs.mkdirSync(target, { recursive: true });
      for (const filename of ["package.json", "index.d.ts"])
        fs.copyFileSync(
          path.join(root, "vendor", name, filename),
          path.join(target, filename),
        );
    }
    const programRunLog = path.join(root, "program-runs.bin");
    const contextReceipt = path.join(root, "native-context.jsonl");
    const configPathReceipt = path.join(root, "native-config-paths.jsonl");
    const pathsReceipt = path.join(root, "native-program-paths.jsonl");
    const casePolicyReceipt = path.join(root, "native-case-policy.jsonl");
    let projectAlias = root;
    if (!installationOnly) {
      const aliasParent = TestProject.tmpdir("ttsc-shared-project-alias-");
      TestProject.retainTemporaryDirectory(
        aliasParent,
        "Shared linked project consumers have not completed",
      );
      projectAlias = path.join(aliasParent, "project");
      fs.symlinkSync(fs.realpathSync.native(root), projectAlias, "junction");
    }
    // Factory identity receipts are observation outputs, not compiler inputs.
    const factoryReceiptRoot = installationOnly
      ? root
      : path.dirname(projectAlias);
    const factoryContextProbe = path.join(
      factoryReceiptRoot,
      "factory-context.json",
    );
    const factoryEsmContextProbe = path.join(
      factoryReceiptRoot,
      "factory-esm-context.json",
    );
    if (!installationOnly)
      for (const name of ["cjs-dep", "esm-dep"])
        fs.symlinkSync(
          path.join(root, "src/runtime-corpus/dual", name),
          path.join(modules, name),
          "junction",
        );
    if (!installationOnly) {
      await FileSystemIterator.write(
        path.join(modules, "root-pkg"),
        await FileSystemIterator.read(
          path.join(root, "tools/runtime-installed-package"),
        ),
      );
      fs.symlinkSync(
        path.join(root, "tools/ownership"),
        path.join(modules, "raw-ownership"),
        "junction",
      );
      const workspaceRequire = createRequire(import.meta.url);
      fs.symlinkSync(
        path.dirname(workspaceRequire.resolve("tslib/package.json")),
        path.join(modules, "tslib"),
        "junction",
      );
      for (const [name, directory] of [
        ["batch-inert-exports", "inert"],
        ["batch-dynamic-exports", "dynamic"],
        ["batch-collision-exports", "collision"],
        ["batch-commonjs-lowering", "lowering"],
      ])
        fs.symlinkSync(
          path.join(root, "src/runtime-corpus/export-population", directory!),
          path.join(modules, name!),
          "junction",
        );
      for (const [name, mode] of [
        ["batch-configured-esnext", "esnext"],
        ["batch-configured-legacy", "legacy"],
        ["batch-configured-diagnostic", "diagnostic"],
      ])
        fs.symlinkSync(
          path.join(root, "tools/configured-owners", mode!),
          path.join(modules, name!),
          "junction",
        );
      const configPath = path.join(root, "tsconfig.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const producerModule = path.join(root, "native-source");
      await FileSystemIterator.write(
        producerModule,
        await FileSystemIterator.read(
          path.join(
            TestProject.WORKSPACE_ROOT,
            "packages/unplugin/test/fixtures/compile-probe-module",
          ),
        ),
      );
      const fixtureSource = path.join(producerModule, "compile-probe");
      config.compilerOptions.plugins.push({
        name: "shared-real-program-probe",
        transform: "./descriptors/default.cjs",
        fixtureSource,
        runLog: programRunLog,
        prefix: "a:",
        suffix: ":z",
        config: "./config/banner.config.json",
        configFile: "./config/banner.config.json",
        configPathReceipt,
        pathsReceipt,
        casePolicyReceipt,
      });
      fs.symlinkSync(
        fixtureSource,
        path.join(root, "native-producer"),
        "junction",
      );
      const automaticPackage = path.join(root, "packages/batch-auto-discovery");
      const automaticManifestFile = path.join(automaticPackage, "package.json");
      const automaticManifest = JSON.parse(
        fs.readFileSync(automaticManifestFile, "utf8"),
      );
      const reportedFiles = [
        "src/bundle.ts",
        "src/map.ts",
        "src/pool-routing/map.ts",
      ];
      // The explicitly complete files declare their real imported input tree
      // as well as the relative/absolute/duplicate/self reporting controls.
      const reportedDependencies = [
        "src/contract.ts",
        path.join(root, "src/console.d.ts"),
        "src/contract.ts",
        "src/bundle.ts",
        "src/map.ts",
        "src/factory-values.tsx",
        "src/native-pipeline.ts",
        "src/data.json",
        "src/type-population/foo.ts",
        "src/metadata-population.ts",
        path.join(root, "node_modules/batch-record-dependency/index.d.ts"),
      ];
      // Both spellings are actual independent directory links. The native
      // reporter owns their input proofs; watch policy keeps lexical aliases.
      for (const alias of ["native-source-first", "native-source-second"])
        fs.symlinkSync(
          path.join(root, "src"),
          path.join(root, alias),
          process.platform === "win32" ? "junction" : "dir",
        );
      reportedDependencies.push(
        "native-source-first/map.ts",
        path.join(root, "native-source-second/map.ts"),
        "native-source-first/map.ts",
      );
      automaticManifest.ttsc.plugin.contextReceipt = contextReceipt;
      automaticManifest.ttsc.plugin.reportedFiles = reportedFiles;
      automaticManifest.ttsc.plugin.reportedDependencies = reportedDependencies;
      fs.writeFileSync(
        automaticManifestFile,
        JSON.stringify(automaticManifest),
      );
      fs.symlinkSync(
        automaticPackage,
        path.join(modules, "batch-auto-discovery"),
        "junction",
      );
      fs.symlinkSync(
        path.join(root, "packages/batch-descriptor-input"),
        path.join(modules, "batch-descriptor-input"),
        "junction",
      );
      const consumerManifestFile = path.join(root, "package.json");
      const consumerManifest = JSON.parse(
        fs.readFileSync(consumerManifestFile, "utf8"),
      );
      consumerManifest.devDependencies = {
        ...consumerManifest.devDependencies,
        "batch-auto-discovery": "file:./packages/batch-auto-discovery",
      };
      fs.writeFileSync(consumerManifestFile, JSON.stringify(consumerManifest));
      config.compilerOptions.plugins.push(
        {
          name: "native-order-prefix",
          transform: "batch-auto-discovery/plugins/ordered.js",
          fixtureSource,
          operation: "prefix",
          prefix: "a:",
        },
        {
          name: "native-order-disabled",
          transform: "./compile-probe.cjs",
          fixtureSource,
          enabled: false,
          operation: "prefix",
          prefix: ":NO",
        },
        {
          name: "native-order-identity",
          transform: "./descriptors/context.cjs",
          fixtureSource,
          operation: "identity",
          contextProbe: factoryContextProbe,
        },
        {
          name: "native-order-upper",
          transform: "./descriptors/esm/src/index.ts",
          fixtureSource,
          operation: "upper",
          esmContextProbe: factoryEsmContextProbe,
        },
        {
          name: "native-order-suffix",
          transform: "./compile-probe.cjs",
          fixtureSource,
          operation: "suffix",
          suffix: ":z",
        },
      );
      for (const entry of config.compilerOptions.plugins)
        if (entry.fixtureSource === fixtureSource) {
          entry.contextReceipt = contextReceipt;
          entry.reportedFiles = reportedFiles;
          entry.reportedDependencies = reportedDependencies;
        }
      fs.writeFileSync(configPath, JSON.stringify(config));
      const loaderPath = path.join(root, "typed-loader.cjs");
      fs.writeFileSync(
        loaderPath,
        fs.readFileSync(loaderPath, "utf8").replace(
          "__ESBUILD_ENTRY__",
          createRequire(import.meta.url)
            .resolve("esbuild")
            .replace(/\\/g, "/"),
        ),
      );
    }
    if (!installationOnly)
      await FileSystemIterator.write(root, {
        "adapter-entries.json": JSON.stringify(
          ["farm", "rolldown", "rspack", "webpack"].map(
            (name) =>
              pathToFileURL(TestUnpluginRuntime.libPath(name, "mjs")).href,
          ),
        ),
      });
    const { source, expected } = printedValues();
    await FileSystemIterator.write(root, { "src/factory-values.tsx": source });
    const bunEntry = fs.readFileSync(path.join(root, "bun-entry.mjs"), "utf8");
    fs.writeFileSync(
      path.join(root, "bun-entry.mjs"),
      bunEntry.replace(
        "__BUN_ADAPTER__",
        pathToFileURL(TestUnpluginRuntime.libPath("bun", "mjs")).href,
      ),
    );
    if (installationOnly) {
      fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            jsx: "react",
            jsxFactory: "jsx",
            types: [],
            paths: { "@typed/*": ["./src/type-population/*"] },
            plugins: [],
          },
          include: [
            "src/contract.ts",
            "src/factory-values.tsx",
            "src/installation-runtime.ts",
          ],
        }),
      );
    }
    let sourcePublication: Workspace["sourcePublication"];
    if (!installationOnly) {
      const container = path.join(root, "tools/source-publication");
      assert.equal(fs.existsSync(container), false);
      fs.mkdirSync(container, { recursive: true });
      const source = path.join(container, "project");
      const fixture = path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        "ttsc",
        "test",
        "fixtures",
        "e2e",
        "plugin_source_state_holds_takes_a_digest_the_caller_vouches_for",
        "inputs-1",
      );
      fs.cpSync(fixture, source, {
        recursive: true,
        filter: (location) => copiesPluginSourceEntry(fixture, location),
      });
      const materializationInputs = path.join(
        TestProject.WORKSPACE_ROOT,
        "packages/ttsc/test/fixtures/e2e",
      );
      for (const filename of ["main.go", "go.mod", "asset.txt"])
        fs.copyFileSync(
          path.join(
            materializationInputs,
            "source-materialization-module",
            filename,
          ),
          path.join(source, filename),
        );
      const dependency = path.join(
        container,
        ...Array.from(
          { length: 4 },
          (_, index) => "module-depth-" + index + "-" + "x".repeat(40),
        ),
        "dependency",
      );
      assert.ok(
        dependency.length > 180,
        "the real imported workspace module must exceed the original deep-path boundary",
      );
      fs.mkdirSync(dependency, { recursive: true });
      for (const filename of ["dep.go", "go.mod"])
        fs.copyFileSync(
          path.join(
            materializationInputs,
            "source-materialization-dependency",
            filename,
          ),
          path.join(dependency, filename),
        );
      // A unique dependency identity gives the first -x observation a genuinely
      // cold helper while preserving the maintained package's authored bytes.
      const dependencyName =
        "example.com/batch-materialization-dependency-" +
        crypto.createHash("sha256").update(root).digest("hex").slice(0, 16);
      for (const target of [
        path.join(source, "main.go"),
        path.join(source, "go.mod"),
        path.join(dependency, "go.mod"),
      ]) {
        const original = fs.readFileSync(target, "utf8");
        assert.ok(
          original.includes("example.com/batch-materialization-dependency"),
        );
        fs.writeFileSync(
          target,
          original.replaceAll(
            "example.com/batch-materialization-dependency",
            dependencyName,
          ),
        );
      }
      const sourceMod = path.join(source, "go.mod");
      const moduleBytes = fs.readFileSync(sourceMod, "utf8");
      assert.ok(moduleBytes.includes("../dependency"));
      const dependencyRelative = path
        .relative(source, dependency)
        .replace(/\\/g, "/");
      fs.writeFileSync(
        sourceMod,
        moduleBytes.replace("../dependency", dependencyRelative),
      );
      for (const relative of [
        "vendor/local/value.go",
        "lib/helper.go",
        "dist/generated.go",
        "build/generated.go",
      ]) {
        const target = path.join(source, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(
          path.join(source, "internal", "rules", "rule.go"),
          target,
        );
      }
      fs.writeFileSync(
        path.join(source, ".git"),
        "gitdir: ../.git/worktrees/plugin\n",
      );
      fs.mkdirSync(path.join(source, "notes~"));
      fs.writeFileSync(
        path.join(source, "notes~", "notes.txt"),
        "kept notes\n",
      );
      fs.mkdirSync(path.join(container, "node_modules", "dependency"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(source, "node_modules"), { recursive: true });
      assert.deepEqual(fs.readdirSync(path.join(source, "node_modules")), []);
      const tools = path.join(container, "tools");
      fs.mkdirSync(tools);
      const script = path.join(tools, "actual-go.cjs");
      fs.copyFileSync(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "tests",
          "test-e2e",
          "fixtures",
          "ttsc",
          "source-plugin",
          "actual-go.cjs",
        ),
        script,
      );
      E2eProcessTrace.fixturePaths(tools, ["actual-go.cjs"]);
      const actualGo = resolveGoCompiler({
        ...process.env,
        TTSC_GO_BINARY: "",
      });
      ensureExecutableGoToolchain(actualGo.binary, actualGo.bundled);
      const go = path.join(
        tools,
        process.platform === "win32" ? "go.cmd" : "go",
      );
      fs.writeFileSync(
        go,
        process.platform === "win32"
          ? `@echo off\r\n"${process.execPath}" "%~dp0actual-go.cjs" %*\r\n`
          : `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(script)} "$@"\n`,
      );
      if (process.platform !== "win32") fs.chmodSync(go, 0o755);
      const invocations = path.join(container, "go-invocations.jsonl");
      const buildTrace = path.join(container, "go-build-actions.jsonl");
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        GOCACHE: "",
        TTSC_CACHE_DIR: "",
        TTSC_GO_CACHE_DIR: "",
        TTSC_GO_BINARY: go,
        TTSC_TEST_ACTUAL_GO: actualGo.binary,
        TTSC_TEST_GO_INVOCATIONS: invocations,
        TTSC_TEST_GO_BUILD_TRACE: buildTrace,
        GOFLAGS: "-trimpath=false",
      };
      const expected = path.join(source, "node_modules", ".cache", "ttsc");
      assert.equal(
        resolveSourceBuildCachePaths(source, undefined, env).root,
        expected,
      );
      const request = (
        root: string,
        cacheDir?: string,
        extraEnv: NodeJS.ProcessEnv = {},
        overlayDirs: string[] = [],
      ): string =>
        buildSourcePlugin({
          baseDir: root,
          env: {
            ...env,
            ...(cacheDir === undefined ? {} : { TTSC_CACHE_DIR: cacheDir }),
            ...extraEnv,
          },
          overlayDirs,
          pluginName: "canonical-source",
          quiet: true,
          source: root,
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
      const countBuilds = (): number =>
        fs
          .readFileSync(invocations, "utf8")
          .trim()
          .split(/\r?\n/)
          .map((line) => JSON.parse(line) as string[])
          .filter((args) => args[0] === "build").length;
      const buildActions = (): {
        cwd: string;
        stderr: string;
        status: number | null;
        signal: string | null;
      }[] =>
        fs
          .readFileSync(buildTrace, "utf8")
          .trim()
          .split(/\r?\n/)
          .map((line) => JSON.parse(line));
      const compiledDependency = (record: { stderr: string }): boolean =>
        record.stderr
          .split(/\r?\n/)
          .some(
            (line) =>
              /[\\/]compile(?:\.exe)?\b/.test(line) &&
              line.includes(`-p ${dependencyName} `),
          );
      const objectOutput = (
        binary: string,
        value: "first" | "second",
      ): void => {
        const result = E2eProcessTrace.spawnSync(binary, [], {
          encoding: "utf8",
          windowsHide: true,
          env: {
            ...process.env,
            TTSC_E2E_SOURCE_MATERIALIZATION_PROBE: "2",
            ORPHAN_RACE_SOURCE: undefined,
            ORPHAN_RACE_DONE: undefined,
            ORPHAN_RACE_COMPILER: undefined,
          },
        });
        assert.ok(isOrdinarilyClosedReadonlyLauncher(result));
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stderr, `${value}\n`);
        assert.equal(
          result.stdout,
          `${value}|"embedded bytes\\n"|example.com/plugin/main.go\n`,
        );
      };
      const first = request(source);
      const physicalPlugins = fs.realpathSync.native(
        path.join(expected, "plugins"),
      );
      const physicalFirst = fs.realpathSync.native(first);
      const pluginRelative = path.relative(physicalPlugins, physicalFirst);
      assert.ok(
        pluginRelative.length > 0 &&
          !path.isAbsolute(pluginRelative) &&
          pluginRelative !== ".." &&
          !pluginRelative.startsWith(".." + path.sep),
        JSON.stringify({
          expected,
          first,
          physicalPlugins,
          physicalFirst,
          pluginRelative,
        }),
      );
      assert.ok(fs.existsSync(first));
      assert.equal(
        countBuilds(),
        1,
        "the cold request must compile exactly once",
      );
      const execution = E2eProcessTrace.spawnSync(first, [], {
        encoding: "utf8",
        windowsHide: true,
        env: {
          ...process.env,
          ORPHAN_RACE_SOURCE: undefined,
          ORPHAN_RACE_DONE: undefined,
          ORPHAN_RACE_COMPILER: undefined,
          TTSC_E2E_SOURCE_MATERIALIZATION_PROBE: "2",
        },
      });
      if (!isOrdinarilyClosedReadonlyLauncher(execution))
        throw new Error(
          "published smoke did not return ordinary status/signal/PID metadata",
          {
            cause:
              execution.error ??
              new Error(
                JSON.stringify({
                  pid: execution.pid,
                  status: execution.status,
                  signal: execution.signal,
                }),
              ),
          },
        );
      if (execution.error) throw execution.error;
      assert.equal(execution.status, 0, execution.stderr);
      assert.equal(
        execution.stdout,
        'first|"embedded bytes\\n"|example.com/plugin/main.go\n',
      );
      assert.equal(
        execution.stderr.trim(),
        "first",
        "the published program must consume the actual deep external replacement",
      );
      assert.equal(
        resolveSourceBuildCachePaths(source, undefined, env).root,
        expected,
      );
      const secondSource = path.join(container, "relocated");
      fs.cpSync(source, secondSource, {
        recursive: true,
        filter: (location) => copiesPluginSourceEntry(source, location),
      });
      const firstBytes = fs.readFileSync(first);
      const second = request(secondSource, expected);
      assert.equal(
        fs.realpathSync.native(second),
        physicalFirst,
        "equivalent source roots must share the published content identity",
      );
      assert.equal(
        countBuilds(),
        1,
        "the relocated request must not compile again",
      );
      assert.deepEqual(fs.readFileSync(second), fs.readFileSync(first));
      assert.deepEqual(
        fs.readFileSync(second),
        firstBytes,
        "warm reuse must preserve pre-request artifact bytes",
      );
      const panic = E2eProcessTrace.spawnSync(first, ["panic"], {
        encoding: "utf8",
        windowsHide: true,
        env: {
          ...process.env,
          TTSC_E2E_SOURCE_MATERIALIZATION_PROBE: "2",
          ORPHAN_RACE_SOURCE: undefined,
          ORPHAN_RACE_DONE: undefined,
          ORPHAN_RACE_COMPILER: undefined,
        },
      });
      assert.equal(panic.error, undefined);
      assert.equal(panic.signal, null);
      assert.equal(panic.status, 2);
      assert.match(panic.stderr, /panic: source-build-panic/);
      assert.ok(panic.stderr.includes("example.com/plugin/main.go:"));
      assert.equal(panic.stderr.includes(buildActions()[0]!.cwd), false);
      fs.unlinkSync(first);
      const rebuilt = request(secondSource, expected);
      assert.equal(
        fs.realpathSync.native(rebuilt),
        physicalFirst,
        "binary-only deletion must rebuild the unchanged content identity",
      );
      assert.equal(countBuilds(), 2);
      objectOutput(rebuilt, "first");
      const rebuiltBytes = fs.readFileSync(rebuilt);
      const initialActions = buildActions();
      assert.equal(initialActions.length, 2);
      assert.notEqual(initialActions[0]!.cwd, initialActions[1]!.cwd);
      assert.equal(
        compiledDependency(initialActions[0]!),
        true,
        "the unique dependency must compile cold",
      );
      assert.equal(
        compiledDependency(initialActions[1]!),
        false,
        "unchanged dependency objects must survive a genuinely cold binary rebuild",
      );
      const dependencySource = path.join(dependency, "dep.go");
      const dependencyMod = path.join(dependency, "go.mod");
      const originalDependency = fs.readFileSync(dependencySource);
      const originalDependencyMod = fs.readFileSync(dependencyMod);
      const originalSourceMod = fs.readFileSync(sourceMod);
      try {
        const sourceModText = originalSourceMod.toString("utf8");
        assert.ok(sourceModText.includes(dependencyRelative));
        fs.writeFileSync(
          sourceMod,
          sourceModText.replace(
            dependencyRelative,
            JSON.stringify(dependency.replace(/\\/g, "/")),
          ),
        );
        const absolutePublication = request(source, expected);
        assert.equal(
          countBuilds(),
          3,
          "the changed authored replace spelling is a distinct source identity",
        );
        const absoluteExecution = E2eProcessTrace.spawnSync(
          absolutePublication,
          [],
          {
            encoding: "utf8",
            windowsHide: true,
            env: {
              ...process.env,
              TTSC_E2E_SOURCE_MATERIALIZATION_PROBE: "2",
              ORPHAN_RACE_SOURCE: undefined,
              ORPHAN_RACE_DONE: undefined,
              ORPHAN_RACE_COMPILER: undefined,
            },
          },
        );
        assert.ok(isOrdinarilyClosedReadonlyLauncher(absoluteExecution));
        assert.equal(absoluteExecution.error, undefined);
        assert.equal(absoluteExecution.signal, null);
        assert.equal(absoluteExecution.status, 0, absoluteExecution.stderr);
        assert.equal(
          absoluteExecution.stdout,
          'first|"embedded bytes\\n"|example.com/plugin/main.go\n',
        );
        assert.equal(
          absoluteExecution.stderr.trim(),
          "first",
          "absolute and relative replacements must consume the same unchanged external module",
        );
        const dependencyText = originalDependency.toString("utf8");
        assert.ok(dependencyText.includes('"first"'));
        fs.writeFileSync(
          dependencySource,
          dependencyText.replace('"first"', '"second"'),
        );
        const changed = request(source, expected);
        assert.notEqual(
          fs.realpathSync.native(changed),
          fs.realpathSync.native(absolutePublication),
          "changed external module bytes alone must publish a new content identity",
        );
        assert.equal(
          countBuilds(),
          4,
          "one shared source graph rebuilds once for the external input transition",
        );
        assert.equal(
          compiledDependency(buildActions()[3]!),
          true,
          "changed dependency bytes must produce a new Go object action",
        );
        const changedExecution = E2eProcessTrace.spawnSync(changed, [], {
          encoding: "utf8",
          windowsHide: true,
          env: {
            ...process.env,
            TTSC_E2E_SOURCE_MATERIALIZATION_PROBE: "2",
            ORPHAN_RACE_SOURCE: undefined,
            ORPHAN_RACE_DONE: undefined,
            ORPHAN_RACE_COMPILER: undefined,
          },
        });
        assert.ok(
          isOrdinarilyClosedReadonlyLauncher(changedExecution),
          "changed publication must have an ordinary closed execution receipt",
        );
        assert.equal(changedExecution.error, undefined);
        assert.equal(changedExecution.signal, null);
        assert.equal(changedExecution.status, 0, changedExecution.stderr);
        assert.equal(
          changedExecution.stdout,
          'second|"embedded bytes\\n"|example.com/plugin/main.go\n',
        );
        assert.equal(changedExecution.stderr.trim(), "second");
        // Use the maintained dependency bytes to form the malformed state;
        // restoration precedes the separate workspace-role transition.
        assert.ok(dependencyText.includes('return "first" }'));
        fs.writeFileSync(
          dependencySource,
          dependencyText.replace('return "first" }', "return"),
        );
        assert.throws(() => request(source, expected), /syntax error/);
        assert.equal(
          countBuilds(),
          5,
          "the malformed dependency must reach one real rejected build",
        );
        fs.writeFileSync(
          dependencySource,
          dependencyText.replace('"first"', '"second"'),
        );
        // The same module cannot be both an authored external replacement and
        // a workspace-owned overlay. Advance this source graph to the overlay
        // role only after removing its existing replace directive.
        const replaceLines = sourceModText
          .split(/\r?\n/)
          .filter((line) => line.startsWith("replace "));
        assert.equal(replaceLines.length, 1);
        assert.ok(replaceLines[0]!.includes(dependencyRelative));
        fs.writeFileSync(
          sourceMod,
          sourceModText
            .split(/\r?\n/)
            .filter((line) => line !== replaceLines[0])
            .join("\n"),
        );
        const workspacePublication = request(source, expected, {}, [
          dependency,
        ]);
        assert.ok(
          fs.existsSync(workspacePublication),
          "the actual patch-qualified modules must build together as workspace use entries",
        );
        assert.equal(
          countBuilds(),
          6,
          "the replacement-to-workspace role transition has one distinct native build",
        );
        // Metadata reads the workspace's proven external copy. The prior
        // replacement-only epochs do not read this dependency's go.mod.
        const workspaceBuild = buildActions().at(-1);
        assert.ok(workspaceBuild);
        assert.equal(workspaceBuild.status, 0);
        assert.equal(workspaceBuild.signal, null);
        const observedGoArguments = fs
          .readFileSync(invocations, "utf8")
          .trim()
          .split(/\r?\n/)
          .map((line) => JSON.parse(line) as string[]);
        const dependencyLayout = path.relative(
          path.parse(dependency).root,
          path.join(dependency, "go.mod"),
        );
        const externalCopies = path.join(
          workspaceBuild.cwd,
          ".ttsc",
          "external",
        );
        assert.ok(
          observedGoArguments.some((args) => {
            if (args[0] !== "mod" || args[1] !== "edit" || args[2] !== "-json")
              return false;
            const filename = args[3];
            if (typeof filename !== "string" || !path.isAbsolute(filename))
              return false;
            const relative = path.relative(externalCopies, filename);
            return (
              filename.length > 180 &&
              relative !== ".." &&
              !relative.startsWith(".." + path.sep) &&
              !path.isAbsolute(relative) &&
              relative.endsWith(path.sep + dependencyLayout)
            );
          }),
          "the actual workspace metadata process must accept its deeply nested absolute copied module filename: " +
            JSON.stringify({
              buildCwd: workspaceBuild.cwd,
              dependencyLayout,
              observedGoArguments,
            }),
        );
        const dependencyModText = originalDependencyMod.toString("utf8");
        assert.ok(dependencyModText.includes("go 1.26.0"));
        fs.writeFileSync(
          dependencyMod,
          dependencyModText.replace("go 1.26.0", "go 1.99.0"),
        );
        assert.throws(
          () =>
            request(source, expected, { GOTOOLCHAIN: "local" }, [dependency]),
          /go >= 1\.99\.0/,
          "the real Go workspace must reject an incompatible imported overlay instead of guessing a lower version",
        );
        assert.equal(
          countBuilds(),
          6,
          "the incompatible workspace must fail before native build publication",
        );
      } finally {
        fs.writeFileSync(dependencySource, originalDependency);
        fs.writeFileSync(dependencyMod, originalDependencyMod);
        fs.writeFileSync(sourceMod, originalSourceMod);
      }
      assert.equal(
        fs.realpathSync.native(request(source, expected)),
        physicalFirst,
        "restored dependency bytes must reuse the original publication",
      );
      assert.equal(countBuilds(), 6);
      assert.deepEqual(
        fs.readFileSync(first),
        rebuiltBytes,
        "restored warm reuse must preserve the independently captured rebuilt publication; the deleted first publication is a different artifact lifetime",
      );
      sourcePublication = { binary: physicalFirst, root };
      const runtimeRace = path.join(
        root,
        "node_modules/batch-native-source-race",
      );
      assert.equal(fs.existsSync(runtimeRace), false);
      fs.mkdirSync(runtimeRace);
      fs.copyFileSync(
        path.join(root, "tools/native-source-race/index.ts"),
        path.join(runtimeRace, "index.ts"),
      );
      fs.copyFileSync(
        path.join(root, "tools/native-source-race/identity.ts"),
        path.join(runtimeRace, "identity.ts"),
      );
      fs.copyFileSync(
        path.join(root, "tools/native-source-race/package.json"),
        path.join(runtimeRace, "package.json"),
      );
    }
    return {
      root,
      expected,
      graphNegativeRoot,
      installedTtsx,
      installationOnly,
      sourcePublication,
      programRunLog,
      contextReceipt,
      factoryContextProbe,
      factoryEsmContextProbe,
      configPathReceipt,
      pathsReceipt,
      casePolicyReceipt,
      projectAlias,
      cache: TestProject.sharedPluginCache(),
    };
  }

  /** The original factory matrix supplies inputs before any printer runs. */
  function printedValues(): {
    source: string;
    expected: Workspace["expected"];
  } {
    const cases: [string, string][] = [
      ["empty", ""],
      ["plain", "plain text"],
      ["double quote", 'say "hello"'],
      ["single quote", "it's text"],
      ["both quotes", `"'`],
      ["ampersand", "a&b"],
      ["named entity text", "&quot;&amp;&apos;"],
      ["numeric entity text", "&#13;&#x2028;"],
      ["unknown entity text", "&unknown;"],
      ["backslash", 'a\\b\\n\\"'],
      ["markup", "<tag>{text}>"],
      ["CRLF", "a\r\nb"],
      ["CR", "a\rb"],
      ["LF", "a\nb"],
      ["LS", "a\u2028b"],
      ["PS", "a\u2029b"],
      ["DEL", "a\x7fb"],
      ["high surrogate start", "a\ud800b"],
      ["high surrogate end", "a\udbffb"],
      ["low surrogate start", "a\udc00b"],
      ["low surrogate end", "a\udfffb"],
      ["astral pair", "a\u{1f600}b"],
      ...Array.from({ length: 32 }, (_, code): [string, string] => [
        `C0 ${code}`,
        `a${String.fromCharCode(code)}b`,
      ]),
      ["combined payload", '\0\r\n\u2028\ud800\udfff&quot;\\n"'],
    ];
    const expected: { title: string; units: number[] }[] = [];
    const printed: string[] = [];
    for (const [name, value] of cases)
      for (const singleQuote of [false, true])
        for (const printWidth of [1, 200]) {
          const printer = new TsPrinter({ printWidth });
          const literal = factory.createStringLiteral(value, singleQuote);
          for (const kind of ["attribute", "expression", "ordinary"]) {
            const title = `${name}, singleQuote=${singleQuote}, width=${printWidth}, context=${kind}`;
            expected.push({
              title,
              units: value.split("").map((unit) => unit.charCodeAt(0)),
            });
            const node =
              kind === "ordinary"
                ? literal
                : factory.createJsxSelfClosingElement(
                    factory.createIdentifier("div"),
                    undefined,
                    factory.createJsxAttributes([
                      factory.createJsxAttribute(
                        factory.createIdentifier("value"),
                        kind === "expression"
                          ? factory.createJsxExpression(undefined, literal)
                          : literal,
                      ),
                    ]),
                  );
            printed.push(printer.print(node));
          }
        }
    expected.push({
      title: "independent numeric-entity specimen",
      units: [
        0, 13, 10, 8232, 55296, 57343, 38, 113, 117, 111, 116, 59, 92, 110, 34,
      ],
    });
    printed.push(
      '<div value="&#0;&#13;&#10;&#8232;&#55296;&#57343;&amp;quot;\\n&quot;" />',
    );
    return {
      expected,
      source: [
        "declare global { namespace JSX { interface IntrinsicElements { div: { value: string } } } }",
        "function jsx(_tag: string, props: { value: string }): string { return props.value; }",
        `export const values = [${printed.join(",\n")}];`,
      ].join("\n"),
    };
  }
}
