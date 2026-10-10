import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { OwnedSynchronousProcess } from "../../../internal/OwnedSynchronousProcess";
import { SourceNativeRetirement } from "../../../internal/SourceNativeRetirement";
import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { GoSourceInputs } from "./GoSourceInputs";
import { GoToolResolution } from "./GoToolResolution";
import { PluginContentIdentities } from "./PluginContentIdentities";
import { PluginLoadAnswers } from "./PluginLoadAnswers";
import { SourcePluginAdmission } from "./SourcePluginAdmission";
import { SourcePluginWorkspace } from "./SourcePluginWorkspace";
import { ensureExecutableGoToolchain } from "./ensureExecutableGoToolchain";
import { hashPluginBuildEnvironment } from "./hashPluginBuildEnvironment";
import { pluginSourceDigest } from "./pluginSourceDigest";
import { resolveGoCompiler } from "./resolveGoCompiler";
import { resolvePluginGoModule } from "./resolvePluginGoModule";
import { spawnGoTool } from "./spawnGoTool";

/**
 * Observe Go-selected packages under the native builder's workspace policy.
 *
 * Metadata does not compile dependencies or certify a later build. A cold build
 * repeats ownership admission in its proven, materialized workspace.
 *
 * @evidence contracts/common.md#principled-implementation The selected Go tool, effective environment, shared workspace writer and actual copied package inputs determine package names and errors; Go remains the build-constraint and package-validity authority.
 * @evidence contracts/common.md#clear-and-simple-design One namespace separates contextual observation, metadata framing and ownership admission; source-only contributions are observed inside their selected host module.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No filename exception or partial tag parser classifies packages. Go Error and empty production-file selections are rejected rather than trusting Name from an erroneous package.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes metadata selection from compilation and later materialized admission.
 * @evidence contracts/portability.md#os-neutral-implementation Native path/fs operations and the shared Go tool selector preserve environment-name and path identity without blanket case folding; Go itself applies target platform and cgo selection.
 * @evidence contracts/performance.md#efficient-algorithms One list command observes all distinct package entries in each prepared context. Context materialization traverses and copies admitted host/contributor files; workspace setup delegates manifest commands and list skips dependency loading. Framing and JSON parsing process complete output bytes, and retained results scale with selected packages/files.
 * @evidence contracts/performance.md#reuse-equivalent-work Entries are deduplicated within a contextual observation; callers group equivalent module contexts for one load. No metadata result is cached across source, environment or toolchain changes. Cold admission uses the already prepared real build workspace.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each metadata scratch has finally-based retirement-aware cleanup, and capture resources belong to spawnGoTool. Unknown native retirement retains scratch under the existing scope; results and complete output remain caller-owned with no independent byte ceiling.
 */
export namespace NativeSourcePackages {
  /**
   * Go-selected package identity, production files and diagnostic.
   *
   * @evidence contracts/common.md#principled-implementation Go supplies these observations; Name alone is not valid ownership when Error exists or production files are absent.
   * @evidence contracts/common.md#clear-and-simple-design One record preserves the fields needed by admission without interpreting constraints.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A record is not proof of compilation or later input stability.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation Dir preserves native spelling; other fields are Go-owned text.
   * @evidence contracts/performance.md#efficient-algorithms A type executes no algorithm.
   * @evidence contracts/performance.md#reuse-equivalent-work The type establishes no result cache.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The type acquires no handles; its caller owns record lifetime.
   */
  export interface Package {
    /** Physical package directory reported by Go. */
    Dir?: string;

    /** Selected package name; an error does not make it authoritative. */
    Name?: string;

    /** Selected ordinary Go source basenames. */
    GoFiles?: string[];

    /** Selected cgo source basenames. */
    CgoFiles?: string[];

    /** Go-owned package diagnostic. */
    Error?: { Err: string };
  }

