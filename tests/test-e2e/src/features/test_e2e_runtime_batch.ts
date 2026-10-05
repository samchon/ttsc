import { FileSystemIterator, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveSourceBuildCachePaths } from "../../../../packages/ttsc/src/plugin/internal/source/resolveSourceBuildCachePaths";
import { BatchWorkspace } from "../batch/BatchWorkspace";
import { assertRuntimeCliCorpus } from "../batch/runtimeCliCorpus";
import { runtimeFrontdoorsCorpus } from "../batch/runtimeFrontdoorsCorpus";
import { assertRuntimeNodeCorpus } from "../batch/runtimeNodeCorpus";
import { assertRuntimeNormalPopulation } from "../batch/runtimeNormalPopulation";
import {
  denyWrites,
  runsAsRoot,
} from "../internal/ttsc/internal/read-only-directory";

/**
 * Verifies one public runtime loads the shared transformed graph. The existing
 * nested emission owner also selects the maintained driver-emit fixture: one
 * public TS4094 failure must preserve its actual diagnostics and discard
 * pending outputs before the host publishes files or a manifest. Direct Go emit
 * tests own both noEmitOnError callback lanes; this one false-lane public
 * request owns the publisher connection, not two CLI executions or a
 * Program-count certificate.
 *
 * Native string decoding, resolved JSON and unchanged neighboring values reach
 * one real ttsx entry. Unremoved configured discard calls throw, so successful
 * values cannot hide missing stripping. Every value belongs to this one graph.
 * The shared source producer also materializes one imported Go module under
 * four long components: patch-qualified directives and relative/absolute
 * replacement select first, changed external bytes select second, and an
 * incompatible local toolchain directive rejects before publication. External
 * replacements and workspace overlays are distinct epochs of that graph. Six
 * actual Go build attempts include binary-only cold rebuild, external byte
 * change, malformed dependency refusal and compatible workspace publication.
 * Actual Go -x must show cold helper compilation, unchanged object reuse across
 * different scratch roots and recompilation after edit; mode2 independently
 * observes embedding, logical runtime source and panic provenance. Five
 * compiled executions (three combined value/object probes, one cold-rebuild
 * probe and one panic) replace the separate source-project and object-cache
 * recipes; restored bytes reuse the original publication before the runtime
 * borrows it.
 *
 * 1. Capture the source/config bytes and invoke the public ttsx entry once.
 * 2. Compare its one actual JSON payload against all original literal rows.
 * 3. Require source/config preservation and absent adjacent JavaScript output.
 *
 * The existing configured ESNext owner also supplies a preserve-mode JSX
 * component, while the existing CommonJS owner requires the configless
 * pragma-selected orphan. Their complete HTML values and unchanged custom
 * runtime/source bytes share the same Runtime payload; neither adds another
 * owner or launcher. The same native ESM entry now distinguishes its own
 * supported main identity from an imported helper and names its physical
 * authored source URL. This removes the old ESM-main request without claiming
 * the remaining CJS or fatal process lifetimes. The configured noEmitOnError
 * owner already carries an unimported type error, wrapped7 and its real
 * otherwise-unrequested output receipt, so its former independent dependency
 * request also retires. The existing classification dependency now explicitly
 * owns ESNext options under a contrary CommonJS package. The same
 * cjs-dependency/esm-by-project result distinguishes literal node_modules
 * package precedence from the miscased project directory; no separate
 * classification runtime is launched. The rejected dependency entry is an
 * explicit module: its console/process declarations are local to that source,
 * while the imported diagnostic owner's noUnusedLocals check retains TS6133 and
 * blocks the entry's success effect.
 *
 * The two configured dependency families have incompatible compiler modes: one
 * default-ESM/Bundler owner with a contrary CommonJS manifest supplies all
 * extensionless ESM nodes, while one empty CommonJS/legacy-decorator owner
 * supplies one source fallback containing two independent method decorators.
 * Same-basename identity selection is owned by exact
 * EmitOwnershipIndex/OwnedProjectSource units and the existing root ownership
 * graph rather than additional legacy source requests. The ESNext dependency
 * now selects its own linked strip plugin: its authored secret call must
 * disappear while dependency-value reaches the parent. Both are requested
 * within the existing runtime, with no per-case project or launch. Native owner
 * preparation and fallback are additional explicit Program costs; the outer
 * runtime count alone does not certify total independent experimentation.
 *
 * @evidence contracts/testing.md#behavioral-verification The real ttsx process must return status0 and exactly one full labeled payload with contract42, copied JSON42/retained and all661 native JSX string values. Configured discard.call and logger.trace("drop") would throw if the actual strip transform or custom rule were missing; the retained default-only log distinguishes the contrary root config. Both standard decorator modules additionally require their literal must-be-stripped console.warn to be absent from actual stderr while retaining the exact class/method effects.
 * @evidence contracts/testing.md#independent-expectations The source's authored42/retained values and pre-print UTF-16 rows establish expectations, not the runtime's own output. Exact original input bytes establish nonmutation.
 * @evidence contracts/testing.md#distinguishing-cases Quoted/expression/ordinary JSX strings, JSON alias versus unchanged neighbor and configured throwing call versus retained console.info share the same module graph. The same Program preserves an enum through direct/barrel CommonJS-to-ESM loading with named/default identity, erased interface absence, repeated import identity, one source effect and live default getter42-to43; no extra producer/profile loop is introduced. Static if(false) reexport metadata yields an undefined namespace slot while the real CommonJS object owns no hidden property; template-only ghost metadata yields neither slot nor value. Both throwing helpers must remain inert. The existing ESNext owner additionally imports a literal node_modules CommonJS package and a miscased Node_Modules project source; their different physical parents prevent a case-insensitive filesystem from aliasing the two directory spellings.
 * The existing rejection actor also consumes one upfront readonly namespace. Native permission denial is required before its default-cache success, explicit-cache excluded refusal and included success; restored writes and complete input bytes establish release and nonmutation. Root privilege supplies zero readonly coverage. The two successful dispatches launch two real entry children, while the three former CLI parent launches and separate readonly staging disappear.
 * Those same two entries carry complete standard-decorator effects, opposite optional-chain emission and configured automatic versus direct/response-preserved JSX HTML. The included CommonJS entry also carries an actual import preload, main-module identity, physical argv1 and native shared require.cache identity without another entry child. Nested response before/after visible target flags selects ESNext versus ES2019; an invalid response is a failed dispatcher call with no extra entry child. Privileged runs use an explicit external cache for these two controls while retaining zero permission coverage. The existing register actor starts in the upfront legacy owner's preserve-mode TSX graph and then loads the original declared/descendant graph, keeping its native preparations as explicit work.
 * The already retained lock-holder actor installs public registration, rejects an included number-to-string error before its marker and leaves an empty register project index. Repairing that same source permits FIRST from one excluded index; the next same-basename index fails its entry check before its marker. The final missing owned output still causes actual exit1 and dead-holder cleanup. These checked loads retain native work but introduce no extra host or private profile.
 *
 * @evidence contracts/testing.md#execution-ownership This selected function invokes TestProject.spawn once. Its main-thread declaration preload uses actual public API output capture, one installed CLI forced-emit dispatch on the shared nested source graph, one shared rejected-bootstrap Node actor and one retained fresh installed-register Node actor; the existing lock-holder actor supplies the negative checked load. No legacy test or profile launcher is invoked. Native emission, default preparation, orphan lowering, the four retained actor lifetimes (including the detached registered descendant) and two readonly entry children are explicit costs, not one-process or one-Program claims. The upfront frontdoor corpus separately restores eight actual startup/terminal launcher requests and their four CLI entry children; native preparations remain additional work. Their failures and this original Runtime body's failures are collected together.
 * @evidence contracts/e2e.md#necessary-boundary Public ttsx connects native transforms, source publication and actual Node loading. Go rule units cannot establish the loaded graph's observed values or source preservation.
 * @evidence contracts/e2e.md#shared-execution One consumer and its runtime process carry the value graph, source-race/identity loads and installed clean dispatch. The existing lock-holder child also requires a checked module after its actual emitted file is removed: acquired-holder stdout, missing-owned stderr and exit1 establish both real negative transport and the exited holder. Exact output bytes restore before the main graph. Default/explicit clean need no separate launcher. Real Go metadata/build/smoke and isolated emit children remain disclosed internal costs, not standalone source projects or one-Program certification.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Native errors are outside the positive tsconfig population. The excluded orphan changes during its actual compiler read, restores original bytes before the second require and finally, and its environment authority restores before the main graph. The main source/config remain immutable; synchronous process error/signal/null status fails and unknown closure retains the common owner.
 * @evidence contracts/e2e.md#preserved-coverage Keeps the native factory value matrix and combined utility alias/strip/runtime observations in one real loaded graph. The standard class/method warning-removal composition and original ESNext member-initialization effects run in both .mts/.cts modules in the same upfront Program; the contrary module-package .cts value is loaded alongside the .mts public entry. Source dirname, imported class root and both asset reads preserve their independent physical identities. The export population additionally observes real tslib IIFE reexports, inert throwing/template negatives, computed dynamic default exports, live default getters and bare-package versus project basename ownership, all from upfront inputs in the same host. Direct commonjs preparation/metadata and emit ownership units own their detailed portable distinctions. Dependency profile recipes are not repeated; isolated orphan lowering and other compiler-mode/lifetime transitions remain outside this population.
 */
