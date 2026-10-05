import fs from "node:fs";
import path from "node:path";

import { createFilesystemPathIdentityContext } from "../../internal/pathIdentity/createFilesystemPathIdentityContext";
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
 * Output coordinates use one native identity transaction to compare actual
 * writer aliases; captured source coordinates are never resolved again.
 *
 * @evidence contracts/common.md#principled-implementation The producer owner associates its eligible sources with actual writes under its documented observation premises; captured physical coordinates establish ownership independently of filename precedence or source-map settings.
 * @evidence contracts/common.md#clear-and-simple-design One source index replaces forward layout, inverse filename buckets and map parsing with the actual producing build's associations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing, incomplete or ambiguous provenance cannot be converted to ownership by extension order, matching names or newer source-map content.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs define writer/source coordinates, empty and missing states, and freshness ownership; properties carry only native documentation.
 *
 * @evidence contracts/performance.md#efficient-algorithms Construction processes recorded output/source associations, normalizes source coordinate text, resolves output identities and builds source/output Sets. Native identity capability observations and proof-gap formatting remain costs of construction; queries reuse those maps instead of rescanning output trees.
 * @evidence contracts/performance.md#reuse-equivalent-work One constructed index shares captured associations across queries, while each query resolves its current source target. Continued source-content/generation validity remains the producing build owner's responsibility, and a new build needs a new index.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The instance retains source/output Sets, root strings and proof-gap reasons until its caller discards it. Population and bytes grow with captured associations and path/reason text without a configured byte ceiling; construction-local identity memo state is not stored on the instance, and no query history or independently held native descriptor is acquired.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Output writer aliases use the shared native filesystem identity resolver, preserving sensitive or unknown missing names; captured physical source coordinates remain distinct from later lexical aliases and normalize only Windows volume-root spelling.
 */
export class EmitOwnershipIndex {
  /** Absolute native directory containing this build's isolated outputs. */
  public readonly emitDir: string;

  /** Source root retained as build context, without inferring output ownership. */
  public readonly rootDir: string;

  private readonly bySource = new Map<string, Set<string>>();
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
    this.rootDir = path.resolve(props.rootDir);
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
    const recorded =
      props.outputs === undefined
        ? undefined
        : new Set(
            props.outputs.map(
              (file) =>
                outputIdentity.resolve(path.resolve(this.emitDir, file)).key,
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
      const identity = outputIdentity.resolve(path.resolve(output));
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
   * List ordinary JavaScript outputs before virtual-layout user files are
   * added. Paths are relative to emitDir with slash-separated protocol
   * spelling. Links are not followed and enumeration failure propagates; this
   * list checks coverage but cannot independently establish source ownership.
   *
   * @evidence contracts/common.md#principled-implementation Nonfollowing enumeration records ordinary JavaScript outputs and propagates failure rather than certifying an incomplete record as absence.
   * @evidence contracts/common.md#clear-and-simple-design An explicit stack supplies one sorted path list without content parsing or source inference.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable subtrees are not silently omitted and later linked user files cannot become compiler output through a late snapshot.
   * @evidence contracts/common.md#meaningful-documentation Native prose states capture timing, returned spelling, link handling and the coverage-versus-ownership distinction before tags.
   * @evidence contracts/performance.md#efficient-algorithms One traversal visits E entries, performs native directory reads and converts relative path text; J output paths are sorted with path-text comparison costs. It reads no output content, but entry/path storage grows with the enumeration.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This enumeration owns no cross-call sharing or validity protocol; every call observes the current tree. A build owner may retain the returned record for consumers under its capture-timing premise.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The path list transfers to the build owner; no retained handle or cache is acquired.
   *
   * @evidence contracts/portability.md#os-neutral-implementation Node directory kinds and relative-path grammar own native behavior; only returned protocol paths normalize separators.
   */
  public static listOutputs(emitDir: string): string[] {
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
    if (this.unavailableReasons.length !== 0) {
      throw new Error(
        `ttsc: exact emitted-source ownership is unavailable for ${JSON.stringify(path.resolve(source))} in ${JSON.stringify(this.emitDir)}; ${this.unavailableReasons.join("; ")}. Rebuild with supported emit provenance`,
      );
    }
    const physical = fs.realpathSync.native(path.resolve(source));
    const outputs = this.bySource.get(physicalSourceKey(physical));
    if (outputs === undefined) return null;
    if (outputs.size !== 1) {
      throw new Error(
        `ttsc: emitted-source ownership is ambiguous for ${JSON.stringify(physical)}: ${JSON.stringify([...outputs])}`,
      );
    }
    return outputs.values().next().value!;
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