  /**
   * One load's readings, shared by its package selections and its builds:
   * source directory digests and module build-environment digests, each by
   * absolute directory. The builds fill and report the same maps, so a load
   * reads each directory and each module's toolchain once.
   *
   * @evidence contracts/common.md#principled-implementation Both maps carry readings already taken in this load under its fixed effective environment; builds still take their own environment reading with a witness.
   * @evidence contracts/common.md#clear-and-simple-design Two maps already owned by the loader travel together.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The maps never outlive the load; cross-process reuse belongs to the record store.
   * @evidence contracts/common.md#meaningful-documentation Members state their keys and values.
   * @evidence contracts/portability.md#os-neutral-implementation Keys are native absolute paths.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A record type runs no algorithm.
   * @evidence contracts/performance.md#reuse-equivalent-work Selections and builds of one load share one reading per directory and module.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The loader owns both maps for one load.
   */
  export interface SelectionReadings {
    /** `pluginSourceDigest` of each directory this load read. */
    sources?: Map<string, string>;

    /** Build-environment digest of each module root this load read. */
    environments?: Map<string, string>;
  }

  /**
   * Observe entries together in a private module layout for their context.
   *
   * @evidence contracts/common.md#principled-implementation The original source module pins the selected native Go tool before copying. Actual observations retain their owning manifests; prospective nested observations replace only scratch root manifests with the maintained generic host manifests. Source-only final admissions enter their selected host module.
   * @evidence contracts/common.md#clear-and-simple-design Copying, workspace construction and batched reading have separate owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Go interprets tags, suffixes, cgo and manifests; selected errors are returned for admission, not overwritten by guessed kinds.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation Native copy/path and selected tool/environment owners preserve platform identity; contribution target containment is checked.
   * @evidence contracts/performance.md#efficient-algorithms Copies admitted host/contributor bytes and enumerates entries; workspace setup reads manifests and one list command skips dependencies.
   * @evidence contracts/performance.md#reuse-equivalent-work All entries share one prepared context; optional readers are scoped to one load and the same selected tool/effective environment.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Finally releases owned scratch through retirement authority; unknown native closure defers removal and capture cleanup remains delegated.
   */
  export function inspect(opts: {
    source: string;
    pluginName: string;
    env?: NodeJS.ProcessEnv;
    packages: readonly { entry: string; source?: string; name?: string }[];
    readers?: Map<string, SourcePluginWorkspace.GoModReader>;
    proposal?: boolean;

    /**
     * Record store under which an equal selection is answered without Go
     * (#1721); without it every load runs the full observation.
     */
    identities?: PluginContentIdentities.Store;

    /**
     * The load's source and environment readings, shared with its builds so
     * one load reads each directory and each module's toolchain once.
     */
    readings?: SelectionReadings;
  }): Package[] {
    const env = SidecarEnvironment.merge(opts.env ?? process.env);
    const { moduleRoot } = resolvePluginGoModule(opts.source, opts.pluginName);
    const compiler = resolveGoCompiler(env);
    const goBinary = GoToolResolution.resolveGoToolForBuild(
      compiler.binary,
      env,
      moduleRoot,
    );
    ensureExecutableGoToolchain(goBinary, compiler.bundled);
    // WARNING (#1721): never drop this lookup or narrow its identity. Without
    // it every warm launch and every unplugin generation copied the module
    // twice and ran `go list` twice (6 s+ on Windows) to rediscover an answer
    // its unchanged inputs already determined.
    const identity =
      opts.identities === undefined
        ? undefined
        : selectionIdentity(opts, moduleRoot, goBinary, env, opts.identities);
    if (identity !== undefined) {
      const recalled = recallSelection(
        PluginLoadAnswers.read(opts.identities, SELECTION_ANSWER, identity),
        moduleRoot,
        opts.packages.length,
      );
      if (recalled !== undefined) return recalled;
    }
    const scratch = createCanonicalTempDirectory("ttsc-package-selection-");
    let taskFailure: { error: unknown } | undefined;
    try {
      SourceNativeRetirement.register({
        fenceRoot: scratch,
        retainedPaths: [scratch],
      });
      SourcePluginWorkspace.materialize(moduleRoot, scratch);
      // An answer is recorded only for the copy its identity describes: a
      // module edited between the identity reading and the copy observed
      // other bytes than the key names.
      let copiesKeyed =
        identity === undefined || pluginSourceDigest(scratch) === identity.module;
      if (opts.proposal === true) {
        // Only root manifests change. Relative Go inputs retain the source
        // module layout, while its irrelevant graph/toolchain stays inactive.
        const hostModule = resolvePluginGoModule(
          genericHostSource(),
          opts.pluginName,
        ).moduleRoot;
        for (const name of ["go.mod", "go.sum"]) {
          const manifest = path.join(hostModule, name);
          const target = path.join(scratch, name);
          if (fs.existsSync(manifest)) fs.copyFileSync(manifest, target);
          else fs.rmSync(target, { force: true });
        }
      }
      for (const input of opts.packages) {
        if (input.source === undefined) continue;
        const contributor = { source: input.source, name: input.name! };
        SourcePluginAdmission.requireContributorPackage(
          opts.pluginName,
          contributor,
        );
        const target = path.resolve(scratch, input.entry);
        if (
          path.relative(scratch, target).startsWith("..") ||
          target === scratch
        )
          throw new Error("ttsc: invalid package selection target");
        if (fs.existsSync(target))
          throw new Error(
            `ttsc: package selection target already exists: ${target}`,
          );
        SourcePluginWorkspace.materialize(input.source, target);
        if (identity !== undefined)
          copiesKeyed &&=
            pluginSourceDigest(target) ===
            identity.entries.find((entry) => entry[0] === input.entry)?.[2];
      }
      const reader = SourcePluginWorkspace.createGoModReader(
        goBinary,
        opts.pluginName,
        env,
        opts.readers,
        opts.identities,
      );
      SourcePluginWorkspace.writeGoWork(
        scratch,
        SourcePluginWorkspace.findTtscOverlayDirs(),
        goBinary,
        opts.pluginName,
        env,
        reader,
      );
      const observed = read({
        cwd: scratch,
        entries: opts.packages.map((input) => input.entry),
        env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
        goBinary,
        pluginName: opts.pluginName,
      });
      if (
        identity !== undefined &&
        copiesKeyed &&
        observed.every((input) => input.Error === undefined) &&
        JSON.stringify(overlayDigests(opts.identities)) ===
          JSON.stringify(identity.overlays)
      )
        PluginLoadAnswers.write(
          opts.identities,
          SELECTION_ANSWER,
          identity,
          observed.map((input) => ({
            ...input,
            Dir:
              input.Dir === undefined
                ? undefined
                : path.relative(scratch, input.Dir),
          })),
        );
      return observed;
    } catch (error) {
      taskFailure = { error };
      throw error;
    } finally {
      SourceNativeRetirement.releaseResource(
        scratch,
        () => {
          fs.rmSync(scratch, { recursive: true, force: true });
        },
        taskFailure,
      );
    }
  }

