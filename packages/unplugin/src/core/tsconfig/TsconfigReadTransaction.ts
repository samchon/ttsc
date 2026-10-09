import fs from "node:fs";
import path from "node:path";
import { parseJsonc, tsconfigExtendsFileCandidates } from "ttsc/tsconfig";

import { extendsSpecifiers } from "./extendsSpecifiers";
import { resolveExtendsConfig } from "./resolveExtendsConfig";
import { resolveRealPath } from "./resolveRealPath";

/**
 * Share config observations and contextual selections within one synchronous read.
 *
 * Lexical paths own parsing and relative extends resolution. Physical paths
 * only guard ancestry cycles. A completed selection can be borrowed when the
 * current ancestors intersect its encountered physical identities exactly as
 * they did originally; otherwise a different cycle cut requires evaluation.
 * Ordered source observations travel with a completed selection, including
 * unresolved file candidates, so reuse preserves the caller's invalidation inputs.
 *
 * Create a new transaction for each independent freshness observation. This
 * owner neither validates reuse across reads nor supplies compiler diagnostics.
 * Shared observations do not establish an atomic filesystem snapshot.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A memo entry depends on the lexical source/edge observations and the
 *   intersection of its encountered physical identities with initial ancestry.
 *   Equal intersections preserve every cycle decision; changed intersections
 *   recompute. First-value and last-array queries retain their distinct order.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One owner shares decoded sources, identities and resolved edges; query-local
 *   completed selections keep selector semantics and cycle contexts separate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The existing host JSONC and extends primitives remain authoritative here.
 *   Missing candidates stay observed, aliases retain lexical anchors, and no
 *   cycle-truncated answer is borrowed under a different ancestry intersection.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain identity, contextual reuse, source replay and
 *   freshness lifetime. Members describe selector and invalid-list semantics.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node native paths preserve lexical declaring directories; realpath supplies
 *   physical cycle identity without case folding. Host extends/candidate APIs
 *   own file/package lookup and preserve their supported native spellings.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Each lexical config is decoded and physically resolved once per transaction;
 *   each visited outgoing specifier resolves once. Acyclic shared subgraphs
 *   select once per query and lexical config, including absent answers. Context
 *   validation and ordered source/identity unions follow accumulated subtree
 *   volume, potentially quadratic on chains; changed cycle contexts can require
 *   re-evaluation. Source bytes, path text and selector work contribute costs.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Invocation-owned nodes share source, failed reads, identity and resolved
 *   edges across keys. Query-local memo entries share only the same selector
 *   and matching ancestry intersection. No module cache or historical metadata
 *   grants continued authority; later observations construct a new transaction.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The caller owns the transaction until its synchronous read ends. Node state
 *   grows with lexical configs, source bytes and edges. Query maps retain at
 *   most one completed entry per lexical config, with subtree-sized witnesses,
 *   and become reclaimable after find returns. No handle or task is retained.
 */
export class TsconfigReadTransaction {
  private readonly nodes = new Map<string, ConfigNode>();

  /** Optional decoded sources belong to this same caller-owned transaction. */
  public constructor(private readonly configs = new Map<string, unknown>()) {}

  /**
   * Read a lexical source once; unavailable or non-object sources return null.
   *
   * Failed reads are retained for this observation too. The returned object is
   * shared with other selectors and must not be mutated; independent later
   * observations need a new transaction to read current bytes.
   *
   * @evidence contracts/common.md#principled-implementation Lexical keys preserve declaring contexts. Existing JSONC parsing supplies the source value; object/null discrimination keeps malformed and unavailable inputs unproven.
   * @evidence contracts/common.md#clear-and-simple-design One map lookup owns decoded and failed source observations independently of option selection and graph traversal.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No fallback config or metadata cache replaces current source bytes. This best-effort view leaves diagnostics to the native compiler.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains failure reuse, shared-object immutability and the independent observation lifetime.
   * @evidence contracts/portability.md#os-neutral-implementation Node reads the caller's native lexical file spelling; no physical alias merging or OS-wide case normalization changes its key.
   * @evidence contracts/performance.md#efficient-algorithms One lexical lookup avoids repeated decoding; the first successful read and parse scale with source bytes and parser work. Lookup and retained path text also contribute cost.
   * @evidence contracts/performance.md#reuse-equivalent-work Parsed and failed observations are shared by lexical key within this caller-owned transaction. A new freshness observation constructs a new owner rather than trusting the previous map.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous reads leave no open handle. Decoded values and failed keys remain in the transaction's caller-owned map until that observation ends; an explicitly supplied map retains its caller's lifetime.
   */
  public read(file: string): object | null {
    try {
      if (!this.configs.has(file))
        this.configs.set(file, parseJsonc(fs.readFileSync(file, "utf8")));
      const parsed = this.configs.get(file);
      return typeof parsed === "object" && parsed !== null ? parsed : null;
    } catch {
      this.configs.set(file, undefined);
      return null;
    }
  }

