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
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

import factory, { TsPrinter } from "../../../../packages/factory/src/index";
import { resolveGraphBinary } from "../../../../packages/graph/src/resolveGraphBinary";
import { PluginBuildEnvironmentWitness } from "../../../../packages/ttsc/lib/plugin/internal/source/PluginBuildEnvironmentWitness.js";
import { buildSourcePlugin } from "../../../../packages/ttsc/lib/plugin/internal/source/buildSourcePlugin.js";
import { copiesPluginSourceEntry } from "../../../../packages/ttsc/lib/plugin/internal/source/copiesPluginSourceEntry.js";
import { ensureExecutableGoToolchain } from "../../../../packages/ttsc/lib/plugin/internal/source/ensureExecutableGoToolchain.js";
import { pluginBuildEnvironment } from "../../../../packages/ttsc/lib/plugin/internal/source/pluginBuildEnvironment.js";
import { resolveGoCompiler } from "../../../../packages/ttsc/lib/plugin/internal/source/resolveGoCompiler.js";
import { resolveSourceBuildCachePaths } from "../../../../packages/ttsc/lib/plugin/internal/source/resolveSourceBuildCachePaths.js";
import { spawnGoTool } from "../../../../packages/ttsc/lib/plugin/internal/source/spawnGoTool.js";
import { CompilerArchives } from "../../../utils/src/CompilerArchives";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { prepareEvidenceDependencies } from "../../../utils/src/evidence/prepareEvidenceDependencies";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { shellQuote } from "../internal/ttsc/internal/source-build";

/**
 * Owns the one corpus all nine real boundary sessions consume. The authored
 * host-platform override binds nested optional edges to the same packed
 * candidate as the root dependency. Default compiler/server/Go/Graph locators
 * must select that physical file and the independent pack producer bytes;
 * locator assertions do not certify subsequent CLI execution or override
 * lanes.
 */
export namespace BatchWorkspace {
  export interface Workspace {
    /** Exact tmpdir allocation key; native root is a separate input authority. */
    allocatedRoot: string;
    root: string;
    graphNegativeRoot: string;
    /** Wrapper discovery is outside the shared root's eligible lint config. */
    lintWrapperRoot: string;
    /** Independent default-cache maintenance owner, without a prior consumer. */
    descriptorCollectionRoot: string;
    /** Editor source/config island; command copies exclude other actor assets. */
    lspEditorRoot: string;
    /** Checker/MCP source owner without another actor's emission producers. */
    graphRoot: string;
    cache: string;
    /** Relative CLI contrast stays local even with an external absolute cache. */
    runtimeCliCache: string;
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
    /** Run-owned archives isolated from file entries mirrored by runtime hosts. */
    compilerArchives: CompilerArchives.Owner;
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
    workspace: Pick<Workspace, "contextReceipt">,
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
    workspace: Pick<Workspace, "pathsReceipt">,
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
    vm.runInContext(code, context);
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
      void preparation.then(({ allocatedRoot }) =>
        TestProject.retainTemporaryDirectory(allocatedRoot, reason),
      );
  }