  /**
   * Group one load's standalone candidates by their actual owning module.
   *
   * @evidence contracts/common.md#principled-implementation Bounded module resolution groups package entries under the module that a standalone build uses; selected errors remain terminal at ownership admission.
   * @evidence contracts/common.md#clear-and-simple-design A map groups input indices, one contextual observation serves each module, and ordered output preserves caller identity.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No selected tool or workspace error is converted to a fallback observation. Cancellation remains terminal through checkpoints.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation Native module roots retain their selected spelling, without blanket case folding.
   * @evidence contracts/performance.md#efficient-algorithms One grouping pass plus contextual copies and metadata work for each distinct module; output storage scales with input population.
   * @evidence contracts/performance.md#reuse-equivalent-work Equivalent entries in a module share one list; overlay module observations share the load's selected-tool readers, without global metadata caching.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Grouping/maps/results live for this call/load; scratch and native captures remain with inspect/read.
   */
  export function ownPackages(
    inputs: readonly { source: string; label: string }[],
    env: NodeJS.ProcessEnv,
    readers = new Map<string, SourcePluginWorkspace.GoModReader>(),
    identities?: PluginContentIdentities.Store,
    readings?: SelectionReadings,
  ): Package[] {
    const groups = new Map<string, Array<{ index: number; entry: string }>>();
    inputs.forEach((input, index) => {
      const target = resolvePluginGoModule(input.source, input.label);
      const group = groups.get(target.moduleRoot) ?? [];
      group.push({ index, entry: target.entry });
      groups.set(target.moduleRoot, group);
    });
    const output: Package[] = new Array(inputs.length);
    for (const group of groups.values()) {
      const first = inputs[group[0]!.index]!;
      const observations = inspect({
        source: first.source,
        pluginName: first.label,
        env,
        readers,
        identities,
        readings,
        packages: group.map(({ entry }) => ({ entry })),
      });
      group.forEach(({ index }, offset) => {
        output[index] = observations[offset]!;
      });
    }
    return output;
  }

