import fs from "node:fs";
import path from "node:path";

import { createFilesystemPathIdentityContext } from "../../internal/pathIdentity/createFilesystemPathIdentityContext";
import { RuntimeEmitBundle } from "./build/RuntimeEmitBundle";
import { isOutsideRelativePath } from "./isOutsideRelativePath";

/**
 * Match a source to actual compiler-written JavaScript using producer
 * provenance.
 *
 * Keys are absolute writer paths. Source arrays contain physical coordinates
 * established by the producer owner, not lexical names resolved again after
 * compilation. Native hosts use their input ledger; external compiler adapters
 * own their observed-program, output-rule and stability premises. Empty source
 * arrays and multiple owners are unknown ownership. A missing record is
 * legacy/unavailable; an authoritative empty record means no outputs. Neither
 * filename layout nor source maps supply missing proof.
 *
 * Source-content freshness belongs to the generation owner. An owned output
 * that disappears remains owned, so its reader reports that failure by name.
 * Physical output coordinates use one native identity transaction to compare
 * actual writer aliases. Explicitly bundled generations use their admitted
 * normalized coordinates under the physical private root; only their parent
 * directories resolve native aliases, leaving virtual leaves untouched.
 * Captured sources are never resolved again.
 *
 * @evidence contracts/common.md#principled-implementation The producer owner associates its eligible sources with actual writes under its documented observation premises; captured physical coordinates establish ownership independently of filename precedence or source-map settings.
 * @evidence contracts/common.md#clear-and-simple-design One source index owns producer associations and the optional explicit bundle reader; ordinary callers retain physical output behavior and never infer bundle authority from a neighboring filename.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing, incomplete or ambiguous provenance cannot be converted to ownership by extension order, matching names or newer source-map content.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs define writer/source coordinates, empty and missing states, and freshness ownership; properties carry only native documentation.
 *
 * @evidence contracts/performance.md#efficient-algorithms Construction indexes output/source associations. Physical outputs retain native alias resolution; canonical bundled coordinates use path operations, while other parent spellings attempt native realpath. Queries reuse the maps and observe the requested source identity.
 * @evidence contracts/performance.md#reuse-equivalent-work One constructed index shares captured associations across queries, while each query resolves its current source target. Continued source-content/generation validity remains the producing build owner's responsibility, and a new build needs a new index.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The instance retains source/output Sets, root strings, proof-gap reasons and an optional bounded runtime bundle until its caller discards it. Association/path bytes have no separate ceiling; bundle storage is capped at 128 MiB. No query history, global generation map or independently held descriptor is acquired.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Physical writer aliases use native identity resolution. Explicit bundles bind validated native relative names to their physically resolved private root without guessing missing-file case policy. Captured source coordinates normalize only Windows volume-root spelling.
 */
export class EmitOwnershipIndex {
  /** Absolute native directory containing this build's isolated outputs. */
  public readonly emitDir: string;

  /** Source root retained as build context, without inferring output ownership. */
  public readonly rootDir: string;

  private readonly bySource = new Map<string, Set<string>>();
  /** Output ranges retained only by this immutable runtime generation's index. */
  private readonly bundle: RuntimeEmitBundle | undefined;
  /** Concrete proof gaps retained for actionable lookup failures. */
  private readonly unavailableReasons: string[];

