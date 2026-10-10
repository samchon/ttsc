import { FileSystemIterator, RuntimeDescendantController, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveSourceBuildCachePaths } from "../../../../packages/ttsc/src/plugin/internal/source/resolveSourceBuildCachePaths";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { NativeProcessObserver } from "../../../utils/src/NativeProcessObserver";
import { BatchWorkspace } from "../batch/BatchWorkspace";
import { positionalCompilerCorpus } from "../batch/positionalCompilerCorpus";
import { runtimeCacheFailureCorpus } from "../batch/runtimeCacheFailureCorpus";
import { assertRuntimeCliCorpus } from "../batch/runtimeCliCorpus";
import { runtimeFrontdoorsCorpus } from "../batch/runtimeFrontdoorsCorpus";
import { runtimeMapsCorpus } from "../batch/runtimeMapsCorpus";
import { assertRuntimeNodeCorpus } from "../batch/runtimeNodeCorpus";
import { assertRuntimeNormalPopulation } from "../batch/runtimeNormalPopulation";
import {
  denyWrites,
  runsAsRoot,
} from "../internal/ttsc/internal/read-only-directory";
import { readE2eTracePayload } from "../internal/readE2eTracePayload";
import { readRuntimeTraceWriter, verifyRuntimeCleanup } from "../internal/ttsc/internal/runtime-native-root-links";
import { test_plugin_corpus_source_plugin_warm_load_proves_inputs_without_go_selection } from "./ttsc/native-plugins/corpus-source/test_plugin_corpus_source_plugin_warm_load_proves_inputs_without_go_selection";
import { test_owned_native_process_joins_cancelled_command_trees } from "./ttsc/project/test_owned_native_process_joins_cancelled_command_trees";