  /**
   * Select one declaration, preserving its lexical directory and observations.
   *
   * An undefined own selection inherits. Null masks inheritance without supplying
   * a value, as an invalid own file list does; a parent ignores that empty result.
   * First queries search later bases first; last queries visit all bases forward.
   * The caller's physical ancestor set is copied once and never mutated.
   * Selectors must preserve the parsed inputs and give the same declaration for
   * the same source; query reuse does not repeat their incidental effects.
   *
   * @evidence contracts/common.md#principled-implementation A completed answer is reusable only when its encountered physical identities have the same intersection with current ancestry. That preserves every observed cycle decision, including cuts; own declarations and first/last traversal retain lexical origins and key-specific precedence.
   * @evidence contracts/common.md#clear-and-simple-design A query-local visitor owns selection and contextual completed answers; transaction nodes separately share lexical source, identity and edge observations across keys.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Physical identity only guards cycles, never merges lexical aliases. Ordered observations include missing candidates and cycle cuts under the caller's traversal policy; no answer gains authority across independent reads.
   * @evidence contracts/common.md#meaningful-documentation Native prose describes undefined/null selection, base order, immutable caller ancestry and the pure-selector obligation; the class explains contextual replay and freshness.
   * @evidence contracts/portability.md#os-neutral-implementation Native resolve/dirname keep lexical anchors. Actual realpath guards physical ancestry, and existing host extends/candidate APIs own native lookup and spelling.
   * @evidence contracts/performance.md#efficient-algorithms Acyclic shared nodes select once per query; transaction nodes resolve each visited lexical identity and outgoing specifier once. Context checks and source/identity unions follow accumulated subtree volume, potentially quadratic on chains; changed cycle contexts can recompute, and selector/path/source work remains additional.
   * @evidence contracts/performance.md#reuse-equivalent-work Completed selected and absent answers share only this selector and an equal ancestry intersection. Shared transaction observations serve other key queries; new independent observations use a fresh transaction.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each query retains one completed entry per lexical node with subtree-sized identity/source witnesses, plus the active depth ancestry set. Those maps become reclaimable on return or throw; transaction nodes and caller collections retain their caller's lifetime. No handle or task is acquired.
   */
  public find<T>(
    tsconfig: string,
    select: (parsed: object) => T | undefined | null,
    seen: Set<string>,
    collect?: Set<string>,
    order: "first" | "last" = "first",
  ): { baseDir: string; value: T } | null {
    type Selection = {
      declared: { baseDir: string; value: T } | null;
      identities: Set<string>;
      blocked: Set<string>;
      sources: Set<string>;
    };
    const completed = new Map<string, Selection>();
    const ancestors = new Set(seen);
    const visit = (file: string): Selection => {
      let node = this.nodes.get(file);
      if (node === undefined) {
        node = { canonical: resolveRealPath(file), edges: new Map() };
        this.nodes.set(file, node);
      }
      const canonical = node.canonical;
      if (ancestors.has(canonical))
        return {
          declared: null,
          identities: new Set([canonical]),
          blocked: new Set([canonical]),
          sources: new Set(order === "last" ? [file] : []),
        };
      const cached = completed.get(file);
      if (cached !== undefined) {
        let equivalent = true;
        for (const identity of cached.identities)
          if (ancestors.has(identity) !== cached.blocked.has(identity)) {
            equivalent = false;
            break;
          }
        if (equivalent) return cached;
      }

      const identities = new Set([canonical]);
      const sources = new Set([file]);
      let declared: Selection["declared"] = null;
      const parsed = this.read(file);
      if (parsed !== null) {
        const own = select(parsed);
        if (own !== undefined) {
          if (own !== null)
            declared = { baseDir: path.dirname(file), value: own };
        } else {
          const specifiers = extendsSpecifiers(
            (parsed as { extends?: unknown }).extends,
          );
          if (order === "first") specifiers.reverse();
          ancestors.add(canonical);
          try {
            for (const specifier of specifiers) {
              let edge = node.edges.get(specifier);
              if (edge === undefined) {
                const base = resolveExtendsConfig(file, specifier);
                edge = {
                  file: base,
                  candidates:
                    base === null
                      ? (tsconfigExtendsFileCandidates(file, specifier) ?? [])
                      : [],
                };
                node.edges.set(specifier, edge);
              }
              if (edge.file === null) {
                for (const candidate of edge.candidates) sources.add(candidate);
                continue;
              }
              const child = visit(edge.file);
              for (const identity of child.identities) identities.add(identity);
              for (const source of child.sources) sources.add(source);
              if (child.declared !== null) {
                declared = child.declared;
                if (order === "first") break;
              }
            }
          } finally {
            ancestors.delete(canonical);
          }
        }
      }
      const blocked = new Set<string>();
      for (const identity of identities)
        if (ancestors.has(identity)) blocked.add(identity);
      const selection = {
        declared,
        identities,
        blocked,
        sources,
      };
      completed.set(file, selection);
      return selection;
    };
    const result = visit(path.resolve(tsconfig));
    for (const source of result.sources) collect?.add(source);
    return result.declared;
  }
}

/** Native observations shared across option-specific selection queries. */
interface ConfigNode {
  canonical: string;
  edges: Map<string, { file: string | null; candidates: readonly string[] }>;
}