  /**
   * Index one completed build's source associations, detached from input
   * arrays. Sources are already physical coordinates: resolving them again
   * could adopt a retargeted alias as if it produced the earlier output. The
   * optional output record checks complete coverage before runtime user files
   * enter the tree.
   */
  public constructor(props: {
    /** Native isolated output directory owned by the build. */
    emitDir: string;

    /** Native source-root context of the completed invocation. */
    rootDir: string;

    /** Only an admitted runtime result authorizes reading a private bundle. */
    bundledOutputs?: true;

    /** Complete relative JavaScript output record, captured before layout links. */
    outputs?: readonly string[];

    /** Absolute written output to captured physical source paths; [] is unknown. */
    emittedSources?: Readonly<Record<string, readonly string[]>>;

    /** Observed producer refusal reasons; these never establish ownership. */
    emittedSourceProofFailures?: Readonly<Record<string, string>>;
  }) {
    // Output spelling is not provenance: the same native writer file can be
    // named through a case, short-name or directory-link alias. Resolve only
    // output coordinates here; captured source coordinates stay untouched.
    const outputIdentity = createFilesystemPathIdentityContext();
    this.emitDir = outputIdentity.resolve(path.resolve(props.emitDir)).path;
    this.bundle =
      props.bundledOutputs === true
        ? RuntimeEmitBundle.shared(this.emitDir)
        : undefined;
    if (props.bundledOutputs === true && this.bundle === undefined)
      throw new Error("ttsc: admitted runtime output bundle is missing");
    this.rootDir = path.resolve(props.rootDir);
    const inputRoot = path.resolve(props.emitDir);
    const resolveOutput = (output: string): { path: string; key: string } => {
      if (this.bundle === undefined) return outputIdentity.resolve(output);
      // Resolve native parent aliases without following the virtual output leaf.
      // Containment alone grants neither inventory membership nor provenance.
      const location = this.bundle.resolve(output);
      if (location === null)
        throw new Error("ttsc: bundled output escapes its admitted root");
      return { path: location, key: physicalSourceKey(location) };
    };
    if (
      props.emittedSources !== undefined &&
      (typeof props.emittedSources !== "object" ||
        props.emittedSources === null ||
        Array.isArray(props.emittedSources))
    ) {
      throw new Error("ttsc: invalid emitted-source provenance record");
    }
    const unavailableReasons =
      props.emittedSources === undefined
        ? ["the emitting producer supplied no provenance record"]
        : [];
    const outputNames = props.outputs ?? this.bundle?.outputs();
    const recorded =
      outputNames === undefined
        ? undefined
        : new Set(
            outputNames.map(
              (file) => resolveOutput(path.resolve(inputRoot, file)).key,
            ),
          );
    const accounted = new Set<string>();
    const ownersByOutput = new Map<string, Set<string>>();
    for (const [output, sources] of Object.entries(
      props.emittedSources ?? {},
    )) {
      if (!path.isAbsolute(output) || !Array.isArray(sources)) {
        throw new Error("ttsc: invalid emitted-source provenance record");
      }
      const identity = resolveOutput(path.resolve(output));
      const location = identity.path;
      if (!isJavaScriptOutput(location)) continue;
      const relative = path.relative(this.emitDir, location);
      if (relative === "" || isOutsideRelativePath(relative)) {
        throw new Error(
          "ttsc: emitted-source provenance escapes its output directory",
        );
      }
      if (recorded !== undefined && !recorded.has(identity.key)) {
        throw new Error(
          "ttsc: emitted-source provenance names an unrecorded output",
        );
      }
      accounted.add(identity.key);
      const keys = new Set<string>();
      for (const source of sources) {
        if (typeof source !== "string" || !path.isAbsolute(source)) {
          throw new Error(
            "ttsc: invalid physical source in emitted-source provenance",
          );
        }
        keys.add(physicalSourceKey(source));
      }
      const previousOwners = ownersByOutput.get(identity.key);
      if (previousOwners === undefined) {
        ownersByOutput.set(identity.key, new Set(keys));
      } else {
        const previousSize = previousOwners.size;
        for (const key of keys) previousOwners.add(key);
        if (previousSize <= 1 && previousOwners.size > 1) {
          unavailableReasons.push(
            `multiple source owners were established across output aliases for ${JSON.stringify(location)}: ${JSON.stringify([...previousOwners])}`,
          );
        }
      }
      if (keys.size !== 1) {
        const reason = props.emittedSourceProofFailures?.[output];
        unavailableReasons.push(
          keys.size === 0
            ? `no source owner was established for ${JSON.stringify(location)}${typeof reason === "string" ? `: ${reason}` : ""}`
            : `multiple source owners were established for ${JSON.stringify(location)}: ${JSON.stringify([...keys])}`,
        );
        continue;
      }
      const key = keys.values().next().value!;
      let outputs = this.bySource.get(key);
      if (outputs === undefined) {
        outputs = new Set();
        this.bySource.set(key, outputs);
      }
      outputs.add(location);
    }
    if (recorded !== undefined) {
      for (const output of recorded) {
        if (isJavaScriptOutput(output) && !accounted.has(output))
          unavailableReasons.push(
            `written output has no provenance entry: ${JSON.stringify(output)}`,
          );
      }
    }
    this.unavailableReasons = unavailableReasons;
  }

