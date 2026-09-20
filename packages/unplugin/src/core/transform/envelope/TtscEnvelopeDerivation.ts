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