export async function test_e2e_runtime_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  if (!workspace.installationOnly)
    for (const receipt of [
      workspace.factoryContextProbe,
      workspace.factoryEsmContextProbe,
    ])
      assert.ok(
        path.relative(workspace.root, receipt).startsWith(".." + path.sep),
        "factory observation outputs must stay outside compiler input membership",
      );
  const config = fs.readFileSync(path.join(workspace.root, "tsconfig.json"));
  const source = fs.readFileSync(path.join(workspace.root, "src/runtime.mts"));
  const baseline = fs
    .readdirSync(workspace.root)
    .filter(
      (name) =>
        name !== "node_modules" &&
        name !== "program-runs.bin" &&
        name !== "native-context.jsonl" &&
        name !== "native-config-paths.jsonl" &&
        name !== "native-program-paths.jsonl" &&
        name !== "native-case-policy.jsonl",
    )
    .sort();
  const receiptOffset = BatchWorkspace.readContextReceipts(workspace).length;
  const configuredRoot = path.join(workspace.root, "tools/configured-owners");
  const configuredInputs = await FileSystemIterator.read(configuredRoot);
  const jsxRuntimeRoot = path.join(workspace.root, "node_modules/myjsx");
  const jsxOrphanRoot = path.join(workspace.root, "node_modules/orphan-view");
  const jsxInputs = workspace.installationOnly
    ? undefined
    : {
        runtime: await FileSystemIterator.read(jsxRuntimeRoot),
        orphan: await FileSystemIterator.read(jsxOrphanRoot),
      };
  const normalRoot = path.join(
    workspace.root,
    "src/runtime-corpus/normal-population",
  );
  const normalInputs = await FileSystemIterator.read(normalRoot);
  const standardRoot = path.join(workspace.root, "src/runtime-corpus/standard");
  const standardInputs = await FileSystemIterator.read(standardRoot);
  const runtimeOwnerConfig = fs.readFileSync(
    path.join(workspace.root, "runtime-owned.json"),
  );
  if (!workspace.installationOnly)
    for (const location of ["types", "build", "lib"])
      assert.equal(
        fs.existsSync(path.join(workspace.root, location)),
        false,
        "declared consumer output locations must be absent before native runtime preparation",
      );
  const installedPackage = path.join(workspace.root, "node_modules/root-pkg");
  const excludedInputs = [
    "tools/runtime-excluded.ts",
    "src/runtime-corpus/excluded-owner.ts",
    "src/runtime-corpus/declared-entry.ts",
  ].map((relative) => ({
    file: path.join(workspace.root, relative),
    bytes: fs.readFileSync(path.join(workspace.root, relative)),
  }));
  const installedInputs = workspace.installationOnly
    ? undefined
    : await FileSystemIterator.read(installedPackage);
  const installedDirectory = workspace.installationOnly
    ? undefined
    : {
        names: fs.readdirSync(installedPackage).sort(),
        mtimeNs: fs.statSync(installedPackage, { bigint: true }).mtimeNs,
      };
  let result: ReturnType<typeof TestProject.spawn> | undefined;
  const readonlyRoot = path.join(
    workspace.root,
    "tools/runtime-negative/readonly",
  );
  const readonlyBoundary = path.join(readonlyRoot, "node_modules");
  if (!workspace.installationOnly) {
    assert.equal(fs.existsSync(readonlyBoundary), false);
    fs.mkdirSync(readonlyBoundary);
    assert.deepEqual(fs.readdirSync(readonlyBoundary), []);
  }
  const readonlyInputs = workspace.installationOnly
    ? undefined
    : await FileSystemIterator.read(readonlyRoot);
  const readonlyActive = !workspace.installationOnly && !runsAsRoot();
  if (readonlyActive)
    assert.equal(
      resolveSourceBuildCachePaths(readonlyRoot, undefined, {}).root,
      path.join(readonlyBoundary, ".cache/ttsc"),
      "the denied local installation boundary must own the default cache selection before fallback",
    );
  const readonlyRestorations: (() => void)[] = [];
  const probe = (directory: string): void => {
    const file = path.join(directory, "owned-permission-probe");
    const descriptor = fs.openSync(file, "wx");
    try {
      fs.writeSync(descriptor, "restored");
    } finally {
      fs.closeSync(descriptor);
      fs.unlinkSync(file);
    }
  };
  const base = path.join(workspace.root, "runtime-base.json");
  const callerParent = path.join(workspace.cache, "runtime-caller");
  const callerDirectory = path.join(callerParent, "isolated");
  const relativeCache = path.relative(workspace.projectAlias, workspace.cache);
  const wrongCallerCache = path.resolve(callerDirectory, relativeCache);
  if (!workspace.installationOnly) {
    assert.equal(path.isAbsolute(relativeCache), false);
    assert.notEqual(wrongCallerCache, workspace.cache);
    assert.equal(fs.existsSync(callerParent), false);
    assert.equal(fs.existsSync(callerDirectory), false);
    assert.equal(fs.existsSync(wrongCallerCache), false);
    fs.mkdirSync(callerDirectory, { recursive: true });
  }
  const selected = workspace.installationOnly
    ? []
    : [
        "--cwd",
        workspace.projectAlias,
        "--cache-dir",
        relativeCache,
        "-P",
        "runtime-owned.json",
        "--outDir",
        "distx",
        "--declaration",
        "--declarationDir",
        "typesx",
        "--incremental",
        "--tsBuildInfoFile",
        "state/run.tsbuildinfo",
        "--outFile",
        "bundle.js",
        "--noEmit",
        "--emitDeclarationOnly",
        "--target",
        "es2019",
        "-target",
        "es2019",
        "@runtime-args.txt",
        "--sourceMap",
        "false",
        "--inlineSourceMap",
        "-r",
        "./runtime-map-diagnostics.cjs",
        "-r",
        "./tools/native-source-borrower.cjs",
        "-r",
        "./tools/runtime-declared-flow.cjs",
        "-r",
        "./tools/runtime-clean-flow.cjs",
      ];
  if (!workspace.installationOnly)
    fs.renameSync(path.join(workspace.root, "tsconfig.json"), base);
  try {
    if (readonlyActive) {
      for (const directory of [readonlyRoot, readonlyBoundary]) {
        readonlyRestorations.push(denyWrites(directory));
        assert.throws(
          () => probe(directory),
          (error) =>
            ["EACCES", "EPERM", "EROFS"].includes(
              (error as NodeJS.ErrnoException).code ?? "",
            ),
          "native permissions must reject creating an entry in each owned input boundary",
        );
      }
    }
    result = TestProject.spawn(
      process.execPath,
      [
        workspace.installedTtsx,
        ...selected,
        workspace.installationOnly
          ? "src/installation-runtime.ts"
          : "src/runtime.mts",
        ...(workspace.installationOnly
          ? []
          : ["--config", "x", "--port", "3", "--help"]),
      ],
      {
        cwd: workspace.installationOnly ? workspace.root : callerDirectory,
        env: {
          TTSC_CACHE_DIR: workspace.cache,
          TTSC_BINARY: undefined,
          TTSC_TSGO_BINARY: undefined,
          TTSC_E2E_SOURCE_PUBLICATION: workspace.sourcePublication?.binary,
          TTSC_E2E_ORPHAN_COMPILER: TestProject.TSGO_BINARY,
          TTSC_E2E_INSTALLED_TTSX: workspace.installedTtsx,
          TTSC_E2E_PROJECT_ALIAS: workspace.projectAlias,
          TTSC_E2E_READONLY_ROOT: workspace.installationOnly
            ? undefined
            : readonlyRoot,
          TTSC_E2E_READONLY_DENIED: readonlyActive ? "1" : undefined,
        },
      },
    );
  } finally {
    const permissionFailures: unknown[] = [];
    for (const restore of readonlyRestorations.reverse())
      try {
        restore();
      } catch (cause) {
        permissionFailures.push(cause);
      }
    for (const directory of readonlyActive
      ? [readonlyRoot, readonlyBoundary]
      : [])
      try {
        probe(directory);
      } catch (cause) {
        permissionFailures.push(cause);
      }
    if (permissionFailures.length)
      BatchWorkspace.retain(
        "readonly input permissions could not be restored and acknowledged by actual writes",
      );
    if (result?.stderr.includes("rejection actor closure remained unresolved"))
      BatchWorkspace.retain(
        "the rejection actor has no actual closure acknowledgement; keep its held configuration and refuse later shared consumers",
      );
    else if (
      result?.stderr.includes(
        "registered descendant closure remained unresolved",
      )
    )
      BatchWorkspace.retain(
        "the registered descendant has no actual ESRCH acknowledgement; keep its held configuration and refuse later shared consumers",
      );
    else if (!workspace.installationOnly)
      fs.renameSync(base, path.join(workspace.root, "tsconfig.json"));
    if (permissionFailures.length)
      throw new AggregateError(
        permissionFailures,
        "shared readonly permission restoration failed",
      );
  }
  const combinedFailures: unknown[] = [];
  if (!workspace.installationOnly) {
    try {
      await BatchWorkspace.open();
      await runtimeFrontdoorsCorpus(workspace);
    } catch (error) {
      combinedFailures.push(error);
    }
  }
  try {
    assert.ok(result);
    if (readonlyInputs)
      assert.deepEqual(
        await FileSystemIterator.read(readonlyRoot),
        readonlyInputs,
        "readonly transitions must preserve every authored byte and create no adjacent output",
      );
    assert.deepEqual(
      fs
        .readdirSync(workspace.root)
        .filter(
          (name) =>
            name !== "node_modules" &&
            name !== "program-runs.bin" &&
            name !== "native-context.jsonl" &&
            name !== "native-config-paths.jsonl" &&
            name !== "native-program-paths.jsonl" &&
            name !== "native-case-policy.jsonl",
        )
        .sort(),
      baseline,
    );
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    if (!workspace.installationOnly) {
      assert.equal(
        result.stdout
          .split(/\r?\n/)
          .filter((line) => line === "relative-runner-cache").length,
        1,
      );
      assert.equal(
        fs.existsSync(path.join(wrongCallerCache, "project")),
        false,
      );
      assert.equal(
        fs.existsSync(path.join(wrongCallerCache, "plugins")),
        false,
      );
      assert.equal(fs.existsSync(path.join(workspace.cache, "plugins")), true);
      assert.equal(fs.existsSync(path.join(workspace.cache, "project")), true);
      assert.deepEqual(
        fs.readdirSync(path.join(workspace.cache, "project")),
        [],
      );
      fs.rmdirSync(callerDirectory);
      fs.rmdirSync(callerParent);
    }
    assert.doesNotMatch(
      result.stderr,
      /TTSC_TEST_RUNTIME_BARREL_LOADED|TTSC_TEST_PATTERN_RUNTIME_LOADED/,
      "both bare and wildcard ttsc export conditions must avoid the throwing runtime entries",
    );
    assert.doesNotMatch(
      result.stderr,
      /must-be-stripped/,
      "strip must compose with both native standard-decorator modules",
    );
    const payload = BatchWorkspace.readPayload(result.stdout);
    // The full suite retains the packed installation oracle in this same run.
    assert.equal((payload as { answer: unknown }).answer, 42);
    BatchWorkspace.assertValues(
      (payload as { values: unknown }).values,
      workspace.expected,
    );
    if (!workspace.installationOnly) {
      BatchWorkspace.assertResult(payload, workspace.expected, true);
      const entryPolicy = (
        payload as {
          entryPolicy: { main: unknown; helperMain: unknown; url: unknown };
        }
      ).entryPolicy;
      assert.equal(
        entryPolicy.main,
        "main" in import.meta ? true : null,
        "the actual native ESM entry must retain the host's independently supported main identity",
      );
      assert.equal(
        entryPolicy.helperMain,
        "main" in import.meta ? false : null,
        "an imported helper in that same host must remain distinct from its entry",
      );
      assert.equal(typeof entryPolicy.url, "string");
      assert.equal(
        fs.realpathSync.native(new URL(entryPolicy.url as string)),
        fs.realpathSync.native(path.join(workspace.root, "src/runtime.mts")),
        "the entry URL must identify its authored physical source",
      );
      assert.deepEqual(
        await FileSystemIterator.read(installedPackage),
        installedInputs,
        "installed typed package inputs and stale JavaScript must remain unchanged",
      );
      for (const input of excludedInputs)
        assert.deepEqual(
          fs.readFileSync(input.file),
          input.bytes,
          "excluded alias delivery must preserve both authored sources",
        );
      assert.deepEqual(
        {
          names: fs.readdirSync(installedPackage).sort(),
          mtimeNs: fs.statSync(installedPackage, { bigint: true }).mtimeNs,
        },
        installedDirectory,
      );
      assert.equal(
        result.stdout.split(/\r?\n/).filter((line) => line === "fresh tool.ts")
          .length,
        2,
      );
      assert.equal(
        result.stdout.split(/\r?\n/).filter((line) => line === "tool").length,
        1,
      );
      assert.equal(
        result.stdout.split(/\r?\n/).filter((line) => line === "lowered")
          .length,
        1,
      );
      assert.equal(
        result.stdout.split(/\r?\n/).filter((line) => line === "entry ran")
          .length,
        1,
      );
      assert.equal(
        fs.existsSync(
          path.join(workspace.root, "src/runtime-corpus/declared-entry.js"),
        ),
        false,
      );
      for (const location of [
        "types",
        "build",
        "lib",
        "typesx",
        "state",
        "distx",
      ])
        assert.equal(
          fs.existsSync(path.join(workspace.root, location)),
          false,
          "native runtime output resets must protect both authored and explicitly overridden destinations",
        );
      assert.doesNotMatch(result.stdout, /STALE tool\.js/);
      assert.doesNotMatch(
        result.stdout,
        /dependency-secret-should-be-stripped/,
      );
      assert.equal(
        result.stdout
          .split(/\r?\n/)
          .filter((line) => line === "entry:dependency-value").length,
        1,
      );
      const declarationObservation = JSON.parse(
        fs.readFileSync(
          path.join(workspace.root, "tools/runtime-declared-observed.json"),
          "utf8",
        ),
      ) as {
        produced: string[];
        nativeEmitBefore: number;
        nativeEmitAfter: number;
        driverEmitStatus: number;
        driverEmitStderr: string;
        rejectedOutputAbsent: boolean;
        emitManifestAbsent: boolean;
        registerStatus: number;
        registerPid: number;
        descendantPid: number;
        descendantResult: string;
        descendantClosed: boolean;
        registerBefore: number;
        registerAfter: number;
      };
      assert.equal(typeof declarationObservation.driverEmitStatus, "number");
      assert.notEqual(
        declarationObservation.driverEmitStatus,
        0,
        declarationObservation.driverEmitStderr,
      );
      assert.match(declarationObservation.driverEmitStderr, /TS4094/);
      assert.equal(declarationObservation.rejectedOutputAbsent, true);
      assert.equal(declarationObservation.emitManifestAbsent, true);
      assert.equal(declarationObservation.registerStatus, 0);
      assert.ok(declarationObservation.registerPid > 0);
      assert.ok(
        Number.isSafeInteger(declarationObservation.descendantPid) &&
          declarationObservation.descendantPid > 0,
      );
      assert.equal(declarationObservation.descendantResult, "descendant-ready");
      assert.equal(declarationObservation.descendantClosed, true);
      assert.ok(
        declarationObservation.produced.includes(
          "types/runtime-corpus/native-factory.d.ts",
        ),
      );
      assert.ok(
        declarationObservation.produced.includes(
          "types/runtime-corpus/native-factory.d.ts.map",
        ),
      );
      assert.ok(
        declarationObservation.produced.includes("state/app.tsbuildinfo"),
      );
      const allNativeReceipts = BatchWorkspace.readContextReceipts(workspace);
      assert.ok(
        Number.isInteger(declarationObservation.nativeEmitBefore) &&
          declarationObservation.nativeEmitBefore > receiptOffset,
      );
      assert.ok(
        Number.isInteger(declarationObservation.nativeEmitAfter) &&
          declarationObservation.nativeEmitAfter >
            declarationObservation.nativeEmitBefore,
      );
      assert.equal(
        declarationObservation.registerBefore,
        declarationObservation.nativeEmitAfter,
      );
      assert.ok(
        Number.isInteger(declarationObservation.registerAfter) &&
          declarationObservation.registerAfter >
            declarationObservation.registerBefore,
      );
      assert.equal(
        allNativeReceipts.length,
        declarationObservation.registerAfter,
        "every later native context must remain accounted for after the register actor closes",
      );
      const nativeReceipts = allNativeReceipts.slice(
        receiptOffset,
        declarationObservation.nativeEmitBefore,
      );
      BatchWorkspace.assertContextReceipts(
        allNativeReceipts.slice(
          declarationObservation.nativeEmitBefore,
          declarationObservation.nativeEmitAfter,
        ),
      );
      BatchWorkspace.assertContextReceipts(
        allNativeReceipts.slice(
          declarationObservation.registerBefore,
          declarationObservation.registerAfter,
        ),
      );
      BatchWorkspace.assertContextReceipts(nativeReceipts);
      assert.deepEqual(
        nativeReceipts.filter(
          (receipt) => receipt.name === "native-auto-discovery",
        ),
        [
          {
            name: "native-auto-discovery",
            operation: "identity",
            prefix: null,
            suffix: null,
          },
        ],
        "the direct-dependency marker must admit its native entry without an explicit configured transform",
      );
      const descriptorFilename = fs.realpathSync.native(
        path.join(workspace.root, "descriptors/context.cjs"),
      );
      assert.deepEqual(
        JSON.parse(fs.readFileSync(workspace.factoryContextProbe, "utf8")),
        {
          filename: descriptorFilename,
          dirname: path.dirname(descriptorFilename),
          ambientFilename: descriptorFilename,
          ambientDirname: path.dirname(descriptorFilename),
        },
      );
      const esmDescriptorFilename = fs.realpathSync.native(
        path.join(workspace.root, "descriptors/esm/src/index.ts"),
      );
      assert.deepEqual(
        JSON.parse(fs.readFileSync(workspace.factoryEsmContextProbe, "utf8")),
        {
          filename: esmDescriptorFilename,
          dirname: path.dirname(esmDescriptorFilename),
          ambientFilename: "undefined",
          ambientDirname: "undefined",
        },
      );
      assertRuntimeCliCorpus(
        (payload as { cliPolicyRuntime: unknown }).cliPolicyRuntime,
      );
      const cleanObservation = JSON.parse(
        fs.readFileSync(
          path.join(workspace.root, "tools/runtime-clean-flow/observed.json"),
          "utf8",
        ),
      );
      assert.deepEqual(
        { ...cleanObservation, seed: undefined },
        {
          defaultStatus: 0,
          explicitStatus: 0,
          deadHolderRecovered: true,
          legacyKept: true,
          malformedKept: true,
          explicitRemoved: true,
          seed: undefined,
        },
      );
      assert.equal(cleanObservation.seed.status, 1);
      assert.equal(cleanObservation.seed.missingOwned, true);
      assert.equal(cleanObservation.seed.signal, null);
      assert.ok(cleanObservation.seed.pid > 0);
      assert.match(
        result.stdout,
        /ttsc: kept [^\r\n]*legacy: a run that may still be in progress owns it/,
      );
      assert.match(
        result.stdout,
        /ttsc: kept [^\r\n]*unknown: a run that may still be in progress owns it/,
      );
      assert.doesNotMatch(result.stdout, /no cache directories found/);
      assert.deepEqual(
        JSON.parse(
          fs.readFileSync(
            path.join(
              workspace.root,
              "tools/source-publication/runtime-borrower.json",
            ),
            "utf8",
          ),
        ),
        { first: "two", second: "one", nativeMutation: true },
        "the actual published default-cache executable is consumed within this runtime and cannot poison the restored source key",
      );
      assert.deepEqual(
        JSON.parse(
          fs.readFileSync(
            path.join(
              workspace.root,
              "tools/source-publication/runtime-identity.json",
            ),
            "utf8",
          ),
        ),
        {
          first: "lowered",
          warm: "lowered",
          warmMarker: true,
          rewritten: "lowered",
          rewrittenMarker: false,
        },
      );
      assertRuntimeNodeCorpus(
        (payload as { nodeCompatible: unknown }).nodeCompatible,
      );
      assertRuntimeNormalPopulation(
        (payload as { normalPopulation: unknown }).normalPopulation,
      );
      assert.deepEqual(
        await FileSystemIterator.read(normalRoot),
        normalInputs,
        "all seven normal value/edge contributions must keep their source tree unchanged and contain no adjacent emitted files",
      );
      assert.deepEqual(
        await FileSystemIterator.read(standardRoot),
        standardInputs,
        "both requested decorated index sources and their same-basename helper must remain unchanged without adjacent emits",
      );
      assert.deepEqual(
        fs.readFileSync(path.join(workspace.root, "runtime-owned.json")),
        runtimeOwnerConfig,
      );
      assert.deepEqual(
        (payload as { exportPopulation: unknown }).exportPopulation,
        {
          inert: {
            actual: [17, 17],
            before: [42, 42],
            after: 43,
            inlineText: '\n__exportStar(require("./ghost"), exports);\n',
            memberText:
              '\ntslib_1.__exportStar(require("./ghost"), exports);\n',
            hidden: {
              namespaceOwn: true,
              namespaceValueType: "undefined",
              defaultOwn: false,
              defaultValueType: "undefined",
            },
            ghost: {
              namespaceOwn: false,
              namespaceValueType: "undefined",
              defaultOwn: false,
              defaultValueType: "undefined",
            },
            arithmetic: true,
            decorators: "Hello Class Foo\nHello Function getBar\nabc",
          },
          dynamic: {
            actual: [17, 17],
            computed: 42,
            decorators: "Hello Class Foo\nHello Function getBar\nabc",
          },
          collision: "project:package",
          lowering: "42:OK:7",
          enums: {
            value: [42, 42],
            identity: true,
            typeAbsent: true,
            actual: [17, 17],
            before: [42, 42, 42],
            after: 43,
            repeated: true,
            loads: 1,
            decorators: "Hello Class Foo\nHello Function getBar\nabc",
          },
        },
      );
      assert.deepEqual(
        (payload as { configuredOwners: unknown }).configuredOwners,
        {
          esnext: [
            "hello-workspace",
            "configured-esnext",
            "derived-from-target",
          ],
          legacy: ["arguments=3", "dep-a:3", "dep-b:3"],
          strippedDependency: "dependency-value",
          wholeProject: { wrapped: 7, unimportedEmitted: true },
          declaredOutputs: ["inside", "extra"],
          classification: "cjs-dependency|esm-by-project",
          moduleValues: {
            enumRuntime: "Low-2",
            namespaceRuntime: "repeated-3",
          },
          jsx: {
            dependency: "<div>hello</div><b>world</b>",
            orphan: "<i>orphan</i>",
          },
        },
      );
      assert.deepEqual(
        await FileSystemIterator.read(configuredRoot),
        configuredInputs,
        "both existing native owner paths must keep all source bytes and declared output trees untouched",
      );
      if (jsxInputs) {
        assert.deepEqual(
          await FileSystemIterator.read(jsxRuntimeRoot),
          jsxInputs.runtime,
          "the real custom JSX runtime must remain unchanged",
        );
        assert.deepEqual(
          await FileSystemIterator.read(jsxOrphanRoot),
          jsxInputs.orphan,
          "the configless pragma source must remain unchanged without adjacent emission",
        );
      }
      const nativeFrames = (payload as { nativeFrames: unknown }).nativeFrames;
      assert.ok(Array.isArray(nativeFrames));
      assert.equal(nativeFrames.length, 2);
      // The one actual Runtime receives inlineSourceMap after explicitly clearing
      // the shared external-map setting. These are Node-consumed native frames,
      // rather than JSON map metadata or a synthetic source API map.
      const nativeMapLines = result.stdout
        .split(/\r?\n/)
        .filter((line) => line.startsWith("TTSC_RUNTIME_MAPS:"));
      assert.equal(
        nativeMapLines.length,
        1,
        "the existing Runtime child must publish its own Node map diagnostics exactly once",
      );
      const nativeFrameDiagnostic = JSON.stringify({
        frames: nativeFrames,
        maps: JSON.parse(nativeMapLines[0]!.slice("TTSC_RUNTIME_MAPS:".length)),
      });
      assert.match(nativeFrames[0], /inside\.cts:5:\d+/, nativeFrameDiagnostic);
      assert.match(
        nativeFrames[1],
        /outside\.cts:5:\d+/,
        nativeFrameDiagnostic,
      );
      assert.deepEqual(
        (payload as { requireBindings: unknown }).requireBindings,
        [
          "@lib/message",
          "local:@lib/message",
          "imported:@lib/message",
          "ok",
          "ok",
        ],
      );
      const mixed = (payload as { mixedRuntime: unknown }).mixedRuntime;
      assert.deepEqual(mixed, {
        nativeFactory: { generated: 42, neighbor: 43, payload: 42 },
        contraryCommonjs: "cts-runner-ok",
        mtsImport: "mts-runner-ok",
        dual: "42:7:esm-ok",
        sameNamedOwnership: "a,b,a,b,tools",
        rawPackageOwnership: "tools",
        rawLowering: "42:OK:7",
        standardEsm: "Hello Class Foo\nHello Function getBar\nabc",
        standardCommonjs: "Hello Class Foo\nHello Function getBar\nabc",
        memberEsm:
          "11 method\nstatic:run,class:Foo,field:#value,accessor:count",
        memberCommonjs:
          "11 method\nstatic:run,class:Foo,field:#value,accessor:count",
        adapterFactories: ["function", "function", "function", "function"],
        answers: [42, 42],
        requestedSource: [1, 1],
        proposalValue: 42,
        startupMarkers: [
          "ran",
          "entry-ran",
          "ENTRY",
          "explicit-runner-project",
        ],
        mainMessage: "main:value",
        optionalChainPreserved: true,
      });
      const locations = (
        payload as {
          sourceLocations: {
            marker: string;
            template: string;
            directory: string;
            classRoot: string;
          };
        }
      ).sourceLocations;
      assert.equal(locations.marker, "source-relative-dirname");
      assert.equal(locations.template, "dirname-preserved");
      assert.equal(
        fs.realpathSync.native(locations.directory),
        fs.realpathSync.native(path.join(workspace.root, "src")),
      );
      assert.equal(
        fs.realpathSync.native(locations.classRoot),
        fs.realpathSync.native(workspace.root),
      );
      const helpers = (payload as { publicHelpers: unknown }).publicHelpers;
      assert.deepEqual(helpers, {
        memoryFile: "export const value = 1;\n",
        decoded: { value: 1 },
        scoped: "@scope/package",
        builtin: null,
      });
    }
    assert.deepEqual(
      fs.readFileSync(path.join(workspace.root, "tsconfig.json")),
      config,
    );
    assert.deepEqual(
      fs.readFileSync(path.join(workspace.root, "src/runtime.mts")),
      source,
    );
    assert.equal(
      fs.existsSync(path.join(workspace.root, "src/runtime.mjs")),
      false,
    );
  } catch (error) {
    combinedFailures.push(error);
  }
  if (combinedFailures.length === 1) throw combinedFailures[0];
  if (combinedFailures.length > 1)
    throw new AggregateError(
      combinedFailures,
      "Runtime and native frontdoor boundaries failed",
    );
}