  /**
   * Propose ownership with the candidate-selected tool before final admission.
   *
   * Nested transform sources retain their admitted source-module layout but use
   * unchanged generic host root manifests in scratch. Their outer module graph
   * and toolchain are not source-only build authority. Module-root and check
   * sources retain their actual owning module. Executable proposals must agree
   * in the actual own module; linked proposals in each chosen actual host.
   *
   * @evidence contracts/common.md#principled-implementation Candidate tool selection occurs at the original owning module and effective environment; only prospective nested source-only manifests change in owned scratch before Go interprets the normal generated workspace.
   * @evidence contracts/common.md#clear-and-simple-design One grouping pass shares each module/proposal context and returns whether actual own-module observation already occurred.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Errors propagate; no fixed-point retry, manual constraint parser or ignored outer toolchain command determines kind.
   * @evidence contracts/common.md#meaningful-documentation Native prose states deterministic proposal authority and mandatory final ownership confirmation.
   * @evidence contracts/portability.md#os-neutral-implementation Native module/tool/environment owners preserve candidate-relative tool and source layout identity.
   * @evidence contracts/performance.md#efficient-algorithms Groups inputs by module and actual/prospective mode, copies each admitted module once per context, and batches entries through Go metadata; retained work scales with source bytes and distinct contexts.
   * @evidence contracts/performance.md#reuse-equivalent-work Equivalent entries share one observation and per-load manifest readers; no result crosses a load or changed context.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Group records live for this call; scratch/process cleanup remains with inspect and no independent output byte cap is imposed.
   */
  export function propose(
    inputs: readonly { source: string; label: string; ownModule?: boolean }[],
    env: NodeJS.ProcessEnv,
    readers = new Map<string, SourcePluginWorkspace.GoModReader>(),
    identities?: PluginContentIdentities.Store,
    readings?: SelectionReadings,
  ): Array<{ observation: Package; ownModule: boolean }> {
    const groups = new Map<
      string,
      Array<{ index: number; entry: string; ownModule: boolean }>
    >();
    inputs.forEach((input, index) => {
      const target = resolvePluginGoModule(input.source, input.label);
      const ownModule = input.ownModule === true || target.entry === ".";
      const key = JSON.stringify([target.moduleRoot, ownModule]);
      const group = groups.get(key) ?? [];
      group.push({ index, entry: target.entry, ownModule });
      groups.set(key, group);
    });
    const output: Array<{ observation: Package; ownModule: boolean }> =
      new Array(inputs.length);
    for (const group of groups.values()) {
      const first = inputs[group[0]!.index]!;
      const observations = inspect({
        source: first.source,
        pluginName: first.label,
        env,
        readers,
        identities,
        readings,
        proposal: !group[0]!.ownModule,
        packages: group.map(({ entry }) => ({ entry })),
      });
      group.forEach(({ index, ownModule }, offset) => {
        output[index] = { observation: observations[offset]!, ownModule };
      });
    }
    return output;
  }

