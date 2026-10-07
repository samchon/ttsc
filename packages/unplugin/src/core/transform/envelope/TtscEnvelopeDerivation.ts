import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { TtscProjectSpellings } from "../filesystem/TtscProjectSpellings";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";

/**
 * Per-envelope derivation state: every index the per-delivery paths need, built
 * at most once and shared by all deliveries of one compiler result.
 *
 * Index builders share parsed producer records and native path identities
 * across consumers. Cold identity queries can require realpath, ancestor and
 * case observations; a completed watch list avoids another closure traversal
 * without eliminating every path query performed before its lookup.
 *
 * Every optional index is lazy. Graph indexes also serve external input
 * capture, validation and tracker scopes, so their construction does not depend
 * solely on whether a host installs a watch hook.
 *
 * Safe sharing requires one immutable envelope, fixed project/options and a
 * still-valid native identity view. Admission owns current-input proof; these
 * indexes do not independently certify freshness. The owner associates state
 * weakly with the envelope, but a caller retaining state or returned arrays can
 * extend their storage lifetime.
 *
 * @evidence contracts/common.md#principled-implementation Optional indexes distinguish unbuilt state from completed results, and declaredInputKeysBuilt separately represents a completed undefined result; shared physical identities and lexical watch keys preserve their different equivalence relations.
 * @evidence contracts/common.md#clear-and-simple-design One generation state groups lazy indexes and memo tables behind envelopeDerivation rather than requiring every delivery to maintain an independent cache.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts First-match key indexes preserve the supported producer lookup precedence, and the built flag represents a genuine optional outcome rather than manufacturing an empty declared input set.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain generation ownership, laziness, freshness and costs; each optional member documents its unbuilt meaning and the built flag's distinct role with documentation-skill spacing.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This interface represents memo tables but acquires or releases none. envelopeDerivation and the populating selectors own their allocation, growth, transfer and lifetime; the shape supplies no capacity or release guarantee.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This interface declares identity, index and completion-state fields rather than executing their builders or lookup strategy. The concrete builders and selectors own those computations and their costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This shape records optional completion states and lexical/physical key domains. It does not decide when a request may share their values; actual association and selector owners establish immutable generation and native-view validity premises.
 * @evidence contracts/portability.md#os-neutral-implementation A FilesystemPathIdentityContext owns physical identity and native case semantics; explicit physical and lexical root spellings avoid hardcoded separator or OS-based case rules in the state representation.
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
   * graph-index consumer, including watch derivation, external capture,
   * validation or tracker scope selection.
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