/**
 * Verifies one public runtime loads the shared transformed graph. The existing
 * nested emission owner also selects the maintained driver-emit fixture: one
 * public TS4094 failure must preserve its actual diagnostics and discard
 * pending outputs before the host publishes files or a manifest. Direct Go emit
 * tests own both noEmitOnError callback lanes; this one false-lane public
 * request owns the publisher connection, not two CLI executions or a
 * Program-count certificate.
 *
 * Source-publication preparation also copies the real selected Go executable:
 * its first and warm environment readings must agree and remain witnessed,
 * while changed bytes and changed/restored bytes with restored mtime must
 * invalidate the first witness. This adds real Go metadata queries within the
 * existing source producer, without another install or native build. A
 * self-changing selected Go launcher must refuse every unstable version/byte
 * observation without seeding a reusable witness; stopping its mutation then
 * permits a fresh stable reading. Twelve real Go status commands cover help
 * failure 2 with stderr and version success 0 before/after mutation, each with
 * inherited ERRORLEVEL absent, 0 or 999. The selected Windows launcher must
 * preserve actual status rather than an inherited variable's shadow value.
 * These processes share the same source producer without another native build.
 *
 * The declaration preload also checks public in-memory API failure ownership:
 * an absent descriptor and an independent TS2322 preserve caller state across
 * relative, absolute and deep inferred incremental destinations. Its existing
 * installed actor and native seed are reused; recovery-only checks add native
 * compiler invocations, and a restored plugin-free capture verifies recovery.
 *
 * The same installed declaration preload also checks constructor environment
 * authority. Two Windows prepares reject a selected lowercase missing Go tool
 * and mixed-case missing descriptor runtime. A captured mixed-spelling context
 * then reaches actual preparation, compilation and transformation through an
 * environment-checking wrapper around the unchanged descriptor factory and
 * native composition. Its relative cache selector resolves the existing
 * physical cache; real source/tool/environment witnesses decide reuse. These
 * five API loads add descriptor/probe/native work without another actor,
 * installation or source producer. Direct cleanup units own distinct cache
 * roots, undefined/blank/duplicate selectors, instance isolation and caller
 * Go-cache protection. The fixture bodies are excluded from Evidence selection
 * and are covered by the owning experiment and review.
 *
 * After all existing receipt and source assertions, the installed positional
 * corpus adds eleven one-shot CLI requests and one response-reloading watch.
 * Selection, presentation, contained public copies, failed-copy refusal and
 * relative-cache adoption share the original complete native composition.
 * Source and response edits share that watch until its actual close joins.
 * Isolated reporting and restored owned inputs preserve the earlier actor
 * ledger; automatic context rows remain appended without deletion. These are
 * additional launcher/compiler lifetimes, with native work owned by the normal
 * source/tool/cache witnesses rather than presumed away.
 *
 * The actual same-file compiler rewrite emits opt-in attempt/result or original
 * error observations using its existing stat and the shared test trace runtime;
 * these records identify the caller thread, not an OS image-lock owner.
 *
 * Native string decoding, resolved JSON and unchanged neighboring values reach
 * one real ttsx entry. Unremoved configured discard calls throw, so successful
 * values cannot hide missing stripping. Every value belongs to this one graph.
 * The shared source producer also materializes one imported Go module under
 * four long components: patch-qualified directives and relative/absolute
 * replacement select first, changed external bytes select second, and an
 * incompatible local toolchain directive rejects before publication. External
 * replacements and workspace overlays are distinct epochs of that graph. The
 * workspace epoch imports a second real module, preserving the deep module's
 * required relative geometry while singleton snapshots remain compact. Six
 * baseline Go build attempts include binary-only cold rebuild, external byte
 * change, malformed dependency refusal and compatible workspace publication.
 * Actual Go -x must show cold helper compilation, unchanged object reuse across
 * different scratch roots and recompilation after edit; mode2 independently
 * observes embedding, logical runtime source and panic provenance. Six compiled
 * executions (four combined value/object probes, including the workspace helper
 * import, one cold-rebuild probe and one panic) replace the separate
 * source-project and object-cache recipes; restored bytes reuse the original
 * publication before the runtime borrows it. The first cold request can discard
 * two additional toolchain transactions; independent before/after SDK metadata
 * must explain every discarded native attempt, and the final attempt must be
 * stable. The static comment-only main assembly input requires a real assembler
 * command without depending on cold standard-library objects. Nine further
 * actual Go build attempts distinguish one byte transition with exact restored
 * mtime, three continuously changing transactions plus recovery, simultaneous
 * source motion, native failure and failed key-lease release. Only one-shot and
 * recovery add two literal binary executions. Private publication namespaces
 * separate conflicting failure states while retaining the producer and Go
 * object storage. The existing published content key also rejects nine unstable
 * version observations with restored launcher bytes and mtime, adding no native
 * build or cache adoption.
 *
 * The installed SDK also drives the platform helper's owned-command protocol
 * with one copied static Node fixture. Independent transport/error rows and an
 * actual parent/grandchild cancellation require joined process retirement,
 * absent late effects and successful recovery without another installation,
 * native build or compiler Program. Unknown descendant closure retains that
 * separate fixture root; failures join the experiment's collected outcomes.
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
 * runtime count alone does not certify total independent experimentation. The
 * existing native-source borrower also loads the copied root-pkg's
 * out-of-include index.ts through its own banner plugin/config. Its helper
 * independently resolves that installed source, requires one singleton-owned
 * JavaScript output in the manifest-selected dependency cache, and requires
 * exactly one package root banner. Missing/ambiguous ownership cannot pass.
 * This adds no actor; package/root fallback and native plugin work remain
 * additional unmeasured work. Authored installed bytes/no-write checks remain.
 *
 * The same ESM entry statically imports named bindings from a CommonJS star
 * barrel spanning native package require conditions, owned TypeScript source
 * and a relative/bare cycle. Literal named/default values, repeated namespace
 * and require identity, one evaluation per leaf, erased type-only metadata and
 * native blocked/missing errors distinguish discovery from execution. A native
 * installed-store alias additionally separates consumer transforms from a
 * package's own transform and a physical workspace target. Both the main host
 * and retained register actor observe that authority; the latter starts from
 * its actually loaded TypeScript parent and retains the normal entry gate.
 * Orphan maps identify all three authored sources through native physical
 * paths, permitting the loader's URL spelling. Fixture byte snapshots exclude
 * only the installed store's independently expected default ttsc build cache;
 * all authored files and the remaining population still detect adjacent emit.
 *
 *
 * Normal CLI cleanup is checked separately from payload and API assertions.
 * Its completed original invocation and raw owner probes require removal only
 * after every owner is locally absent; a valid short-circuit preserves the
 * independently attributed main generation and its actual owner/source bytes.
 * Original EXIT/CLOSE records do not imply immediate numeric PID absence.
 *
 * @evidence contracts/testing.md#behavioral-verification Native static ESM linking must expose all six literal package-star bindings while default/require values and one-evaluation counters agree. Installed-boundary plugin effects must match the authored JSON oracle in both public runtime and retained register output; authored fixture bytes and the complete non-cache population remain unchanged; only the independently expected default plugin cache is omitted before traversal, and orphan maps identify all three authored sources by native physical paths. Opt-in compiler rewrite events retain the actual primitive attempt/return/throw with the existing identity and caller thread; these observations do not certify the OS lock owner. The real ttsx process must return status0 and exactly one full labeled payload with contract42, copied JSON42/retained and all661 native JSX string values. Configured discard.call and logger.trace("drop") would throw if the actual strip transform or custom rule were missing; the retained default-only log distinguishes the contrary root config. Both standard decorator modules additionally require their literal must-be-stripped console.warn to be absent from actual stderr while retaining the exact class/method effects. The original binding-only main.mjs and independent b/a modules also execute inside this same Node graph, requiring exactly one b,a stdout line and unchanged authored bytes.
 * @evidence contracts/testing.md#independent-expectations Authored require/import targets have distinct literal values, and consumerEffect versus ownEffect independently distinguishes isolated, consumer-owned and package-owned compilation. The static expected.json is authored before execution, never derived from emitted code or runtime results. The source's authored42/retained values and pre-print UTF-16 rows establish expectations, not the runtime's own output. Exact original input bytes establish nonmutation. Windows native environment-name identity requires the constructor's literal missing Go executable to reach one actual failed primitive, independently of its documented diagnostic envelope; POSIX distinct names require no attempt of that missing path while the three positive API operations retain their existing descriptor and output assertions.
 * @evidence contracts/testing.md#distinguishing-cases Bare, conditional, source-only, relative and cycle edges coexist with direct exports, type-only erasure and blocked/missing native failures. A proven native NODE_MODULES alias contrasts with its own nearer config and a linked physical workspace outside the store; explicit cts/mts sources leave compiler module-format policy unchanged. Quoted/expression/ordinary JSX strings, JSON alias versus unchanged neighbor and configured throwing call versus retained console.info share the same module graph. The same Program preserves an enum through direct/barrel CommonJS-to-ESM loading with named/default identity, erased interface absence, repeated import identity, one source effect and live default getter42-to43; no extra producer/profile loop is introduced. Static if(false) reexport metadata yields an undefined namespace slot while the real CommonJS object owns no hidden property; template-only ghost metadata yields neither slot nor value. Both throwing helpers must remain inert. The existing ESNext owner additionally imports a literal node_modules CommonJS package and a miscased Node_Modules project source; their different physical parents prevent a case-insensitive filesystem from aliasing the two directory spellings.
 * The existing rejection actor also consumes one upfront readonly namespace. Native permission denial is required before its default-cache success, explicit-cache excluded refusal and included success; restored writes and complete input bytes establish release and nonmutation. Root privilege supplies zero readonly coverage. The two successful dispatches launch two real entry children, while the three former CLI parent launches and separate readonly staging disappear.
 * Those same two entries carry complete standard-decorator effects, opposite optional-chain emission and configured automatic versus direct/response-preserved JSX HTML. The included CommonJS entry also carries an actual import preload, main-module identity, physical argv1 and native shared require.cache identity without another entry child. Nested response before/after visible target flags selects ESNext versus ES2019; an invalid response is a failed dispatcher call with no extra entry child. Privileged runs use an explicit external cache for these two controls while retaining zero permission coverage. The existing register actor starts in the upfront legacy owner's preserve-mode TSX graph and then loads the original declared/descendant graph, keeping its native preparations as explicit work.
 * The already retained lock-holder actor installs public registration, rejects an included number-to-string error before its marker and leaves an empty register project index. Repairing that same source permits FIRST from one excluded index; the next same-basename index fails its entry check before its marker. The final missing owned output still causes actual exit1 and dead-holder cleanup. These checked loads retain native work but introduce no extra host or private profile.
 * The inherited live descendant additionally shares its existing runtime index
 * with one plugin-free sibling launcher/program pair that is deliberately
 * killed. One real installed clean launcher must remove a sibling whose actual
 * owners are all absent/ESRCH, keep the live descendant and print its exact
 * physical kept path. After release, the actual compiler API removes completed
 * generations only when every recorded owner is absent; any still-present or
 * unknown owner protects exact generation bytes and the runtime root. Original
 * kernel exit does not imply process-ID absence. This adds one runtime pair and one clean launcher, without
 * another project, installation or native plugin producer. The descendant's
 * authenticated controller holds the detached worker until explicit release.
 * One borrowed native observer serializes original-target acquisition and
 * retirement for registered, inherited and abandoned roles. The direct sibling
 * launcher is killed only after authenticated abrupt intent while both
 * originals are live. Its original kernel target retires before requesting
 * self-SIGKILL of a surviving child; an already-retired child needs no command.
 * Raw abrupt transport errors remain receipts, and both original kernel
 * lifetimes must retire. Output/close drains after child retirement. EOF is not departure
 * proof. API cleanup explicitly
 * removes ambient cache selectors while retaining the caller's Go cache.
 * Actual nested launcher closes and source/environment restoration publish
 * nonce-bound receipts outside every project walk. Parent cleanup settles the
 * admitted role phase without weakening strict release requests, then checks
 * original retirement independently of protocol or clean assertions. A failed
 * clean assertion remains a failure after proven joins; missing borrower or
 * restoration facts retain the shared inputs. CLI/API selection tracing uses
 * the existing ownership scan and never changes its conservative policy. The
 * internal trace root is provided even without external diagnostic selection.
 * Actual CLI PID/close and API invocation cursors bind raw native probe results
 * to independently captured owner records, admitted processes and physical
 * generations. All-ESRCH removal and protective retention have literal oracles;
 * missing, foreign or malformed observations fail. Direct native-ESRCH cleanup
 * units and the actual Windows absent-owner scene retain positive deletion
 * coverage. No platform name chooses the expected result.
 *
 * @evidence contracts/testing.md#execution-ownership Both new families borrow the existing main ttsx host, installed consumer, upfront Program and retained register actor. Source-only package compilation, two configless isolated emits, package-own and consumer/workspace Programs are real internal work in each process that reaches them; this test does not claim one Program or measure their counts. No new installation, native plugin producer or host is added. The main graph invokes TestProject.spawnAsync once while its outer event loop owns authenticated descendant control. The existing native-process controls borrow that same observer only after controller requests and roles join; the outer Runtime closes the session once. Its main-thread declaration preload uses actual public API output capture, one installed CLI forced-emit dispatch on the shared nested source graph, one shared rejected-bootstrap Node actor and one retained fresh installed-register Node actor; the existing lock-holder actor supplies the negative checked load. No legacy test or profile launcher is invoked. Native emission, default preparation, orphan lowering, the four retained actor lifetimes (including the detached registered descendant), one abandoned sibling launcher/program pair, its clean launcher and two readonly entry children are explicit costs, not one-process or one-Program claims. The upfront frontdoor corpus separately restores eight actual startup/terminal launcher requests and their four CLI entry children. runtimeMapsCorpus additionally uses two root-option launcher lifetimes to combine native V8 coverage and stack consumers; real native preparations remain additional work. Independent failures collect together.
 * @evidence contracts/e2e.md#necessary-boundary Static name units cannot establish native ESM linking and shared CommonJS evaluation through served compiler output. Ownership units cannot establish which installed transform actually runs through ttsx and register. Public ttsx connects native transforms, source publication and actual Node loading. Go rule units cannot establish the loaded graph's observed values or source preservation.
 * @evidence contracts/e2e.md#shared-execution Static fixtures join the existing runtime graph and register actor; one package-own project supplies both sibling sources, and one consumer project supplies its physical workspace. No per-case launcher or new native producer is introduced. One consumer and its runtime process carry the value graph, source-race/identity loads and installed clean dispatch. The existing lock-holder child also requires a checked module after its actual emitted file is removed: acquired-holder stdout, missing-owned stderr and exit1 establish both real negative transport and the exited holder. Exact output bytes restore before the main graph. Legacy/default/explicit dispatch controls share that consumer. Selective generation cleanup additionally reuses the inherited descendant's namespace with one plugin-free sibling launcher/program pair and one actual clean launcher; post-retirement API cleanup reuses that state and distinguishes absent-owner removal from conservative protection. Raw same-scan trace consumption and generation byte snapshots add filesystem work without a process or repeated liveness probe. Real Go metadata/build/smoke and isolated emit children remain disclosed internal costs, not standalone source projects or one-Program certification.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Batch setup proves the lowercase installed spelling aliases the authored uppercase store, creating a link only where native spelling is distinct. Physical workspace links retain native source identity. Complete authored input trees are captured before consumers and compared after joins; no private cache reset or source rewrite manufactures the result. Native errors are outside the positive tsconfig population. The excluded orphan changes during its actual compiler read, restores original bytes before the second require and finally, and its environment authority restores before the main graph. The private compiler copy is the actual delegate of those two required race lowerings before its identity/cache controls; the witness waits for that compiler child to close, with no additional preparation CLI or claim that kernel metadata writers are quiescent. The first identity artifact, unchanged marked reuse and same-physical same-byte rewrite remain distinct expectations. Observation-only preparation receipts stay outside the exact five-field behavior report. The authored sibling runtimeCliCache independently names the CLI-selected cache for explicit orphan placement; the shared plugin cache remains a separate environment authority, while the manifestless register still selects the project-local default cache. The main source remains immutable. Register, API and emission receipt windows precede a distinct MAIN reporting projection; original base and automatic-marker bytes restore only after actual main and all original borrower joins. MAIN receipts are captured immediately at main close and checked against actual reporting driver Programs with literal contributor values. Nonreporting emit-only builds retain their native status and constructor facts; a nonzero result additionally requires consumed project emission attributed to that command's selected config and private output generation. Child-specific post-clean consumed JavaScript and its inline map bind the authenticated child to the authored lazy source without requiring a new compiler spawn on valid reuse. Process error/signal/null status fails and unknown closure retains the common owner.
 * @evidence contracts/e2e.md#preserved-coverage Existing runtime observations remain unchanged. New runtime observers attempt each independent family even after a linking/load failure, and their assertions collect outside the older payload assertion block. Existing own-property/getter/main identity and direct parser units retain their distinct boundaries. Keeps the native factory value matrix and combined utility alias/strip/runtime observations in one real loaded graph. The standard class/method warning-removal composition and original ESNext member-initialization effects run in both .mts/.cts modules in the same upfront Program; the contrary module-package .cts value is loaded alongside the .mts public entry. Source dirname, imported class root and both asset reads preserve their independent physical identities. The export population additionally observes real tslib IIFE reexports, inert throwing/template negatives, computed dynamic default exports, live default getters and bare-package versus project basename ownership, all from upfront inputs in the same host. Direct commonjs preparation/metadata and emit ownership units own their detailed portable distinctions. Dependency profile recipes are not repeated; isolated orphan lowering and other compiler-mode/lifetime transitions remain outside this population. TestFormatSortImportsPreservesBindingImportEvaluationOrder now splits its zero-findings invariant into TestFormatSortImportsPreservesSideEffectImports and its unchanged raw ESM bytes into this actual runtime; existing status, payload and markers remain asserted.
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
  const bindingRoot = path.join(
    workspace.root,
    "src/runtime-corpus/import-binding",
  );
  const bindingInputs = await FileSystemIterator.read(bindingRoot);
  assert.deepEqual(
    Object.fromEntries(Object.entries(bindingInputs)),
    {
      "main.mjs":
        'import bDefault, { bNamed } from "./b.mjs";\nimport * as aNamespace from "./a.mjs";\nconsole.log(globalThis.__sortImportsTrace.join(","));\nvoid bDefault;\nvoid bNamed;\nvoid aNamespace;\n',
      "b.mjs":
        'globalThis.__sortImportsTrace ??= [];\nglobalThis.__sortImportsTrace.push("b");\nexport default 0;\nexport const bNamed = 0;\n',
      "a.mjs":
        'globalThis.__sortImportsTrace ??= [];\nglobalThis.__sortImportsTrace.push("a");\nexport const aNamed = 0;\n',
      "main.d.mts": "export {};\n",
    },
    "binding oracle uses the exact authored donor bytes",
  );
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
  const runtimeBoundaryRoots = [
    "tools/runtime-package-stars",
    "tools/runtime-package-boundary",
    "src/runtime-corpus/export-population/package-stars",
  ].map((relative) => path.join(workspace.root, relative));
  const runtimeBoundaryCache = path.join(
    workspace.root,
    "tools/runtime-package-boundary/app/NODE_MODULES/.cache/ttsc",
  );
  const readRuntimeBoundaryInputs = (root: string): Map<string, Buffer> => {
    const files = new Map<string, Buffer>();
    const cache = fs.existsSync(runtimeBoundaryCache)
      ? fs.realpathSync.native(runtimeBoundaryCache)
      : undefined;
    const visit = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (cache === undefined || fs.realpathSync.native(file) !== cache)
            visit(file);
        } else if (entry.isFile()) files.set(file, fs.readFileSync(file));
      }
    };
    visit(root);
    return files;
  };
  const runtimeBoundaryInputs = runtimeBoundaryRoots.map(readRuntimeBoundaryInputs);
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
  const combinedFailures: unknown[] = [];
  let mainJoined = false;
  let mainJoinedAt: string | undefined;
  let allRoleAdmissionsKnown = workspace.installationOnly;
  let nestedBorrowersKnown = workspace.installationOnly;
  let mainRuntimeAfter: number | undefined;
  let mainContextReceipts: Record<string, unknown>[] | undefined;
  let observer: Awaited<ReturnType<ReturnType<typeof NativeProcessObserver.prepare>["open"]>> | undefined;
  let controller: ReturnType<typeof RuntimeDescendantController.create> | undefined;
  let controllerRoot: string | undefined;
  let controllerAddress: Awaited<ReturnType<NonNullable<typeof controller>["listen"]>> | undefined;
  let runtimeTraceRoot: string | undefined;
  const readWriter = (pid: number): Record<string, any>[] => {
    assert.ok(runtimeTraceRoot);
    return readRuntimeTraceWriter(runtimeTraceRoot, pid);
  };
  let mainTraceBefore = new Set<string>();
  let mainRunsBefore: string[] = [];
  const automaticManifest = path.join(workspace.root, "packages/batch-auto-discovery/package.json");
  const automaticBytes = workspace.installationOnly ? undefined : fs.readFileSync(automaticManifest);
  const registeredLazyFile = path.join(workspace.root, "src/runtime-corpus/descendant-lazy.cts");
  const registeredLazyBytes = workspace.installationOnly ? undefined : fs.readFileSync(registeredLazyFile);
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
  const runtimeCliCache = workspace.runtimeCliCache;
  const callerParent = path.join(runtimeCliCache, "runtime-caller");
  const callerDirectory = path.join(callerParent, "isolated");
  const relativeCache = path.relative(workspace.projectAlias, runtimeCliCache);
  const wrongCallerCache = path.resolve(callerDirectory, relativeCache);
  if (!workspace.installationOnly) {
    assert.equal(path.isAbsolute(relativeCache), false);
    assert.notEqual(wrongCallerCache, runtimeCliCache);
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
    if (!workspace.installationOnly) {
      observer = await NativeProcessObserver.prepare().open();
      controller = RuntimeDescendantController.create(observer, ["registered", "descendant", "sibling"]);
      controllerRoot = TestProject.tmpdir("ttsc-runtime-descendants-");
      controllerAddress = await controller.listen(controllerRoot);
      runtimeTraceRoot = process.env.TTSC_E2E_TRACE ?? path.join(controllerRoot, "trace");
      assert.ok(path.isAbsolute(runtimeTraceRoot));
      fs.mkdirSync(runtimeTraceRoot, { recursive: true });
    }
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
    if (!workspace.installationOnly) {
      const mainIndex = path.join(runtimeCliCache, "project");
      mainRunsBefore = fs.existsSync(mainIndex) ? fs.readdirSync(mainIndex) : [];
      assert.deepEqual(mainRunsBefore, [], "the selected main cache must start without an earlier runtime generation");
    }
    const previousTrace = process.env.TTSC_E2E_TRACE;
    if (runtimeTraceRoot) {
      mainTraceBefore = new Set(readWriter(process.pid).map((row) => row.invocation));
      process.env.TTSC_E2E_TRACE = runtimeTraceRoot;
    }
    try {
      result = await TestProject.spawnAsync(
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
            TTSC_E2E_PROCESS_TRACE_RUNTIME: E2eProcessTrace.runtimePath,
            TTSC_E2E_RUNTIME_CLI_CACHE: runtimeCliCache,
            TTSC_E2E_INSTALLED_TTSX: workspace.installedTtsx,
            TTSC_E2E_PROJECT_ALIAS: workspace.projectAlias,
            TTSC_E2E_READONLY_ROOT: workspace.installationOnly
              ? undefined
              : readonlyRoot,
            TTSC_E2E_READONLY_DENIED: readonlyActive ? "1" : undefined,
            TTSC_E2E_TRACE: runtimeTraceRoot ?? process.env.TTSC_E2E_TRACE,
            TTSC_E2E_DESCENDANT_ROOT: controllerAddress?.directory,
            TTSC_E2E_DESCENDANT_NONCE: controllerAddress?.nonce,
            TTSC_E2E_DESCENDANT_PORT: controllerAddress?.port.toString(),
          },
        },
      );
    } finally {
      if (previousTrace === undefined) delete process.env.TTSC_E2E_TRACE;
      else process.env.TTSC_E2E_TRACE = previousTrace;
    }
    mainJoined = result.error === undefined && (result.pid ?? 0) > 0 &&
      (result.status !== null || result.signal !== null);
    mainJoinedAt = new Date().toISOString();
    mainContextReceipts = BatchWorkspace.readContextReceipts(workspace);
    mainRuntimeAfter = mainContextReceipts.length;
  } catch (cause) {
    combinedFailures.push(cause);
  } finally {
    if (controller) {
      // Admission survives later protocol failure. Cleanup chooses the actual
      // admitted phase atomically; strict scenario requests remain unchanged.
      for (const receipt of controller.snapshot()) {
        try { await controller.settle(receipt.role); }
        catch (cause) { combinedFailures.push(new Error("Runtime role cleanup settlement: " + receipt.role, { cause })); }
      }
      try { await controller.close(); }
      catch (cause) { combinedFailures.push(cause); }
      try {
        const outcomes = new Map<string, Record<string, any>>();
        let owner: number | undefined;
        // Preloads execute in order. A final failed earlier preload explicitly
        // excludes later actors; a missing receipt after success proves nothing.
        for (const name of ["declared", "clean", "owned"]) {
          const outcome = JSON.parse(fs.readFileSync(path.join(controllerRoot!, name + "-outcome.json"), "utf8"));
          assert.equal(outcome.nonce, controller.nonce, "nested actor receipt must belong to this original controller");
          assert.equal(Number.isSafeInteger(outcome.owner) && outcome.owner > 0, true);
          if (owner === undefined) owner = outcome.owner;
          else assert.equal(outcome.owner, owner, "all preload/entry receipts must identify their actual common main actor");
          assert.equal(outcome.finished, true, "nested actor must finish publishing its borrower population");
          assert.equal(outcome.actors !== null && typeof outcome.actors === "object" && !Array.isArray(outcome.actors), true);
          for (const actor of Object.values(outcome.actors) as Record<string, any>[]) {
            assert.equal(actor.attempted, true);
            assert.equal(actor.closed, true, "each attempted nested launcher must have its actual original close");
            assert.equal(Number.isSafeInteger(actor.pid) && actor.pid > 0, true);
            assert.equal(typeof actor.status === "number" || typeof actor.signal === "string", true, "a close without an original terminal outcome cannot certify the borrower");
          }
          if (name === "declared") {
            assert.equal(outcome.inputsRestored, true);
            if (outcome.registerRestorationRequired) assert.equal(outcome.registerRestored, true);
          } else if (name === "clean") {
            assert.equal(outcome.emittedRestored, true);
            assert.equal(outcome.inputsRestored, true);
            assert.equal(outcome.environmentRestored, true);
          }
          outcomes.set(name, outcome);
          if (name !== "owned") {
            assert.equal(typeof outcome.success, "boolean");
            if (!outcome.success) break;
          }
        }
        const required = new Map([
          ["registered", outcomes.get("declared")?.actors.registered !== undefined],
          ["descendant", outcomes.get("owned")?.actors.parent !== undefined],
          ["sibling", outcomes.get("owned")?.actors.sibling !== undefined],
        ]);
        const roles = controller.snapshot();
        for (const [role, attempted] of required) {
          const receipt = roles.find((candidate) => candidate.role === role);
          if (!attempted) assert.equal(receipt, undefined, "an unattempted nested actor cannot own an admitted role");
          else {
            assert.ok(receipt?.parent && receipt.target, "attempted descendant must retain its authenticated original admission");
            assert.equal(receipt.parentRetired && receipt.childRetired, true, "both admitted original kernel targets must retire");
          }
        }
        const owned = outcomes.get("owned");
        if (owned && owned.semanticErrors.length === 0) {
          const descendant = roles.find((receipt) => receipt.role === "descendant")!;
          assert.equal(owned.descendantAdmission.parent.targetId, descendant.parent!.targetId);
          assert.equal(owned.descendantAdmission.target.targetId, descendant.target!.targetId);
          assert.equal(owned.traces.cli.pid, owned.actors.clean.pid, "selection evidence must belong to the actual closed clean launcher");
          assert.equal(owned.traces.api.pid, owned.owner, "API selection evidence must belong to the actual main actor");
          assert.equal(owned.cleanupScans.cli.length, 2);
          assert.ok(owned.cleanupScans.api.length > 0);
          const live = owned.cleanupScans.cli.filter((scan: any) => scan.owners.some((owner: any) => owner.owner.pid === descendant.target!.pid));
          assert.equal(live.length, 1);
          assert.equal(live[0].protected, true, "the authenticated held descendant requires its actual protective scan");
          for (const scan of [...owned.cleanupScans.cli, ...owned.cleanupScans.api])
            assert.ok(scan.rows.length > 0 && scan.owners.length > 0, "successful cleanup must retain its bound raw probe population");
        }
        allRoleAdmissionsKnown = true;
        nestedBorrowersKnown = true;
      } catch (cause) {
        combinedFailures.push(new Error("Runtime nested borrower or restoration acknowledgement unavailable", { cause }));
      }
    }
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
    const lifetimeKnown = mainJoined && nestedBorrowersKnown && allRoleAdmissionsKnown &&
      (workspace.installationOnly || controller?.joined() === true);
    if (!lifetimeKnown && !workspace.installationOnly) {
      BatchWorkspace.retain("original Runtime parent or descendant lifetime remains unresolved");
      if (controllerRoot) TestProject.retainTemporaryDirectory(controllerRoot, "Runtime original targets unresolved");
    }
    if (!workspace.installationOnly && lifetimeKnown) {
      try { fs.writeFileSync(path.join(workspace.root, "tsconfig.json"), config); }
      catch (cause) { permissionFailures.push(cause); }
      try { fs.writeFileSync(automaticManifest, automaticBytes!); }
      catch (cause) { permissionFailures.push(cause); }
      if (!permissionFailures.length) {
        try { fs.unlinkSync(base); }
        catch (cause) { permissionFailures.push(cause); }
      }
    }
    if (permissionFailures.length) {
      BatchWorkspace.retain("shared Runtime originals could not be restored exactly after all borrowers joined");
      combinedFailures.push(new AggregateError(
        permissionFailures,
        "shared Runtime input and permission restoration failed",
      ));
    }
  }
  if (!workspace.installationOnly) {
    try {
      await BatchWorkspace.open();
      if (!mainJoined || !allRoleAdmissionsKnown || controller?.joined() !== true || !observer)
        throw new Error("Native controls blocked by unresolved Runtime controller/session prerequisite");
      await test_owned_native_process_joins_cancelled_command_trees(
        workspace.root,
        { observer },
      );
    } catch (error) {
      combinedFailures.push(error);
    } finally {
      if (observer) {
        try { await observer.close(); }
        catch (cause) {
          combinedFailures.push(cause);
          BatchWorkspace.retain("Runtime shared observer original closure remains unresolved");
        }
      }
    }
    try {
      await BatchWorkspace.open();
      await runtimeFrontdoorsCorpus(workspace);
    } catch (error) {
      combinedFailures.push(error);
    }
    try {
      await BatchWorkspace.open();
      await runtimeCacheFailureCorpus(workspace);
    } catch (error) {
      combinedFailures.push(error);
    }
    // The warm-load budget needs a record-free plugin cache and edits its own
    // plugin source, so it prepares a private project instead of borrowing the
    // shared immutable workspace.
    try {
      test_plugin_corpus_source_plugin_warm_load_proves_inputs_without_go_selection();
    } catch (error) {
      combinedFailures.push(error);
    }
  }
  // Cleanup eligibility is independent of payload, API and reporting oracles.
  if (!workspace.installationOnly) {
    try {
      assert.ok(result && mainJoined && runtimeTraceRoot);
      assert.equal(result.status, 0, result.stderr);
      const parentRows = readWriter(process.pid);
      const starts = parentRows.filter((row) => row.event === "process-start" &&
        row.pid === result!.pid && !mainTraceBefore.has(row.invocation));
      assert.equal(starts.length, 1, "the original CLI must have one newly admitted launch");
      const start = starts[0]!;
      assert.deepEqual(start.argv, [process.execPath, workspace.installedTtsx, ...selected,
        "src/runtime.mts", "--config", "x", "--port", "3", "--help"]);
      assert.equal(start.cwd, callerDirectory);
      const departures = parentRows.filter((row) =>
        row.instance === start.instance && row.invocation === start.invocation &&
        (row.event === "process-exit" || row.event === "process-close"));
      assert.deepEqual(departures.map((row) => [row.event, row.pid, row.status, row.signal]),
        [["process-exit", result.pid, 0, null], ["process-close", result.pid, 0, null]]);
      assert.ok(start.sequence < departures[0]!.sequence && departures[0]!.sequence < departures[1]!.sequence);
      const { mainEpochOwner } = JSON.parse(fs.readFileSync(
        path.join(workspace.root, "tools/runtime-declared-observed.json"), "utf8"));
      assert.ok(Number.isSafeInteger(mainEpochOwner) && mainEpochOwner > 0);
      verifyRuntimeCleanup({
        traceRoot: runtimeTraceRoot, launcher: result.pid, owner: mainEpochOwner,
        argv: start.argv, cwd: callerDirectory, cache: runtimeCliCache,
        entry: path.join(workspace.root, "src/runtime.mts"), source, before: mainRunsBefore,
        lifetime: { start: start.at, close: departures[1]!.at },
      });
    } catch (error) { combinedFailures.push(new Error("main CLI cleanup eligibility", { cause: error })); }
  }
  try {
    assert.ok(result);
    // Retention may deliberately keep renamed inputs. Preserve the original
    // process diagnostic before checking those dependent success invariants.
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
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
      assert.equal(fs.existsSync(path.join(runtimeCliCache, "plugins")), true);
      assert.equal(fs.existsSync(path.join(runtimeCliCache, "project")), true);
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
    assert.equal(
      result.stdout.split(/\r?\n/).filter((line) => line === "b,a").length,
      1,
      "binding imports execute b before a in the same actual Node actor",
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
        apiFailures: { name: string; detail: string; stack?: string }[];
        produced: string[];
        apiEnvironmentBefore: number;
        apiEnvironmentAfter: number;
        nativeEmitBefore: number;
        nativeEmitAfter: number;
        driverEmitBefore: number;
        driverEmitAfter: number;
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
        registerCompletedAt: string;
        mainEpochOwner: number;
        descendantAdmission: { announcement: { pid: number; parentPid: number }; target: unknown; parent: unknown };
        descendantRelease: { target: unknown; operation: string; at: string };
        descendantJoin: { target: unknown; parent: unknown; retired: boolean; completion: { nonce: string; role: string; pid: number; event: string; value: string; completedAt: string; error?: unknown } };
      };
      try {
        assert.deepEqual(
          declarationObservation.apiFailures,
          [],
          "every installed public API ownership row must pass after all shared runtime cases execute",
        );
      } catch (error) {
        combinedFailures.push(error);
      }
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
          path.join("types", "runtime-corpus", "native-factory.d.ts"),
        ),
        JSON.stringify(declarationObservation.produced),
      );
      assert.ok(
        declarationObservation.produced.includes(
          path.join("types", "runtime-corpus", "native-factory.d.ts.map"),
        ),
        JSON.stringify(declarationObservation.produced),
      );
      assert.ok(
        declarationObservation.produced.includes(
          path.join("state", "app.tsbuildinfo"),
        ),
        JSON.stringify(declarationObservation.produced),
      );
      assert.ok(mainContextReceipts && mainRuntimeAfter !== undefined && mainJoinedAt && runtimeTraceRoot);
      const allNativeReceipts = mainContextReceipts;
      // Original writers are joined before these bounded, identity-checked
      // reads. Only the selected writer PIDs are opened, never payload history.

      try {
        const rows = readWriter(declarationObservation.mainEpochOwner);
        assert.ok(rows.length > 0, "the original main writer must retain its actual API observations");
        const missingGo = path.join(workspace.root, "tools/api-missing-go.exe");
        const attempts = rows.filter((row) =>
          row.event === "process-attempt" && Array.isArray(row.argv) && row.argv[0] === missingGo);
        // The package-selection identity reads the Go environment before the
        // selection it may answer, so the alias is selected twice: by that
        // reading, then by the live selection the failed reading falls back to.
        assert.deepEqual(attempts.map((attempt) => attempt.argv[1]),
          process.platform === "win32" ? ["env", "mod"] : [],
          "only Windows constructor aliases select the deliberately missing Go executable");
        for (const attempt of attempts) {
          assert.equal(attempt.data.origin, "windows-go-tool");
          assert.equal(attempt.pid, null);
          const results = rows.filter((row) => row.event === "process-result" &&
            row.instance === attempt.instance && row.invocation === attempt.invocation);
          assert.equal(results.length, 1, "the selected Go attempt must have its own actual native result");
          const result = results[0]!;
          assert.ok(result.sequence > attempt.sequence);
          assert.deepEqual(result.argv, attempt.argv);
          assert.equal(result.cwd, attempt.cwd);
          assert.equal(result.data.origin, attempt.data.origin);
          assert.equal(result.pid, null);
          assert.equal(result.data.started, false);
          assert.equal(result.data.exitObserved, false);
          assert.equal(result.data.status, null);
          assert.equal(result.data.signal, null);
          assert.equal(result.data.error?.code, "ENOENT");
        }
      } catch (error) { combinedFailures.push(new Error("public API constructor Go selection", { cause: error })); }
      try {
        const admission = declarationObservation.descendantAdmission;
        const release = declarationObservation.descendantRelease;
        const joined = declarationObservation.descendantJoin;
        assert.equal(admission.announcement.pid, declarationObservation.descendantPid);
        assert.equal(admission.announcement.parentPid, declarationObservation.registerPid);
        assert.deepEqual(release.target, admission.target);
        assert.equal(release.operation, "release");
        assert.deepEqual(joined.target, admission.target);
        assert.deepEqual(joined.parent, admission.parent);
        assert.equal(joined.retired, true);
        assert.equal(joined.completion.nonce, controller!.nonce);
        assert.equal(joined.completion.role, "registered");
        assert.equal(joined.completion.pid, declarationObservation.descendantPid);
        assert.equal(joined.completion.event, "complete");
        assert.equal(joined.completion.error, undefined);
        assert.equal(joined.completion.value, "descendant-ready");
        const lower = Date.parse(release.at);
        const upper = Date.parse(joined.completion.completedAt);
        assert.ok(Number.isFinite(lower) && Number.isFinite(upper) && lower <= upper);
        const preparations = readWriter(declarationObservation.descendantPid).filter((row) =>
          row.event === "runtime-source-preparation" &&
          row.data.origin === "ttsx-commonjs-source-load" &&
          typeof row.data.filename === "string" && path.basename(row.data.filename) === path.basename(registeredLazyFile) &&
          fs.realpathSync.native(row.data.filename) === fs.realpathSync.native(registeredLazyFile) &&
          Date.parse(row.at) >= lower && Date.parse(row.at) <= upper);
        assert.ok(preparations.length > 0, "the authenticated child must consume compiler-prepared lazy source after actual default clean/release");
        for (const row of preparations) {
          assert.equal(row.data.selectedFormat, "commonjs");
          assert.equal(row.data.sourceEncoding, "utf16le");
          assert.equal(row.data.representation, "consumed-javascript-string");
          const bytes: Buffer = readE2eTracePayload(runtimeTraceRoot, row as { writerPid: number; instance: string; invocation: string }, row.data.source).bytes;
          assert.equal(bytes.length, row.data.sourceCodeUnits * 2);
          const javascript = bytes.toString("utf16le");
          assert.notEqual(javascript, registeredLazyBytes!.toString("utf8"));
          const encoded = /sourceMappingURL=data:application\/json(?:;charset=utf-8)?;base64,([^\s]+)/.exec(javascript);
          assert.ok(encoded, "the consumed child JavaScript must carry its real inline source map");
          const map = JSON.parse(Buffer.from(encoded[1]!, "base64").toString("utf8"));
          assert.equal(map.version, 3);
          const sourceIndex = (map.sources as string[]).findIndex((source) =>
            fs.realpathSync.native(source.startsWith("file:") ? fileURLToPath(source) : path.resolve(path.dirname(registeredLazyFile), map.sourceRoot ?? "", source)) === fs.realpathSync.native(registeredLazyFile));
          assert.notEqual(sourceIndex, -1);
          assert.equal(map.sourcesContent[sourceIndex], registeredLazyBytes!.toString("utf8"));
        }
        assert.deepEqual(fs.readFileSync(registeredLazyFile), registeredLazyBytes);
      } catch (error) { combinedFailures.push(new Error("registered child post-clean consumed-source and original-target proof", { cause: error })); }
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
        declarationObservation.driverEmitBefore,
        declarationObservation.nativeEmitAfter,
      );
      assert.deepEqual(
        allNativeReceipts.slice(
          declarationObservation.driverEmitBefore,
          declarationObservation.driverEmitAfter,
        ),
        [
          {
            name: "native-auto-discovery",
            operation: "identity",
            prefix: null,
            suffix: null,
          },
        ],
        "the failed raw driver owns its automatic native entry admission, not the preceding successful emit's receipt epoch",
      );
      assert.equal(
        declarationObservation.registerBefore,
        declarationObservation.driverEmitAfter,
        "frontend rejection and readonly inspection must admit no native entry before registration",
      );
      assert.ok(
        Number.isInteger(declarationObservation.registerAfter) &&
          declarationObservation.registerAfter >
            declarationObservation.registerBefore,
      );
      assert.ok(mainRuntimeAfter >= declarationObservation.registerAfter);
      assert.equal(allNativeReceipts.length, mainRuntimeAfter,
        "MAIN receipt endpoint belongs to the actual original main join, before later corpora");
      try {
        const mainLower = Date.parse(declarationObservation.registerCompletedAt);
        const mainUpper = Date.parse(mainJoinedAt);
        assert.ok(Number.isFinite(mainLower) && mainLower <= mainUpper);
        const mainRows = readWriter(declarationObservation.mainEpochOwner);
        const builds = mainRows.filter((row) =>
          row.event === "process-result" && Date.parse(row.at) >= mainLower &&
          Date.parse(row.at) <= mainUpper && Array.isArray(row.argv) &&
          row.argv.includes("build") && row.argv.some((argument: unknown) =>
            typeof argument === "string" && argument.startsWith("--plugins-json=")))
          .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
        const expected: Record<string, unknown>[] = [];
        const literalEntries: Record<string, Record<string, unknown>> = {
          "shared-real-program-probe": { name: "shared-real-program-probe", operation: null, prefix: "a:", suffix: ":z" },
          "native-order-prefix": { name: "native-order-prefix", operation: "prefix", prefix: "a:", suffix: null },
          "native-order-identity": { name: "native-order-identity", operation: "identity", prefix: null, suffix: null },
          "native-order-upper": { name: "native-order-upper", operation: "upper", prefix: null, suffix: null },
          "native-order-suffix": { name: "native-order-suffix", operation: "suffix", prefix: null, suffix: ":z" },
          "native-auto-discovery": { name: "native-auto-discovery", operation: "identity", prefix: null, suffix: null },
        };
        for (const build of builds) {
          assert.equal(build.data.started, true);
          assert.equal(build.data.exitObserved, true);
          assert.ok(Number.isInteger(build.data.status));
          assert.equal(build.data.signal, null);
          assert.equal(build.data.error, null);
          const programs = readWriter(build.pid).filter((row) =>
            row.event === "program-construction" && row.data.origin === "driver-create" &&
            row.data.outcome === "constructor-returned" &&
            Date.parse(row.at) >= mainLower && Date.parse(row.at) <= Date.parse(build.at));
          assert.equal(programs.length, 1, "each MAIN native build must expose its actual driver constructor");
          const program = programs[0]!;
          assert.deepEqual(program.argv, build.argv);
          assert.equal(program.cwd, build.cwd);
          const selector = (program.argv as string[]).find((argument) => argument.startsWith("--plugins-json="))!;
          const entries = JSON.parse(selector.slice("--plugins-json=".length));
          const reporters = entries.filter((entry: any) => entry.config?.contextReceipt === workspace.contextReceipt);
          if (reporters.length > 0) assert.equal(build.data.status, 0);
          else if (build.data.status !== 0) {
            const selectedConfigs = (build.argv as string[]).filter((argument) => argument.startsWith("--tsconfig="));
            const outputDirectories = (build.argv as string[]).filter((argument) => argument.startsWith("--outDir="));
            assert.equal(selectedConfigs.length, 1);
            assert.equal(outputDirectories.length, 1);
            const selectedConfig = selectedConfigs[0]!.slice("--tsconfig=".length);
            const outputDirectory = outputDirectories[0]!.slice("--outDir=".length);
            assert.ok(path.isAbsolute(selectedConfig) && path.isAbsolute(outputDirectory));
            const served = mainRows.filter((row) => {
              const attribution = row.data.emitAttribution;
              const servedAt = Date.parse(row.at);
              if (row.event !== "runtime-source-preparation" || row.instance !== build.instance ||
                row.sequence <= build.sequence || !Number.isFinite(servedAt) || servedAt < Date.parse(build.at) ||
                servedAt > mainUpper || attribution?.buildScope !== "project" ||
                attribution.selectedTsconfig !== selectedConfig || typeof attribution.emittedFile !== "string") return false;
              const relative = path.relative(outputDirectory, attribution.emittedFile);
              return relative.length > 0 && !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep);
            });
            assert.ok(served.length > 0, "a nonreporting emit-only nonzero result must retain actual serving from its own native output generation");
            for (const row of served) {
              assert.ok(["ttsx-commonjs-source-load", "ttsx-esm-source-load"].includes(row.data.origin));
              assert.equal(row.data.filename, row.data.emitAttribution.sourceFile);
              assert.equal(row.data.sourceEncoding, "utf16le");
              assert.equal(row.data.representation, "consumed-javascript-string");
              assert.ok(Number.isSafeInteger(row.data.sourceCodeUnits) && row.data.sourceCodeUnits > 0);
              const bytes: Buffer = readE2eTracePayload(runtimeTraceRoot, row as { writerPid: number; instance: string; invocation: string }, row.data.source).bytes;
              assert.equal(bytes.length, row.data.sourceCodeUnits * 2);
            }
          }
          for (const entry of reporters) {
            const literal = literalEntries[entry.name];
            assert.ok(literal, "MAIN must not invent a reporting contributor");
            assert.equal(entry.stage, "transform");
            assert.equal(entry.config.reportedProgramSources, true);
            assert.deepEqual(entry.config.reportedDependencies, []);
            assert.equal(Object.hasOwn(entry.config, "reportedFiles"), false);
            expected.push(literal);
          }
        }
        assert.ok(expected.some((record) => record.name === "native-auto-discovery"),
          "the real MAIN package boundary must admit its own Program and automatic contributor");
        assert.deepEqual(allNativeReceipts.slice(declarationObservation.registerAfter, mainRuntimeAfter), expected,
          "MAIN contexts must match independently observed successful driver Programs and literal fixture contributions");
      } catch (error) { combinedFailures.push(new Error("MAIN valid-Program reporting receipt epoch", { cause: error })); }
      assert.ok(Number.isSafeInteger(declarationObservation.apiEnvironmentBefore));
      assert.ok(Number.isSafeInteger(declarationObservation.apiEnvironmentAfter));
      assert.ok(declarationObservation.apiEnvironmentBefore >= receiptOffset);
      assert.ok(declarationObservation.apiEnvironmentAfter >= declarationObservation.apiEnvironmentBefore);
      assert.ok(declarationObservation.apiEnvironmentAfter <= declarationObservation.nativeEmitBefore);
      const apiEnvironmentRecords = allNativeReceipts.slice(
        declarationObservation.apiEnvironmentBefore,
        declarationObservation.apiEnvironmentAfter,
      );
      BatchWorkspace.assertContextReceipts(apiEnvironmentRecords);
      assert.deepEqual(
        apiEnvironmentRecords.filter((receipt) => receipt.name === "native-auto-discovery"),
        [
          { name: "native-auto-discovery", operation: "identity", prefix: null, suffix: null },
          { name: "native-auto-discovery", operation: "identity", prefix: null, suffix: null },
        ],
        "the constructor environment compile and transform each retain real automatic native discovery",
      );
      const nativeReceipts = [
        ...allNativeReceipts.slice(receiptOffset, declarationObservation.apiEnvironmentBefore),
        ...allNativeReceipts.slice(declarationObservation.apiEnvironmentAfter, declarationObservation.nativeEmitBefore),
      ];
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
      const legacyBegin = "TTSC_CLEAN_PHASE:legacy:begin";
      const legacyEnd = "TTSC_CLEAN_PHASE:legacy:end";
      assert.equal(result.stdout.split(legacyBegin).length, 2);
      assert.equal(result.stdout.split(legacyEnd).length, 2);
      const legacyStart =
        result.stdout.indexOf(legacyBegin) + legacyBegin.length;
      const legacyFinish = result.stdout.indexOf(legacyEnd);
      assert.ok(legacyFinish > legacyStart);
      const legacyOutput = result.stdout.slice(legacyStart, legacyFinish);
      assert.match(
        legacyOutput,
        /ttsc: kept [^\r\n]*legacy: a run that may still be in progress owns it/,
      );
      assert.match(
        legacyOutput,
        /ttsc: kept [^\r\n]*unknown: a run that may still be in progress owns it/,
      );
      assert.doesNotMatch(legacyOutput, /no cache directories found/);
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
        result.stderr,
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
      await FileSystemIterator.read(bindingRoot),
      bindingInputs,
      "binding import source/dependency bytes remain unchanged",
    );
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
  // These new families collect independently even when an older payload
  // assertion fails; each runtime observer already attempts every case.
  if (!workspace.installationOnly) {
    for (const verify of [
      () => {
        assert.ok(result);
        const payload = BatchWorkspace.readPayload(result.stdout) as { packageStars: any };
        assert.deepEqual(payload.packageStars.named, {
          named: ["package-foo", "require-condition", "owned-source", "cycle-a", "cycle-b", "direct"],
          defaults: ["package-foo", "require-condition", "owned-source", "cycle-a", "cycle-b", "direct"],
          identity: true, loads: [1, 1], typeOnlyAbsent: true, importConditionAbsent: true,
        });
      },
      () => {
        assert.ok(result);
        const payload = BatchWorkspace.readPayload(result.stdout) as { packageStars: any };
        assert.equal(payload.packageStars.blocked.code, "ERR_PACKAGE_PATH_NOT_EXPORTED");
      },
      () => {
        assert.ok(result);
        const payload = BatchWorkspace.readPayload(result.stdout) as { packageStars: any };
        assert.equal(payload.packageStars.missing.code, "MODULE_NOT_FOUND");
      },
      () => {
        assert.ok(result);
        const payload = BatchWorkspace.readPayload(result.stdout) as { installedBoundary: unknown };
        const expected = JSON.parse(fs.readFileSync(path.join(workspace.root, "tools/runtime-package-boundary/expected.json"), "utf8"));
        assert.deepEqual(payload.installedBoundary, expected);
      },
    ]) {
      try { verify(); } catch (error) { combinedFailures.push(error); }
    }
    for (const [index, root] of runtimeBoundaryRoots.entries()) {
      try {
        assert.deepEqual(readRuntimeBoundaryInputs(root), runtimeBoundaryInputs[index], "runtime package fixtures retain all input bytes and contain no adjacent emit outside the selected build cache");
      } catch (error) { combinedFailures.push(error); }
    }
  }
  if (!workspace.installationOnly) {
    try {
      await BatchWorkspace.open();
      runtimeMapsCorpus(workspace);
    } catch (error) {
      combinedFailures.push(error);
    }
  }
  if (!workspace.installationOnly) {
    try {
      await BatchWorkspace.open();
      await positionalCompilerCorpus(workspace);
    } catch (error) {
      combinedFailures.push(error);
    }
  }
  if (combinedFailures.length === 1) throw combinedFailures[0];
  if (combinedFailures.length > 1)
    throw new AggregateError(
      combinedFailures,
      "Runtime and native frontdoor boundaries failed",
    );
}