  /**
   * Read metadata in an already prepared workspace, including cold builds.
   *
   * @evidence contracts/common.md#principled-implementation Actual Go list uses the supplied pinned tool, effective build environment and builder flags; results are matched to requested physical directories.
   * @evidence contracts/common.md#clear-and-simple-design One command handles distinct entries, framing delegates to parse, and physical lookup restores requested order.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Nonzero status, launch failure and missing package records propagate; no dependency compilation or fabricated success replaces Go output.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation The existing Go spawn owner supports native tools/wrappers, while native realpath matches package identities.
   * @evidence contracts/performance.md#efficient-algorithms Deduplication and result indexing scan entry/record populations; full output capture/framing and native physical-path lookups add byte/lookup costs.
   * @evidence contracts/performance.md#reuse-equivalent-work Duplicate entry requests share one command result within this prepared context; no result survives a subsequent read.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Capture cleanup belongs to spawnGoTool; returned records and decoded output are invocation-local, with no independent byte ceiling.
   */
  export function read(opts: {
    cwd: string;
    entries: readonly string[];
    env: NodeJS.ProcessEnv;
    goBinary: string;
    pluginName: string;
  }): Package[] {
    const entries = [...new Set(opts.entries)];
    if (entries.length === 0) return [];
    OwnedSynchronousProcess.checkpoint();
    const result = spawnGoTool(
      opts.goBinary,
      [
        "list",
        ...GoSourceInputs.BUILD_FLAGS,
        "-find",
        "-e",
        "-json=Dir,Name,GoFiles,CgoFiles,Error",
        ...entries,
      ],
      { cwd: opts.cwd, encoding: "utf8", env: opts.env, windowsHide: true },
    );
    OwnedSynchronousProcess.checkpoint();
    if (result.error !== undefined)
      throw new Error(
        SourcePluginWorkspace.goSpawnFailureMessage(
          `selecting Go packages for plugin "${opts.pluginName}"`,
          opts.pluginName,
          opts.goBinary,
          opts.cwd,
          result.error,
        ),
      );
    if (result.status !== 0)
      throw new Error(
        `ttsc: selecting Go packages for plugin "${opts.pluginName}" failed:\n${result.stderr || result.stdout}`,
      );
    const packages = parse(result.stdout);
    const selected = new Map(
      packages.map((input) => [
        input.Dir === undefined ? undefined : fs.realpathSync.native(input.Dir),
        input,
      ]),
    );
    return opts.entries.map((entry) => {
      const dir = fs.realpathSync.native(path.resolve(opts.cwd, entry));
      const input = selected.get(dir);
      if (input === undefined)
        throw new Error(`ttsc: Go returned no package metadata for ${dir}`);
      return input;
    });
  }

  /**
   * Require a valid production package and agreement with requested ownership.
   *
   * @evidence contracts/common.md#principled-implementation Go Error is terminal and Name is admitted only with ordinary or cgo production files; main means executable, and a requested kind must agree without reclassification.
   * @evidence contracts/common.md#clear-and-simple-design One admission function is shared by preliminary resolution, selected-host linking and cold build checks.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Test-only names and erroneous mixed-package names cannot claim ownership.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation This decision consumes Go text and counts without native path assumptions.
   * @evidence contracts/performance.md#efficient-algorithms A fixed number of field/count checks precedes one exact name comparison.
   * @evidence contracts/performance.md#reuse-equivalent-work Every current observation is checked directly; no kind cache is retained.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The function acquires no native resources and returns one kind string.
   */
  export function kind(
    input: Package,
    label: string,
    expected?: "executable" | "linked",
  ): "executable" | "linked" {
    if (input.Error !== undefined)
      throw new Error(
        `ttsc: plugin "${label}" Go package selection failed: ${input.Error.Err}`,
      );
    if (
      input.Name === undefined ||
      (input.GoFiles?.length ?? 0) + (input.CgoFiles?.length ?? 0) === 0
    )
      throw new Error(
        `ttsc: plugin "${label}" source has no Go-selected production files: ${input.Dir ?? "unknown package"}`,
      );
    const actual = input.Name === "main" ? "executable" : "linked";
    if (expected !== undefined && actual !== expected)
      throw new Error(
        `ttsc: plugin "${label}" Go package ownership disagrees with its proposal: selected ${actual}, expected ${expected} (${input.Dir ?? "unknown package"})`,
      );
    return actual;
  }

