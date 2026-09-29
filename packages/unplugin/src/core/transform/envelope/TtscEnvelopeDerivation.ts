import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { TtscProjectSpellings } from "../filesystem/TtscProjectSpellings";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";

/**
 * Per-envelope derivation state: every index the per-delivery paths need, built
 * at most once and shared by all deliveries of one compiler result.
 *
 * Building the direct-edge index, the candidate entries, the declared-file
 * identity sets, or the output/dependency key indexes per delivery costs
 * O(envelope) `pathIdentityKey` computations per module — and each of those
 * costs real path-resolution and case-semantics probes (`pathIdentityKey`). A
 * graph-bearing envelope (typia >= 13.1.19) turned that into O(modules x edges)
 * filesystem work per build, which is the samchon/ttsc#1007 stall. All
 * deliveries of one generation share this state, so a delivery pays only its
 * own reachability closure with memoized identities.
 *
 * Every index is lazy: a host that never wires `addWatchFile` and never misses
 * a project-relative key pays nothing beyond the volatile/completeness
 * membership sets, which are themselves built on first predicate use.
 *
 * Freshness matches the generation contract: every derivable path is a recorded
 * project or external input, so persistent-mode validation already proves those
 * paths unchanged on every non-build-scoped hit, and any change invalidates the
 * generation — and this state with it. The `WeakMap` key is the envelope object
 * itself, so the state dies when the generation does.
 *
 * @evidence contracts/common.md#principled-implementation Optional indexes distinguish unbuilt state from completed results, and declaredInputKeysBuilt separately represents a completed undefined result; shared physical identities and lexical watch keys preserve their different equivalence relations.
 * @evidence contracts/common.md#clear-and-simple-design One generation state groups lazy indexes and memo tables behind envelopeDerivation rather than requiring every delivery to maintain an independent cache.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts First-match key indexes preserve the supported producer lookup precedence, and the built flag represents a genuine optional outcome rather than manufacturing an empty declared input set.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain generation ownership, laziness, freshness and costs; each optional member documents its unbuilt meaning and the built flag's distinct role with documentation-skill spacing.
 * @evidence contracts/portability.md#os-neutral-implementation A FilesystemPathIdentityContext owns physical identity and native case semantics; explicit physical and lexical root spellings avoid hardcoded separator or OS-based case rules in the state representation.
 * @evidence contracts/performance.md#efficient-algorithms Maps and sets support keyed membership and lazy indexes; their populations grow with paths and declarations actually consulted by a generation rather than forcing complete graph preprocessing for every delivery.
 * @evidence contracts/performance.md#reuse-equivalent-work The envelope object defines generation ownership; physical-key indexes share across deliveries while watch lists key exact lexical module spellings because aliases have different exclusions. Reuse assumes the envelope and its project/options remain stable.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The owning WeakMap ties these maps to the envelope lifetime; retained entries grow with generation inputs and requested module spellings, and the state owns no independent filesystem handles.
 */
export interface TtscEnvelopeDerivation {
  /** One filesystem snapshot for every identity comparison in this envelope. */
  readonly identityContext: FilesystemPathIdentityContext;

  /**
   * The project root's two spellings, the one it was named by and the physical
   * one, resolved once for the envelope: the compiler reports its inputs
   * physically, and a host is handed each under the spelling it uses
   * (samchon/ttsc#1451).
   */
  readonly project: TtscProjectSpellings;

  /** Memoized `pathIdentityKey` results, keyed by the exact input. */
  readonly identities: Map<string, string>;

  /**
   * Lazily built reference-graph indexes, `undefined` until the first
   * watch-input derivation. A host without an `addWatchFile` hook never pays
   * the O(edges) build.
   */
  graph?: TtscEnvelopeGraphIndexes;

  /**
   * Lazily collected identities of the envelope's `volatile` member files,
   * `undefined` until the first volatility predicate.
   */
  volatileFiles?: Set<string>;

  /**
   * Lazily collected identities of the envelope's `dependenciesComplete` member
   * files, `undefined` until the first completeness predicate.
   */
  dependenciesComplete?: Set<string>;

  /**
   * Lazily built identity -> envelope key index of the `typescript` map (first
   * match wins, mirroring the historical scan). `undefined` until the first
   * project-relative key miss.
   */
  outputIndex?: Map<string, string>;

  /**
   * Lazily built identity -> `dependencies` entries index (first match wins,
   * mirroring the historical scan). `undefined` until the first key miss.
   */
  dependencyIndex?: Map<string, unknown>;

  /** Per lexical delivered-module spelling memo of its final watch-input list. */
  readonly watchInputs: Map<string, string[]>;

  /**
   * Lazily built project-walk keys of the envelope's declared inputs, and
   * whether that build already ran. A graph-free envelope declares no input
   * set, so `undefined` after a completed build means "compare the whole walk";
   * see `sameHashes`.
   */
  declaredInputKeys?: Set<string>;

  /**
   * Whether {@link declaredInputKeys} was already derived, since `undefined` is
   * also a valid result.
   */
  declaredInputKeysBuilt?: boolean;
}