  /**
   * List the JavaScript outputs of a completed build's private directory. The
   * default enumerates physical files; an explicit bundled generation validates
   * its stored inventory. Paths are relative to emitDir with protocol slashes.
   * This list checks coverage but cannot establish source ownership.
   *
   * @evidence contracts/common.md#principled-implementation Nonfollowing physical enumeration or an explicitly selected validated bundle records JavaScript outputs and propagates incomplete-storage failures.
   * @evidence contracts/common.md#clear-and-simple-design Both representations supply the same sorted relative path list without inferring source ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable subtrees are not silently omitted and later linked user files cannot become compiler output through a late snapshot.
   * @evidence contracts/common.md#meaningful-documentation Native prose states capture timing, returned spelling, link handling and the coverage-versus-ownership distinction before tags.
   * @evidence contracts/performance.md#efficient-algorithms Physical traversal visits E entries without reading content; an explicit bundle validates its range index and streams the bounded body through a fixed buffer. Both convert relative path text and sort J selected names.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call observes its selected storage representation; the build owner may retain the returned inventory under its immutable-generation premise.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The path list transfers to the build owner; no retained handle or cache is acquired.
   *
   * @evidence contracts/portability.md#os-neutral-implementation Node directory kinds and relative-path grammar own native behavior; only returned protocol paths normalize separators.
   */
  public static listOutputs(emitDir: string, bundledOutputs = false): string[] {
    if (bundledOutputs) {
      const bundle = RuntimeEmitBundle.shared(emitDir);
      if (bundle === undefined)
        throw new Error("ttsc: admitted runtime output bundle is missing");
      return bundle.outputs();
    }
    const root = path.resolve(emitDir);
    const outputs: string[] = [];
    const stack = [root];
    while (stack.length !== 0) {
      const directory = stack.pop()!;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const location = path.join(directory, entry.name);
        if (entry.isDirectory()) stack.push(location);
        else if (entry.isFile() && isJavaScriptOutput(location)) {
          outputs.push(path.relative(root, location).split(path.sep).join("/"));
        }
      }
    }
    return outputs.sort();
  }

  /**
   * Read an owned generation's logical output or source map. Bundled outputs
   * never fall through to authored files mirrored beside the private layout.
   *
   * @evidence contracts/common.md#principled-implementation A retained immutable bundle supplies exact output bytes; ordinary physical generations keep their native read and missing-file behavior.
   * @evidence contracts/common.md#clear-and-simple-design The generation index owns its byte reader beside its immutable output associations, without a global generation registry.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing bundled names return null instead of adopting a mirrored authored file as compiler output.
   * @evidence contracts/common.md#meaningful-documentation The prose states logical output/map scope and no-fallback behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Bundle lookup uses private native relative coordinates and ordinary reads retain Node filesystem semantics.
   * @evidence contracts/performance.md#efficient-algorithms Bundle reads index one name and read/hash only its byte range; ordinary reads load that one physical file.
   * @evidence contracts/performance.md#reuse-equivalent-work The index's immutable build identity owns the same bundle for all module loads; another generation gets a new index.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Returned text belongs to the caller, range metadata follows the index lifetime, and no body population, handle or per-query history is retained.
   */
  public readOutput(file: string): string | null {
    if (this.bundle !== undefined) return this.bundle.read(file);
    try {
      return fs.readFileSync(file, "utf8");
    } catch {
      return null;
    }
  }

  /**
   * Return the unique output actually written for this current physical source.
   * Complete provenance excluding it returns null. Missing, incomplete or
   * ambiguous ownership throws an error naming the source, output directory and
   * concrete proof gaps. Query aliases are resolved afresh so a retargeted
   * spelling cannot reuse an earlier ownership answer. Failure to observe the
   * current physical target propagates.
   *
   * @evidence contracts/common.md#principled-implementation Fresh query identity is compared with captured physical source coordinates; only one written output answers and complete exclusion alone permits null.
   * @evidence contracts/common.md#clear-and-simple-design One source lookup replaces filename inference; unavailable proof is explicit rather than a hidden fallback policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Legacy and unknown records cannot gain a unique owner through extension order or a lexical source alias resolved after compilation.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes exact, absent and error outcomes, plus fresh alias observation from source-content freshness; errors distinguish missing producer metadata, ownerless or ambiguous rows and uncovered written outputs with their native coordinates.
   * @evidence contracts/performance.md#efficient-algorithms Construction indexes associations and resolves output coordinates in one memoized native identity transaction, including native capability queries where required; path normalization, alias merging and proof-gap text costs accompany it. Missing suffixes can add ancestor and case-observation work. A successful query resolves source identity and performs one map lookup without scanning outputs or source maps; unavailable errors format retained reason text rather than rereading the output tree.
   * @evidence contracts/performance.md#reuse-equivalent-work A completed build's captured associations serve all queries while aliases stay fresh; another build requires a new index.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Index storage grows with captured associations and proof-gap path bytes, with no query history or retained native handle; each successful query finishes its native realpath observation synchronously.
   * @evidence contracts/portability.md#os-neutral-implementation Native realpath resolves current aliases to physical spelling; exact captured names remain distinct when directory case policy changes, without OS-wide lowercase assumptions.
   */
  public find(source: string): string | null {
    this.assertAvailable(source);
    return this.findPhysical(fs.realpathSync.native(path.resolve(source)));
  }

  /**
   * {@link find} for a caller that resolved the source's physical path itself,
   * in this same lookup. The runtime resolves each module once when it is
   * loaded and then asks every build in turn whether it compiled that file;
   * resolving it again per build cost several native path resolutions per
   * module (samchon/ttsc#1852). A spelling that is not the current physical
   * path simply matches no captured source.
   *
   * @evidence contracts/common.md#principled-implementation Ownership compares the supplied current physical path with captured physical source coordinates; the freshness of that path is the caller's single resolution rather than a second one here.
   * @evidence contracts/common.md#clear-and-simple-design find resolves and delegates, so both entry points share one lookup and one failure policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No filename or extension inference answers for an unmatched spelling; unavailable or ambiguous provenance still throws.
   * @evidence contracts/common.md#meaningful-documentation The prose states the caller's obligation, why the split exists and the unmatched-spelling result.
   * @evidence contracts/performance.md#efficient-algorithms One key normalization and one map lookup, with no filesystem request.
   * @evidence contracts/performance.md#reuse-equivalent-work The caller's one resolution serves every build it asks; captured associations are shared as for find.
   * @evidence contracts/performance.md#bound-retention-and-release-resources No query history or native handle is retained.
   * @evidence contracts/portability.md#os-neutral-implementation The key keeps the native physical spelling and normalizes only the Windows volume root, as captured sources are keyed.
   */
  public findPhysical(physical: string): string | null {
    this.assertAvailable(physical);
    const outputs = this.bySource.get(physicalSourceKey(physical));
    if (outputs === undefined) return null;
    if (outputs.size !== 1) {
      throw new Error(
        `ttsc: emitted-source ownership is ambiguous for ${JSON.stringify(physical)}: ${JSON.stringify([...outputs])}`,
      );
    }
    return outputs.values().next().value!;
  }

  /** Refuse every lookup while this build's provenance has a proof gap. */
  private assertAvailable(source: string): void {
    if (this.unavailableReasons.length !== 0) {
      throw new Error(
        `ttsc: exact emitted-source ownership is unavailable for ${JSON.stringify(path.resolve(source))} in ${JSON.stringify(this.emitDir)}; ${this.unavailableReasons.join("; ")}. Rebuild with supported emit provenance`,
      );
    }
  }
}

/** JavaScript-bearing outputs, excluding maps and declaration artifacts. */
function isJavaScriptOutput(file: string): boolean {
  return [".js", ".jsx", ".mjs", ".cjs"].includes(
    path.extname(file).toLowerCase(),
  );
}

/**
 * Key an already physical coordinate without revisiting its alias or folding
 * directory-sensitive names. Only Windows volume-root spelling is normalized,
 * matching the native identity resolver's root convention.
 */
function physicalSourceKey(file: string): string {
  const location = path.normalize(file);
  if (process.platform !== "win32") return location;
  const root = path.parse(location).root;
  return root.toLowerCase() + location.slice(root.length);
}