  /**
   * Frame Go's JSON object stream and validate the selected fields.
   *
   * @evidence contracts/common.md#principled-implementation A string/escape-aware brace state machine frames complete objects before standard JSON parsing; invalid framing and field shapes throw.
   * @evidence contracts/common.md#clear-and-simple-design Framing, JSON decoding and selected-field validation are explicit sequential steps.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Braces inside diagnostic strings cannot split records; no textual replacement fabricates a JSON array.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation JSON is a platform-neutral wire format and Dir bytes are preserved unchanged.
   * @evidence contracts/performance.md#efficient-algorithms One character pass frames output, followed by JSON parsing and selected filename-array validation; complete object slices/records scale with output bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work Each output stream is decoded once and retained only by the caller; no prior stream is reused.
   * @evidence contracts/performance.md#bound-retention-and-release-resources No handles are acquired; complete input/slices/decoded records can coexist without a separate byte cap.
   */
  export function parse(output: string): Package[] {
    const packages: Package[] = [];
    let start = -1;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let offset = 0; offset < output.length; offset += 1) {
      const token = output[offset]!;
      if (start < 0) {
        if (/\s/.test(token)) continue;
        if (token !== "{")
          throw new Error("ttsc: invalid Go package metadata stream");
        start = offset;
        depth = 1;
        continue;
      }
      if (quoted) {
        if (escaped) escaped = false;
        else if (token === "\\") escaped = true;
        else if (token === '"') quoted = false;
      } else if (token === '"') quoted = true;
      else if (token === "{") depth += 1;
      else if (token === "}" && --depth === 0) {
        const input: unknown = JSON.parse(output.slice(start, offset + 1));
        if (typeof input !== "object" || input === null || Array.isArray(input))
          throw new Error("ttsc: invalid Go package metadata object");
        const record = input as Package;
        if (
          (record.Dir !== undefined && typeof record.Dir !== "string") ||
          (record.Name !== undefined && typeof record.Name !== "string") ||
          [record.GoFiles, record.CgoFiles].some(
            (files) =>
              files !== undefined &&
              (!Array.isArray(files) ||
                files.some((file) => typeof file !== "string")),
          ) ||
          (record.Error !== undefined &&
            (record.Error === null || typeof record.Error.Err !== "string"))
        )
          throw new Error("ttsc: invalid Go package metadata fields");
        packages.push(record);
        start = -1;
      }
    }
    if (start >= 0)
      throw new Error("ttsc: incomplete Go package metadata stream");
    return packages;
  }
}

/** The maintained generic host supplies source-only proposal manifests. */
function genericHostSource(): string {
  return path.resolve(__dirname, "../../../..", "cmd/utility-host");
}

/** Answer family of package selections (`PluginLoadAnswers`). */
const SELECTION_ANSWER = "go-package-selection";

/** Fields `read` asks Go for; part of the selection identity. */
const SELECTION_FIELDS = "-json=Dir,Name,GoFiles,CgoFiles,Error";

/**
 * Everything a package selection's answer depends on, by content: the copied
 * module, each contributor copied into it, every ttsc overlay the generated
 * workspace uses, the generic host manifests a proposal substitutes, the
 * toolchain and build environment Go reads, every `GO*`/`CGO_*` variable the
 * `go list` process receives, the entries and the fixed command. Paths stay
 * out, so equal content in another location shares the answer, as the binary
 * key does.
 */