  /** Release shared inputs only after all consumers have returned. */
  export async function close(): Promise<void> {
    if (reuseFailure !== undefined) return;
    if (preparation === undefined) return;
    const {
      root,
      projectAlias,
      graphNegativeRoot,
      cache,
      runtimeCliCache,
      compilerArchives,
    } = await preparation;
    if (!fs.existsSync(root)) return;
    compilerArchives.close(() => {
      if (runtimeCliCache !== cache)
        fs.rmSync(runtimeCliCache, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 100,
        });
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
    });
  }

  /**
   * Author the shared installation, native-source inputs and observation-output
   * population before consumers acquire compiler input snapshots. Empty Program
   * receipts describe the initial output state; only native appends establish
   * executions and context. They remain at the existing consumer coordinates.
   * The source-publication preparation also retains real Go failure statuses
   * before and after its self-rewriting toolchain witness experiment. Windows
   * exits from the wrapper immediately after Node, so appended comments cannot
   * change the compiler's verdict. The wrapper clears an inherited ERRORLEVEL
   * environment shadow before Node runs, retaining the dynamic child status.
   * Actual toolchain epochs distinguish a one-time transition, persistent
   * motion and stable recovery from terminal source, native and cleanup
   * failures. The copied main module's assembly input guarantees a real SDK
   * assembler execution while preserving reuse of unrelated Go objects.
   *
   * @evidence contracts/common.md#principled-implementation Packed installed artifacts and authored source/config inputs establish the shared consumer graph. A private archive directory stays opaque to runtime ancestor mirroring, which hard-links regular file entries and changes their native version metadata; the archive identity and content guards remain intact. Exclusively creating the five observation files empty before snapshot acquisition preserves stable root membership without pretending a native Program ran; actual O_APPEND calls still produce all ticks and receipts. The Go adapter returns Node's actual exit immediately on Windows and uses exec on POSIX. Unsupported-help status 2 and version status 0 under absent/0/999 inherited status shadows before and after byte rewrites independently distinguishes failed tool execution from successful publication. Runtime package-star inputs are linked from their authored package root. The installed-boundary island uses native realpath equality to prove that its lowercase package spelling reaches its physical uppercase store, and links a workspace to its actual outside-store source; no runtime resolution method is replaced.
   * @evidence contracts/common.md#clear-and-simple-design One preparation owns the installation and fixture population, while consumers own operations and assertions. The existing five output coordinates remain Workspace fields so their native writers and runtime readers keep one identity.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Output initialization neither warms a compiler nor substitutes a cached result. Exclusive creation refuses prior content rather than truncating evidence. Actual wrapper writes and a nonempty native completion-marker directory exercise strict witness rejection and lease cleanup failure without replacing foreign filesystem methods. Initial cold attempts require independent before/after tool metadata evidence for every discarded build and a stable final epoch; they are not accepted merely because a retry passed.
   * @evidence contracts/common.md#meaningful-documentation The setup comment distinguishes an empty owned output from an execution receipt and explains why its directory member exists before a reader snapshots it. It also identifies the Windows exit boundary needed by the self-rewriting adapter.
   * @evidence contracts/portability.md#os-neutral-implementation The canonical native root and Node path/file APIs author the same five output spellings on each supported OS. Exclusive wx creation uses filesystem ownership semantics. Windows wrappers return the Node child status with exit /b before appended batch lines after clearing its case-insensitive ERRORLEVEL environment shadow, while POSIX exec replaces the shell; both retain the underlying Go command verdict through the existing native quoting owner. Existing native lowercase aliasing is preserved; otherwise a supported directory link establishes that identity explicitly. No OS-wide case folding establishes project ownership, and explicit cts/mts inputs keep module-format inference out of the boundary experiment.
   * @evidence contracts/performance.md#efficient-algorithms Preparation copies complete selected fixture and installed payloads, hashes candidate executable bytes, installs packages, prints the authored value matrix, and runs its real source-publication builds and toolchain observations. Compiler archives additionally stream their exact bytes at publication and actual reader boundaries; their immutable generation avoids another SDK/platform pack without scanning source trees or querying package configuration. Population and byte sizes drive IO, buffers and native subprocess cost. The status regression runs twelve real Go processes across absent/0/999 status shadows. The epoch matrix adds nine actual builds using the existing source and Go object storage, plus nine version observations for the persistently moving reader; the initial cold producer permits at most three independently witnessed build epochs. Each build receipt traverses selected SDK bin/tool metadata. These checks add no installation or native host profile.
   * @evidence contracts/performance.md#reuse-equivalent-work The process-owned preparation Promise shares this fixture population. Epoch cases isolate plugin namespaces while sharing the existing Go object root; only the first unique dependency action compiles cold, and a stable recovered publication is reused with zero additional Go builds. Native metadata and binary execution establish validity rather than expected retry counts alone.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Observation files and isolated epoch roots belong to the allocated project's cleanup/retention lifecycle. Each matrix case restores its owned launcher/source bytes in finally; ordinary paths assert removed scratch inputs, released current leases and absent pending candidates. The deliberately poisoned release retains its failed native coordination state for project cleanup and proves no second epoch begins. Reader tokens remain product process-owned until exit; partial failures retain actual receipts.
   */
  async function prepare(): Promise<Workspace> {
    // Choose one native spelling before authoring absolute config/cwd inputs.
    // Intentional project aliases below remain separately authored inputs.
    // The entry's initial TEMP/TMP/TMPDIR owns every sibling allocation.
    const temporaryParent = os.tmpdir();
    const cache = TestProject.sharedPluginCache(temporaryParent);
    const allocatedRoot = TestProject.tmpdir(
      "ttsc-shared-boundaries-",
      temporaryParent,
    );
    const root = fs.realpathSync.native(allocatedRoot);
    // Always isolate the relative CLI contrast beside its project allocation.
    // A distant shared /tmp cache can resolve identically from both authored
    // callers after enough '..' segments reach the filesystem root. Sibling
    // authority preserves the independently wrong-caller contrast on POSIX as
    // well as the existing same-volume Windows requirement.
    const runtimeCliCache = TestProject.tmpdir(
      "ttsc-runtime-relative-cache-",
      temporaryParent,
    );
    if (runtimeCliCache !== cache)
      TestProject.retainTemporaryDirectory(
        runtimeCliCache,
        "Relative runtime cache consumers have not completed",
      );
    // Retain throughout the run. The runner explicitly releases only its own
    // completed consumers; a rejected or unknown lifetime keeps all inputs.
    TestProject.retainTemporaryDirectory(
      allocatedRoot,
      "Shared boundary consumers have not completed",
    );
    const inputs = await FileSystemIterator.read(
      path.resolve(import.meta.dirname, "../../fixtures/shared"),
    );
    await FileSystemIterator.write(root, inputs);
    const mutableLint = path.join(root, "tools/mutable-lint-producer");
    const owningLint = path.join(TestProject.WORKSPACE_ROOT, "packages/lint");
    fs.mkdirSync(mutableLint, { recursive: true });
    for (const entry of [
      "package.json",
      "go.mod",
      "go.sum",
      "internal",
      "lib",
      "linthost",
      "plugin",
      "rule",
      "src",
    ]) {
      const from = path.join(owningLint, entry);
      if (fs.existsSync(from))
        fs.cpSync(from, path.join(mutableLint, entry), { recursive: true });
    }
    const mutableModules = path.join(mutableLint, "node_modules");
    const owningModules = path.join(owningLint, "node_modules");
    fs.mkdirSync(mutableModules, { recursive: true });
    for (const name of fs.readdirSync(owningModules)) {
      if (!fs.statSync(path.join(owningModules, name)).isDirectory()) continue;
      if (name.startsWith("@")) {
        fs.mkdirSync(path.join(mutableModules, name));
        for (const dependency of fs.readdirSync(path.join(owningModules, name)))
          fs.symlinkSync(
            path.join(owningModules, name, dependency),
            path.join(mutableModules, name, dependency),
            process.platform === "win32" ? "junction" : "dir",
          );
      } else
        fs.symlinkSync(
          path.join(owningModules, name),
          path.join(mutableModules, name),
          process.platform === "win32" ? "junction" : "dir",
        );
    }
    const nativeWatchModules = path.join(
      root,
      "tools/native-watch/node_modules/@ttsc",
    );
    fs.mkdirSync(nativeWatchModules, { recursive: true });
    fs.symlinkSync(
      mutableLint,
      path.join(nativeWatchModules, "lint"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const selectionModules = path.join(
      root,
      "tools/lsp-selection/node_modules/@ttsc",
    );
    fs.mkdirSync(selectionModules, { recursive: true });
    fs.symlinkSync(
      mutableLint,
      path.join(selectionModules, "lint"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await FileSystemIterator.write(
      path.join(root, "tools/native-topology"),
      await FileSystemIterator.read(
        path.resolve(import.meta.dirname, "../../fixtures/ttsc/api/baseline"),
      ),
    );
    await FileSystemIterator.write(
      path.join(root, "tools/native-topology/plugin"),
      await FileSystemIterator.read(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages/ttsc/test/fixtures/e2e/plugin_source_state_holds_takes_a_digest_the_caller_vouches_for/inputs-1",
        ),
      ),
    );
    const graphNegativeRoot = TestProject.tmpdir(
      "ttsc-shared-graph-uninstalled-",
      temporaryParent,
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
    // A wrapper with no nearby config must reach cwd fallback. Placing it
    // below root would instead discover root/lint.config.cjs first. Reuse the
    // upfront uninstalled namespace without adding root package dependencies
    // or sources selected by its own include:["src"] graph input.
    const lintWrapperRoot = path.join(
      fs.realpathSync.native(graphNegativeRoot),
      "lint-wrappers",
    );
    for (const mode of ["fallback", "selected"]) {
      const original = path.join(root, "tools/native-lint-wrappers", mode);
      const target = path.join(lintWrapperRoot, mode);
      await FileSystemIterator.write(
        target,
        await FileSystemIterator.read(original),
      );
      const wrapper = JSON.parse(
        fs.readFileSync(path.join(original, "tsconfig.json"), "utf8"),
      ) as {
        extends: string;
        include: string[];
        files: string[];
      };
      fs.writeFileSync(
        path.join(target, "tsconfig.json"),
        JSON.stringify({
          ...wrapper,
          extends: path.resolve(original, wrapper.extends),
          files: wrapper.files.map((file) => path.resolve(original, file)),
        }),
      );
    }
    const descriptorCollectionRoot = path.join(
      fs.realpathSync.native(graphNegativeRoot),
      "descriptor-collection",
    );
    await FileSystemIterator.write(
      descriptorCollectionRoot,
      await FileSystemIterator.read(
        path.join(root, "tools/descriptor-collection"),
      ),
    );
    // This copied package declares its own workspace, independently of the
    // checkout's ancestors. No package is installed in the graph-negative root.
    fs.mkdirSync(path.join(descriptorCollectionRoot, "node_modules"));
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
    fs.symlinkSync(
      path.dirname(fs.realpathSync.native(process.execPath)),
      path.join(root, "tools/service/runtime-node"),
      "junction",
    );
    const runtimeFailureStorage = path.join(
      root,
      "tools/runtime-cache-failure/storage",
    );
    await FileSystemIterator.write(
      path.join(root, "tools/native-dead-claim/native-producer"),
      await FileSystemIterator.read(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages/unplugin/test/fixtures/native-transform-producer",
        ),
      ),
    );
    for (const mode of ["root", "index"] as const) {
      const original = path.join(runtimeFailureStorage, mode + "-original");
      const victim = path.join(runtimeFailureStorage, mode + "-victim");
      const cache = path.join(runtimeFailureStorage, mode + "-cache");
      fs.mkdirSync(original, { recursive: true });
      fs.mkdirSync(victim, { recursive: true });
      if (mode === "index") fs.mkdirSync(cache);
      fs.symlinkSync(
        original,
        mode === "root" ? cache : path.join(cache, "project"),
        process.platform === "win32" ? "junction" : "dir",
      );
    }
    const serveDeclarations = path.join(
      root,
      "tools/vite-serve/node_modules/types-only",
    );
    fs.mkdirSync(serveDeclarations, { recursive: true });
    fs.copyFileSync(
      path.join(root, "tools/vite-serve/external.d.ts"),
      path.join(serveDeclarations, "index.d.ts"),
    );
    fs.mkdirSync(path.join(root, "tools/vite-serve/node_modules/@types"));
    fs.symlinkSync(
      path.join(root, "tools/vite-serve/packages/linked-pkg"),
      path.join(root, "tools/vite-serve/node_modules/linked-pkg"),
      "junction",
    );
    const lintConfigRoot = path.join(root, "tools/native-lint-config");
    // Resolve-only root candidates stay absent. Their fallback bytes and owned
    // target share this already necessary config island; preparation writes only
    // its package manifests, never a filesystem-root entry.
    const filesystemRoot = path.parse(lintConfigRoot).root;
    const absentAncestor = path.join(
      filesystemRoot,
      "ttsc-lint-absent-ancestor",
    );
    const rootLevelMain = path.join(
      filesystemRoot,
      "ttsc-lint-absent-root-main.js",
    );
    for (const missing of [absentAncestor, rootLevelMain])
      assert.throws(() => fs.lstatSync(missing), { code: "ENOENT" });
    for (const [name, main] of [
      ["root-boundary-absent-main", path.join(absentAncestor, "main.cjs")],
      ["root-boundary-root-main", rootLevelMain],
      [
        "root-boundary-owned-main",
        path.join(lintConfigRoot, "owned-root-boundary/target.cjs"),
      ],
    ] as const)
      await FileSystemIterator.write(
        path.join(lintConfigRoot, "node_modules", name),
        {
          "package.json": JSON.stringify({ main }),
          ...(name !== "root-boundary-owned-main"
            ? {
                "index.js": fs.readFileSync(
                  path.join(
                    lintConfigRoot,
                    "root-boundary-templates",
                    name,
                    "index.js",
                  ),
                  "utf8",
                ),
              }
            : {}),
        },
      );
    fs.mkdirSync(path.join(lintConfigRoot, ".next/types"), { recursive: true });
    fs.copyFileSync(
      path.join(lintConfigRoot, "templates/next-types.ts"),
      path.join(lintConfigRoot, ".next/types/generated.ts"),
    );
    for (const [name, target] of [
      ["@ttsc/lint", path.join(TestProject.WORKSPACE_ROOT, "packages/lint")],
      [
        "lint-contributor-demo",
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages/lint/test/lint-contributor-demo",
        ),
      ],
    ] as const) {
      const link = path.join(lintConfigRoot, "node_modules", name);
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(target, link, "junction");
    }
    const orphanPackage = path.join(
      root,
      "tools/runtime-frontdoors/node_modules/runtime-cache-control",
    );
    for (const [template, destination] of [
      ["scoped", "@scope/preload"],
      ["plain", "plain-preload"],
    ] as const)
      await FileSystemIterator.write(
        path.join(root, "tools/runtime-frontdoors/node_modules", destination),
        await FileSystemIterator.read(
          path.join(
            root,
            "tools/runtime-frontdoors/preload-templates",
            template,
          ),
        ),
      );
    await FileSystemIterator.write(
      orphanPackage,
      await FileSystemIterator.read(
        path.join(root, "tools/runtime-frontdoors/orphan-template"),
      ),
    );
    const decoratorFixture = JSON.parse(
      fs.readFileSync(
        path.resolve(
          import.meta.dirname,
          "../internal/ttsc/internal/runtime-decorator-fixture.json",
        ),
        "utf8",
      ),
    );
    await FileSystemIterator.write(orphanPackage, {
      "src/index.ts":
        'import { Value } from "./enum";\n' +
        decoratorFixture.source +
        "\nexport const answer = Value.Entry;\n",
    });
    const installationOnly = process.argv.includes("--installation");
    const target = `${process.platform}-${process.arch}`;
    const pnpm = (args: string[], cwd: string): void => {
      execFileSync("pnpm", args, {
        cwd,
        shell: process.platform === "win32",
        stdio: "inherit",
      });
    };
    assert.ok(
      process.env.npm_execpath,
      "The E2E runner must be launched through pnpm",
    );
    const compilerDirectories = ["packages/ttsc", `packages/ttsc-${target}`];
    // Runtime layouts mirror root files through hardlinks. Keep immutable
    // archives inside an opaque directory so those links cannot change their
    // native version metadata before another installation borrows them.
    const compilerArchiveRoot = path.join(root, ".compiler-archives");
    fs.mkdirSync(compilerArchiveRoot);
    const compilerArchives = CompilerArchives.create({
      repository: TestProject.WORKSPACE_ROOT,
      output: compilerArchiveRoot,
      allocation: root,
      directories: compilerDirectories,
      produce: (directory, archive) =>
        E2eProcessTrace.execFileSync(
          process.execPath,
          [process.env.npm_execpath!, "pack", "--out", archive],
          {
            cwd: path.join(TestProject.WORKSPACE_ROOT, directory),
            stdio: "inherit",
            windowsHide: true,
          },
        ),
      retain,
      observe: (event) =>
        console.info("TTSC_COMPILER_ARCHIVE_COST " + JSON.stringify(event)),
    });
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
          ttsc: "file:./.compiler-archives/ttsc.tgz",
          [`@ttsc/${target}`]: `file:./.compiler-archives/ttsc-${target}.tgz`,
          typescript: "7.0.2",
        },
        pnpm: {
          ...authoredManifest.pnpm,
          overrides: {
            ...authoredManifest.pnpm?.overrides,
            [`@ttsc/${target}`]: `file:./.compiler-archives/ttsc-${target}.tgz`,
          },
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
    pnpm(
      [
        "install",
        "--ignore-workspace",
        "--ignore-scripts",
        "--no-frozen-lockfile",
      ],
      root,
    );
    const installed = createRequire(path.join(root, "package.json"));
    const sdk = path.dirname(installed.resolve("ttsc/package.json"));
    // Root and nested optional edges must select the same packed candidate.
    // Version equality alone cannot establish the consumed executable bytes.
    const candidatePlatform = path.dirname(
      installed.resolve(`@ttsc/${target}/package.json`),
    );
    const fromInstalledSdk = createRequire(path.join(sdk, "package.json"));
    const executableSuffix = process.platform === "win32" ? ".exe" : "";
    const defaultNativePaths = [
      [
        "ttsc",
        fromInstalledSdk("ttsc/binary").resolveBinary({ env: {} }),
        `bin/ttsc${executableSuffix}`,
      ],
      [
        "ttscserver",
        fromInstalledSdk(
          path.join(sdk, "lib/launcher/internal/resolveTtscserverBinary.js"),
        ).resolveTtscserverBinary({ env: {} }),
        `bin/ttscserver${executableSuffix}`,
      ],
      [
        "go",
        fromInstalledSdk(
          path.join(sdk, "lib/plugin/internal/source/resolveGoCompiler.js"),
        ).resolveGoCompiler({}).binary,
        `bin/go/bin/go${executableSuffix}`,
      ],
      [
        "ttscgraph",
        resolveGraphBinary({}, root),
        `bin/ttscgraph${executableSuffix}`,
      ],
    ] as const;
    for (const [name, selected, relativeBinary] of defaultNativePaths) {
      assert.ok(
        typeof selected === "string",
        name + " must select the installed candidate",
      );
      const expected = path.join(candidatePlatform, relativeBinary);
      const candidateIdentity = fs.statSync(expected, { bigint: true });
      const selectedIdentity = fs.statSync(selected, { bigint: true });
      assert.equal(
        fs.realpathSync.native(selected),
        fs.realpathSync.native(expected),
        name + " must resolve the candidate physical file",
      );
      assert.equal(selectedIdentity.dev, candidateIdentity.dev);
      assert.equal(selectedIdentity.ino, candidateIdentity.ino);
      const producerBytes = fs.readFileSync(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages",
          `ttsc-${target}`,
          relativeBinary,
        ),
      );
      assert.equal(
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(selected))
          .digest("hex"),
        crypto.createHash("sha256").update(producerBytes).digest("hex"),
        name + " must consume the packed producer bytes",
      );
    }

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
    // These owned observation outputs start empty before any native consumer
    // can record root membership. Actual Program calls still append every tick
    // and receipt; setup does not fabricate an execution or observed context.
    for (const output of [
      programRunLog,
      contextReceipt,
      configPathReceipt,
      pathsReceipt,
      casePolicyReceipt,
    ])
      fs.writeFileSync(output, "", { flag: "wx" });
    let projectAlias = root;
    if (!installationOnly) {
      const aliasParent = TestProject.tmpdir(
        "ttsc-shared-project-alias-",
        path.dirname(allocatedRoot),
      );
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
        path.dirname(workspaceRequire.resolve("mocha/package.json")),
        path.join(modules, "mocha"),
        "junction",
      );
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
      fs.symlinkSync(
        path.join(root, "tools/runtime-package-stars"),
        path.join(modules, "batch-package-stars"),
        "junction",
      );
      // A physical differently-spelled store is a boundary only when Node can
      // reach that same directory through its installed-package spelling.
      const boundaryApp = path.join(root, "tools/runtime-package-boundary/app");
      const boundaryStore = path.join(boundaryApp, "NODE_MODULES");
      const boundaryAlias = path.join(boundaryApp, "node_modules");
      if (!fs.existsSync(boundaryAlias))
        fs.symlinkSync(boundaryStore, boundaryAlias, "junction");
      assert.equal(
        fs.realpathSync.native(boundaryAlias),
        fs.realpathSync.native(boundaryStore),
      );
      fs.symlinkSync(
        path.join(boundaryApp, "workspace"),
        path.join(boundaryStore, "boundary-workspace"),
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
      const bunSingleConfig = path.join(
        root,
        "tools/bun-native-sessions/tsconfig.json",
      );
      const bunSingle = JSON.parse(fs.readFileSync(bunSingleConfig, "utf8"));
      bunSingle.compilerOptions.plugins[0].fixtureSource = fixtureSource;
      bunSingle.compilerOptions.plugins[0].runLog = path.join(
        root,
        "tools/bun-native-sessions/program-runs.bin",
      );
      fs.writeFileSync(bunSingleConfig, JSON.stringify(bunSingle));
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
      ).replace("__TURBOPACK_ADAPTER__", pathToFileURL(TestUnpluginRuntime.libPath("turbopack", "mjs")).href),
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
      // The authored root assembly input executes the SDK assembler; the
      // unique dependency import also gives this main package a cold action.
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
      // The source publication owns its default cache as an independent local
      // workspace even when this experiment lives below another workspace.
      // Unmarked installation fallback remains with the direct cache units.
      fs.copyFileSync(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "tests/test-e2e/fixtures/ttsc/source-plugin/source-publication-workspace.yaml",
        ),
        path.join(source, "pnpm-workspace.yaml"),
      );
      const materializationInputs = path.join(
        TestProject.WORKSPACE_ROOT,
        "packages/ttsc/test/fixtures/e2e",
      );
      for (const filename of ["main.go", "go.mod", "asset.txt", "witness.s"])
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
      // A new executable supplies a real first-image-load boundary. Reusing the
      // already executed compiler would never distinguish #1596.
      const freshGo = path.join(tools, path.basename(actualGo.binary));
      fs.copyFileSync(actualGo.binary, freshGo);
      const freshGoEnv = {
        ...process.env,
        TTSC_GO_BINARY: freshGo,
        GOROOT: execFileSync(actualGo.binary, ["env", "GOROOT"], {
          encoding: "utf8",
          windowsHide: true,
        }).trim(),
      };
      const freshGoBytes = fs.readFileSync(freshGo);
      const firstWitness = new Map<string, string>();
      const firstEnvironment = pluginBuildEnvironment(
        source,
        freshGoEnv,
        firstWitness,
      );
      assert.ok(
        PluginBuildEnvironmentWitness.holds(firstWitness),
        "first Go execution must establish a usable toolchain witness",
      );
      assert.deepEqual(fs.readFileSync(freshGo), freshGoBytes);
      const warmWitness = new Map<string, string>();
      assert.equal(
        pluginBuildEnvironment(source, freshGoEnv, warmWitness),
        firstEnvironment,
      );
      assert.ok(PluginBuildEnvironmentWitness.holds(warmWitness));
      const originalTime = fs.statSync(freshGo);
      fs.writeFileSync(
        freshGo,
        Buffer.concat([freshGoBytes, Buffer.from("changed")]),
      );
      assert.equal(
        PluginBuildEnvironmentWitness.holds(firstWitness),
        false,
        "changed compiler bytes must refute the build witness",
      );
      fs.writeFileSync(freshGo, freshGoBytes);
      fs.utimesSync(freshGo, originalTime.atime, originalTime.mtime);
      assert.equal(
        PluginBuildEnvironmentWitness.holds(firstWitness),
        false,
        "restoring bytes and mtime must not erase a changed compiler witness",
      );
      const go = path.join(
        tools,
        process.platform === "win32" ? "go.cmd" : "go",
      );
      fs.writeFileSync(
        go,
        process.platform === "win32"
          ? `@echo off\r\nset "ERRORLEVEL="\r\n"${process.execPath}" "%~dp0actual-go.cjs" %*\r\nexit /b %errorlevel%\r\n`
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
        TTSC_TEST_GO_TOOL_ROOT: freshGoEnv.GOROOT,
        GOFLAGS: "-trimpath=false",
      };
      // The self-rewriting witness probe must not make the Windows wrapper
      // hide a failed real Go command behind its appended comment commands.
      const assertGoCommandExits = (): void => {
        for (const errorlevel of [undefined, "0", "999"]) {
          const commandEnv = { ...env, ERRORLEVEL: errorlevel };
          const rejected = spawnGoTool(go, ["help", "ttsc-e2e-no-such-topic"], {
            cwd: tools,
            encoding: "utf8",
            env: commandEnv,
            windowsHide: true,
          });
          assert.equal(rejected.error, undefined);
          assert.equal(rejected.signal, null);
          assert.equal(rejected.status, 2);
          assert.match(rejected.stderr, /unknown help topic/);
          const accepted = spawnGoTool(go, ["version"], {
            cwd: tools,
            encoding: "utf8",
            env: commandEnv,
            windowsHide: true,
          });
          assert.equal(accepted.error, undefined);
          assert.equal(accepted.signal, null);
          assert.equal(accepted.status, 0);
          assert.match(accepted.stdout, /^go version /);
        }
      };
      assertGoCommandExits();
      // No changing attempt may populate the compiler memo or replace an
      // earlier witness. The existing real Go launcher changes its own bytes
      // during each version query, then returns to ordinary stable operation.
      for (let reading = 0; reading < 2; reading += 1) {
        const moving = new Map<string, string>();
        pluginBuildEnvironment(
          source,
          {
            ...env,
            TTSC_TEST_GO_REWRITE_LAUNCHER: go,
          },
          moving,
        );
        assert.equal(
          PluginBuildEnvironmentWitness.holds(moving),
          false,
          "a compiler that changes during every version query must remain refused",
        );
      }
      const recovered = new Map<string, string>();
      pluginBuildEnvironment(source, env, recovered);
      assert.ok(
        PluginBuildEnvironmentWitness.holds(recovered),
        "a fresh stable reading must recover without discarding earlier refusal",
      );
      assertGoCommandExits();
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
        toolchainBefore: Record<string, string>;
        toolchainAfter: Record<string, string>;
        rewroteLauncher: boolean;
        poisonedRelease: boolean;
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
      const coldActions = buildActions();
      const coldBuildCount = countBuilds();
      assert.equal(coldActions.length, coldBuildCount);
      assert.ok(coldBuildCount > 0 && coldBuildCount <= 3);
      const changedToolchain = (
        record: (typeof coldActions)[number],
      ): boolean => {
        const keys = new Set([
          ...Object.keys(record.toolchainBefore),
          ...Object.keys(record.toolchainAfter),
        ]);
        return [...keys].some(
          (key) => record.toolchainBefore[key] !== record.toolchainAfter[key],
        );
      };
      for (const [index, record] of coldActions.entries()) {
        assert.equal(record.status, 0, record.stderr);
        assert.equal(record.signal, null);
        assert.equal(
          changedToolchain(record),
          index !== coldActions.length - 1,
          "each discarded native epoch needs a changed tool witness; publication needs a stable final epoch",
        );
        assert.equal(
          compiledDependency(record),
          index === 0,
          "only the first epoch compiles the unique dependency; retries retain valid Go object reuse",
        );
      }
      assert.ok(
        coldActions[0]!.stderr
          .split(/\r?\n/)
          .some(
            (line) =>
              /[\\/]asm(?:\.exe)?\b/.test(line) &&
              /(?:^|\s)-p main(?:\s|$)/.test(line) &&
              /[\\/]witness\.s(?:"|\s|$)/.test(line),
          ),
        "the cold main package must execute its authored witness.s with the actual assembler",
      );
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
        coldBuildCount,
        "the cold request's actual epochs are independently witnessed",
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
        coldBuildCount,
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
      assert.equal(countBuilds(), coldBuildCount + 1);
      objectOutput(rebuilt, "first");
      const rebuiltBytes = fs.readFileSync(rebuilt);
      const initialActions = buildActions();
      assert.equal(initialActions.length, coldBuildCount + 1);
      assert.notEqual(
        initialActions[0]!.cwd,
        initialActions[coldBuildCount]!.cwd,
      );
      assert.equal(
        compiledDependency(initialActions[0]!),
        true,
        "the unique dependency must compile cold",
      );
      assert.equal(
        compiledDependency(initialActions[coldBuildCount]!),
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
          coldBuildCount + 2,
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
          coldBuildCount + 3,
          "one shared source graph rebuilds once for the external input transition",
        );
        assert.equal(
          compiledDependency(buildActions()[coldBuildCount + 2]!),
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
          coldBuildCount + 4,
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
        // Both workspace modules participate in the import graph. Their common
        // ancestor preserves the deep dependency's necessary relative geometry;
        // a single external root remains free to use its compact snapshot.
        const workspaceHelper = path.join(container, "workspace-helper");
        fs.mkdirSync(workspaceHelper);
        for (const filename of ["dep.go", "go.mod"])
          fs.copyFileSync(
            path.join(
              materializationInputs,
              "source-materialization-dependency",
              filename,
            ),
            path.join(workspaceHelper, filename),
          );
        const workspaceHelperName = dependencyName + "-workspace-helper";
        fs.writeFileSync(
          path.join(workspaceHelper, "go.mod"),
          fs
            .readFileSync(path.join(workspaceHelper, "go.mod"), "utf8")
            .replace(
              "example.com/batch-materialization-dependency",
              workspaceHelperName,
            ),
        );
        fs.writeFileSync(
          path.join(workspaceHelper, "dep.go"),
          dependencyText.replace('"first"', '"second"'),
        );
        fs.writeFileSync(
          dependencySource,
          dependencyText
            .replace(
              "package dependency",
              'package dependency\n\nimport helper "' +
                workspaceHelperName +
                '"',
            )
            .replace('return "first"', "return helper.Value()"),
        );
        const workspaceRoots = [dependency, workspaceHelper];
        const workspacePublication = request(
          source,
          expected,
          {},
          workspaceRoots,
        );
        assert.ok(
          fs.existsSync(workspacePublication),
          "the actual patch-qualified modules must build together as workspace use entries",
        );
        assert.equal(
          countBuilds(),
          coldBuildCount + 5,
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
          container,
          path.join(dependency, "go.mod"),
        );
        const externalCopies = path.join(
          workspaceBuild.cwd,
          ".ttsc",
          "external",
        );
        const copiedDependencyMod = observedGoArguments.find((args) => {
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
        })?.[3];
        assert.ok(
          copiedDependencyMod,
          "the actual workspace metadata process must accept its deeply nested absolute copied module filename: " +
            JSON.stringify({
              buildCwd: workspaceBuild.cwd,
              dependencyLayout,
              observedGoArguments,
            }),
        );
        assert.notEqual(
          path.resolve(copiedDependencyMod),
          path.resolve(dependencyMod),
          "metadata must consume the private copied module, never its live authored path",
        );
        const workspaceExecution = E2eProcessTrace.spawnSync(
          workspacePublication,
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
        assert.ok(isOrdinarilyClosedReadonlyLauncher(workspaceExecution));
        assert.equal(workspaceExecution.error, undefined);
        assert.equal(workspaceExecution.signal, null);
        assert.equal(workspaceExecution.status, 0, workspaceExecution.stderr);
        assert.equal(
          workspaceExecution.stdout,
          'second|"embedded bytes\\n"|example.com/plugin/main.go\n',
        );
        assert.equal(workspaceExecution.stderr.trim(), "second");
        const dependencyModText = originalDependencyMod.toString("utf8");
        assert.ok(dependencyModText.includes("go 1.26.0"));
        fs.writeFileSync(
          dependencyMod,
          dependencyModText.replace("go 1.26.0", "go 1.99.0"),
        );
        assert.throws(
          () =>
            request(source, expected, { GOTOOLCHAIN: "local" }, workspaceRoots),
          /go >= 1\.99\.0/,
          "the real Go workspace must reject an incompatible imported overlay instead of guessing a lower version",
        );
        assert.equal(
          countBuilds(),
          coldBuildCount + 5,
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
      assert.equal(countBuilds(), coldBuildCount + 5);
      assert.deepEqual(
        fs.readFileSync(first),
        rebuiltBytes,
        "restored warm reuse must preserve the independently captured rebuilt publication; the deleted first publication is a different artifact lifetime",
      );
      // Transition cases own fresh plugin namespaces and share the proven Go
      // object storage; the moving-reader contrast reuses the original binary.
      // A failed epoch must not acquire a publication or silently replace the
      // caller's source/environment authority.
      const epochFailures: Error[] = [];
      const stableLauncher = fs.readFileSync(go);
      const stableSource = fs.readFileSync(path.join(source, "main.go"));
      const objectCache = resolveSourceBuildCachePaths(
        source,
        undefined,
        env,
      ).goBuildRoot;
      const epochCase = (name: string, run: (cache: string) => void): void => {
        const cache = path.join(container, "epoch-" + name);
        assert.equal(fs.existsSync(cache), false);
        const launcherTime = new Date("2020-01-01T00:00:00.000Z");
        fs.utimesSync(go, launcherTime, launcherTime);
        try {
          run(cache);
        } catch (cause) {
          epochFailures.push(new Error(name, { cause }));
        } finally {
          fs.writeFileSync(go, stableLauncher);
          fs.writeFileSync(path.join(source, "main.go"), stableSource);
        }
      };
      const epochRequest = (
        cache: string,
        extraEnv: NodeJS.ProcessEnv,
        sourceDigests = new Map<string, string>(),
        environmentDigests = new Map<string, string>(),
      ): string =>
        buildSourcePlugin({
          baseDir: source,
          source,
          overlayDirs: [],
          env: {
            ...env,
            TTSC_CACHE_DIR: cache,
            TTSC_GO_CACHE_DIR: objectCache,
            ...extraEnv,
          },
          pluginName: "canonical-source-epoch",
          quiet: true,
          sourceDigests,
          environmentDigests,
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
      const published = (cache: string): string[] => {
        const plugins = path.join(cache, "plugins");
        if (!fs.existsSync(plugins)) return [];
        return fs
          .readdirSync(plugins)
          .filter((key) => /^[a-f0-9]{32}$/.test(key))
          .flatMap((key) => {
            const filename = path.join(
              plugins,
              key,
              process.platform === "win32" ? "plugin.exe" : "plugin",
            );
            return fs.existsSync(filename) ? [filename] : [];
          });
      };
      const noPendingEpoch = (
        cache: string,
        actions: ReturnType<typeof buildActions>,
      ): void => {
        for (const action of actions)
          assert.equal(
            fs.existsSync(action.cwd),
            false,
            "discarded or completed scratch input must be removed",
          );
        const visit = (directory: string): void => {
          if (!fs.existsSync(directory)) return;
          for (const entry of fs.readdirSync(directory, {
            withFileTypes: true,
          })) {
            assert.equal(/^plugin(?:\.exe)?\..*\.tmp$/.test(entry.name), false);
            assert.notEqual(
              entry.name,
              "current",
              "the owned build lease must be released",
            );
            if (entry.isDirectory()) visit(path.join(directory, entry.name));
          }
        };
        visit(path.join(cache, "plugins"));
      };
      const mutation = (
        cache: string,
        mode: "once" | "always",
      ): NodeJS.ProcessEnv => ({
        TTSC_TEST_GO_REWRITE_BUILD_LAUNCHER: go,
        TTSC_TEST_GO_REWRITE_BUILD_MODE: mode,
        TTSC_TEST_GO_REWRITE_BUILD_MARKER: path.join(cache, "rewrite-once"),
      });
      epochCase("one-shot", (cache) => {
        const baseline = countBuilds();
        const oldWitness = new Map<string, string>();
        pluginBuildEnvironment(
          source,
          { ...env, TTSC_GO_CACHE_DIR: objectCache },
          oldWitness,
        );
        assert.ok(PluginBuildEnvironmentWitness.holds(oldWitness));
        const binary = epochRequest(cache, mutation(cache, "once"));
        assert.equal(countBuilds() - baseline, 2);
        const actions = buildActions().slice(baseline);
        assert.equal(actions[0]!.rewroteLauncher, true);
        assert.equal(changedToolchain(actions[0]!), true);
        assert.equal(
          actions[0]!.toolchainBefore[go]!.split(":")[3],
          actions[0]!.toolchainAfter[go]!.split(":")[3],
          "the actual byte transition restores the independent exact modification time",
        );
        assert.equal(changedToolchain(actions[1]!), false);
        assert.equal(PluginBuildEnvironmentWitness.holds(oldWitness), false);
        assert.deepEqual(
          published(cache),
          [binary],
          "only the fresh content key may own a binary",
        );
        const entries = fs
          .readdirSync(path.join(cache, "plugins"))
          .filter((key) => /^[a-f0-9]{32}$/.test(key));
        assert.equal(
          entries.length,
          2,
          "the rewritten launcher must produce a distinct fresh key",
        );
        objectOutput(binary, "first");
        noPendingEpoch(cache, actions);
      });
      epochCase("continuous-and-recovery", (cache) => {
        const baseline = countBuilds();
        const sources = new Map<string, string>();
        const environments = new Map<string, string>();
        assert.throws(
          () =>
            epochRequest(
              cache,
              mutation(cache, "always"),
              sources,
              environments,
            ),
          /Go toolchain.*changed/s,
        );
        assert.equal(
          countBuilds() - baseline,
          3,
          "persistent motion must stop after three actual epochs",
        );
        assert.deepEqual([...sources], []);
        assert.deepEqual([...environments], []);
        const actions = buildActions().slice(baseline);
        assert.ok(
          actions.every(
            (record) => record.rewroteLauncher && changedToolchain(record),
          ),
        );
        assert.deepEqual(published(cache), []);
        noPendingEpoch(cache, actions);
        const recovered = epochRequest(cache, {});
        assert.equal(countBuilds() - baseline, 4);
        objectOutput(recovered, "first");
        assert.equal(epochRequest(cache, {}), recovered);
        assert.equal(
          countBuilds() - baseline,
          4,
          "stable cache admission must add no native build",
        );
        assert.deepEqual(published(cache), [recovered]);
        noPendingEpoch(cache, buildActions().slice(baseline));
      });
      epochCase("source-motion", (cache) => {
        const baseline = countBuilds();
        const sources = new Map<string, string>();
        const environments = new Map<string, string>();
        assert.throws(
          () =>
            epochRequest(
              cache,
              {
                ...mutation(cache, "once"),
                TTSC_TEST_GO_REWRITE_SOURCE: path.join(source, "main.go"),
              },
              sources,
              environments,
            ),
          /source.*changed|changed.*source|inputs.*changed/s,
        );
        assert.equal(
          countBuilds() - baseline,
          1,
          "retry must preserve the initial source authority",
        );
        assert.deepEqual([...sources], []);
        assert.deepEqual([...environments], []);
        assert.deepEqual(published(cache), []);
        noPendingEpoch(cache, buildActions().slice(baseline));
      });
      epochCase("native-failure", (cache) => {
        const baseline = countBuilds();
        fs.appendFileSync(
          path.join(source, "main.go"),
          "\ninvalid native syntax\n",
        );
        assert.throws(
          () => epochRequest(cache, mutation(cache, "once")),
          /syntax error/,
        );
        assert.equal(
          countBuilds() - baseline,
          1,
          "native failure must remain terminal despite tool motion",
        );
        const actions = buildActions().slice(baseline);
        assert.notEqual(actions[0]!.status, 0);
        assert.equal(actions[0]!.rewroteLauncher, true);
        assert.deepEqual(published(cache), []);
        noPendingEpoch(cache, actions);
      });
      epochCase("release-failure", (cache) => {
        const baseline = countBuilds();
        const sources = new Map<string, string>();
        const environments = new Map<string, string>();
        let failure: unknown;
        try {
          epochRequest(
            cache,
            {
              ...mutation(cache, "once"),
              TTSC_TEST_GO_FAIL_RELEASE_ROOT: path.join(cache, "plugins"),
            },
            sources,
            environments,
          );
        } catch (error) {
          failure = error;
        }
        assert.ok(failure instanceof Error);
        assert.match(String(failure), /Go toolchain.*changed/s);
        assert.equal(
          countBuilds() - baseline,
          1,
          "failed lease cleanup must prohibit another epoch",
        );
        const actions = buildActions().slice(baseline);
        assert.equal(actions[0]!.poisonedRelease, true);
        assert.deepEqual(published(cache), []);
        assert.deepEqual([...sources], []);
        assert.deepEqual([...environments], []);
        for (const action of actions)
          assert.equal(fs.existsSync(action.cwd), false);
        // The deliberately failed lease is retained for the owning project to
        // reclaim; it cannot certify the ordinary successful-cleanup path.
      });
      epochCase("moving-reader", (cache) => {
        const baseline = countBuilds();
        // Reuse an actual already-published content key. Version observations
        // restore both launcher bytes and the independently fixed mtime, so
        // rejecting this read cannot rely on a different content key.
        const binary = epochRequest(expected, { TTSC_GO_CACHE_DIR: "" });
        assert.equal(countBuilds(), baseline);
        const binaryBytes = fs.readFileSync(binary);
        const launcherBytes = fs.readFileSync(go);
        const launcherMtime = fs.statSync(go, { bigint: true }).mtimeNs;
        const oldWitness = new Map<string, string>();
        pluginBuildEnvironment(source, env, oldWitness);
        assert.ok(PluginBuildEnvironmentWitness.holds(oldWitness));
        const before = fs
          .readFileSync(invocations, "utf8")
          .trim()
          .split(/\r?\n/).length;
        const sources = new Map<string, string>();
        const environments = new Map<string, string>();
        assert.throws(
          () =>
            epochRequest(
              expected,
              {
                TTSC_GO_CACHE_DIR: "",
                TTSC_TEST_GO_REWRITE_LAUNCHER: go,
                TTSC_TEST_GO_RESTORE_LAUNCHER_BYTES: "1",
              },
              sources,
              environments,
            ),
          /Go toolchain.*changed/s,
        );
        const observed = fs
          .readFileSync(invocations, "utf8")
          .trim()
          .split(/\r?\n/)
          .slice(before)
          .map((line) => JSON.parse(line) as string[]);
        assert.equal(
          observed.filter((args) => args[0] === "version").length,
          9,
        );
        assert.equal(countBuilds(), baseline);
        assert.deepEqual([...sources], []);
        assert.deepEqual([...environments], []);
        assert.deepEqual(published(cache), []);
        assert.deepEqual(fs.readFileSync(binary), binaryBytes);
        assert.deepEqual(fs.readFileSync(go), launcherBytes);
        assert.equal(fs.statSync(go, { bigint: true }).mtimeNs, launcherMtime);
        assert.equal(
          PluginBuildEnvironmentWitness.holds(oldWitness),
          false,
          "restoring compiler bytes and mtime must not rehabilitate the earlier observation",
        );
      });
      if (epochFailures.length)
        throw new AggregateError(
          epochFailures,
          "actual Go toolchain epoch regressions",
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
    // Editor commands copy their actual project root to protect saved bytes.
    // Keep its complete source and Evidence inputs without copying native
    // producers, bundler outputs or other actors' mutable tools on each command.
    const lspEditorRoot = path.join(root, "tools/lsp-editor");
    if (!installationOnly) {
      fs.mkdirSync(lspEditorRoot, { recursive: true });
      for (const directory of ["src", "native-errors", "docs"])
        fs.cpSync(
          path.join(root, directory),
          path.join(lspEditorRoot, directory),
          {
            recursive: true,
          },
        );
      fs.copyFileSync(
        path.join(root, "lint.config.cjs"),
        path.join(lspEditorRoot, "lint.config.cjs"),
      );
      const editorConfig = JSON.parse(
        fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
      );
      const editorLint = editorConfig.compilerOptions.plugins.find(
        (entry: { transform?: string }) => entry.transform === "@ttsc/lint",
      );
      assert.ok(
        editorLint,
        "editor preparation requires the actual lint plugin",
      );
      editorConfig.compilerOptions.plugins = [editorLint];
      fs.writeFileSync(
        path.join(lspEditorRoot, "tsconfig.json"),
        JSON.stringify(editorConfig),
      );
      fs.writeFileSync(
        path.join(lspEditorRoot, "package.json"),
        JSON.stringify({
          name: "ttsc-editor-boundary-corpus",
          private: true,
          type: "commonjs",
        }),
      );
      fs.symlinkSync(
        modules,
        path.join(lspEditorRoot, "node_modules"),
        "junction",
      );
    }
    const graphRoot = path.join(root, "tools/graph-resident");
    if (!installationOnly) {
      fs.mkdirSync(graphRoot, { recursive: true });
      // Resident graph refresh consumes the Evidence document population and
      // its contributor as well as TypeScript sources. Preserve these actual
      // inputs while excluding other actors' native transform producers.
      for (const directory of ["src", "docs", "native-errors"])
        fs.cpSync(path.join(root, directory), path.join(graphRoot, directory), {
          recursive: true,
        });
      fs.copyFileSync(
        path.join(root, "lint.config.cjs"),
        path.join(graphRoot, "lint.config.cjs"),
      );
      const graphConfig = JSON.parse(
        fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
      );
      const graphLint = graphConfig.compilerOptions.plugins.find(
        (entry: { transform?: string }) => entry.transform === "@ttsc/lint",
      );
      assert.ok(
        graphLint,
        "resident graph preparation requires the actual lint contributor",
      );
      graphConfig.compilerOptions.plugins = [graphLint];
      fs.writeFileSync(
        path.join(graphRoot, "tsconfig.json"),
        JSON.stringify(graphConfig),
      );
      fs.writeFileSync(
        path.join(graphRoot, "package.json"),
        JSON.stringify({
          name: "ttsc-graph-boundary-corpus",
          private: true,
          type: "commonjs",
        }),
      );
      fs.symlinkSync(modules, path.join(graphRoot, "node_modules"), "junction");
    }
    return {
      allocatedRoot,
      root,
      expected,
      graphNegativeRoot,
      lintWrapperRoot,
      descriptorCollectionRoot,
      lspEditorRoot,
      graphRoot,
      installedTtsx,
      installationOnly,
      compilerArchives,
      sourcePublication,
      programRunLog,
      contextReceipt,
      factoryContextProbe,
      factoryEsmContextProbe,
      configPathReceipt,
      pathsReceipt,
      casePolicyReceipt,
      projectAlias,
      cache,
      runtimeCliCache,
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