interface ISelectionIdentity {
  format: 1;
  command: readonly string[];
  mode: "proposal" | "actual";
  module: string;
  environment: string;
  variables: [string, string][];
  manifests: (string | null)[] | null;
  overlays: string[];
  entries: [string, string | null, string | null][];
}

function selectionIdentity(
  opts: Parameters<typeof NativeSourcePackages.inspect>[0],
  moduleRoot: string,
  goBinary: string,
  env: NodeJS.ProcessEnv,
  identities: PluginContentIdentities.Store,
): ISelectionIdentity | undefined {
  try {
    const readings = opts.readings ?? {};
    const directory = (root: string): string => {
      const resolved = path.resolve(root);
      let digest = readings.sources?.get(resolved);
      if (digest === undefined) {
        digest = PluginContentIdentities.sourceDirectory(identities, resolved);
        readings.sources?.set(resolved, digest);
      }
      return digest;
    };
    const resolvedRoot = path.resolve(moduleRoot);
    let environment = readings.environments?.get(resolvedRoot);
    if (environment === undefined) {
      const hash = crypto.createHash("sha256");
      hashPluginBuildEnvironment(
        hash,
        goBinary,
        moduleRoot,
        env,
        { readFile: (location) => fs.readFileSync(location) },
        undefined,
        identities,
      );
      environment = hash.digest("hex");
      readings.environments?.set(resolvedRoot, environment);
    }
    const host =
      opts.proposal === true
        ? resolvePluginGoModule(genericHostSource(), opts.pluginName)
            .moduleRoot
        : undefined;
    return {
      format: 1,
      command: ["list", ...GoSourceInputs.BUILD_FLAGS, "-find", "-e", SELECTION_FIELDS],
      mode: opts.proposal === true ? "proposal" : "actual",
      module: directory(moduleRoot),
      environment,
      variables: Object.entries(
        GoSourceInputs.goBuildEnv(goBinary, undefined, env),
      )
        .filter(
          (entry): entry is [string, string] =>
            entry[1] !== undefined && /^(GO|CGO_)/i.test(entry[0]),
        )
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
      manifests:
        host === undefined
          ? null
          : ["go.mod", "go.sum"].map((name) => fileDigest(path.join(host, name))),
      overlays: SourcePluginWorkspace.findTtscOverlayDirs().map(directory),
      entries: opts.packages.map((input) => [
        input.entry,
        input.name ?? null,
        input.source === undefined ? null : directory(input.source),
      ]),
    };
  } catch {
    // An identity that cannot be formed only costs the real observation.
    return undefined;
  }
}

/** The digest of every overlay module, in the generated workspace's order. */
function overlayDigests(
  identities: PluginContentIdentities.Store | undefined,
): string[] {
  return SourcePluginWorkspace.findTtscOverlayDirs().map((directory) =>
    PluginContentIdentities.sourceDirectory(identities, directory),
  );
}

/** A small manifest's content digest, or null when it does not exist. */
function fileDigest(file: string): string | null {
  try {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/**
 * A recorded selection rebased onto the module it now describes, or
 * `undefined` when the record does not have the shape `read` produces.
 */
function recallSelection(
  value: unknown,
  moduleRoot: string,
  count: number,
): NativeSourcePackages.Package[] | undefined {
  if (!Array.isArray(value) || value.length !== count) return undefined;
  try {
    const packages = NativeSourcePackages.parse(
      value.map((input) => JSON.stringify(input)).join("\n"),
    );
    if (packages.length !== count) return undefined;
    return packages.map((input) => ({
      ...input,
      Dir:
        input.Dir === undefined ? undefined : path.resolve(moduleRoot, input.Dir),
    }));
  } catch {
    return undefined;
  }
}
