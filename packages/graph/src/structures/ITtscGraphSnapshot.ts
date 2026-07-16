import { ITtscGraphDump } from "./ITtscGraphDump";

/**
 * One response frame of the `ttscgraph serve` protocol.
 *
 * This is the envelope around a snapshot, mirrored by hand from `serveResponse`
 * in `packages/ttsc/cmd/ttscgraph/serve.go`. There is no generator between the
 * Go struct and this interface, so the two drift silently unless something
 * checks them; `TtscGraphSession` validates every frame against this shape
 * rather than casting it, so a drift surfaces as a precise error on the first
 * frame instead of an `undefined` several layers downstream.
 */
export interface ITtscGraphSnapshot {
  /** Echoes the request's id, so a response finds its caller. */
  id: number;

  /**
   * The protocol version the server speaks.
   *
   * It rides every frame rather than a handshake. The binary and this package
   * version independently — the session runs whichever `ttscgraph` the target
   * project installed, or whatever `TTSC_GRAPH_BINARY` points at — so a
   * mismatched pair is reachable, and before this field nothing detected it: the
   * first symptom was a misparsed dump or a silently absent value.
   */
  protocolVersion: number;

  /**
   * What the producer did to answer this request.
   *
   * Required, and never absent — including on the error path, where it is
   * `"error"`. A consumer can report `rebuild` versus `incremental` honestly
   * because the compiler said so; no generation counter can distinguish a reuse
   * from a full rebuild after the fact.
   */
  mode: ITtscGraphSnapshot.Mode;

  /** What this server can prove about the snapshots it publishes. */
  capabilities: string[];

  /** Whether the graph moved since the last snapshot. */
  changed: boolean;

  /** The snapshot, present exactly when `changed` is true. */
  dump?: ITtscGraphDump;

  /** Set when the request produced no snapshot; `mode` is then `"error"`. */
  error?: string;
}

export namespace ITtscGraphSnapshot {
  /**
   * The computation modes the producer reports, plus the transport's `error`.
   *
   * - `initial`: the session's first snapshot.
   * - `reload`: the build universe moved, so the program was reloaded whole.
   * - `unchanged`: nothing moved; no dump rides it and the last one still holds.
   * - `incremental`: edits applied onto the reused resident program.
   * - `rebuild`: edits applied, but the program could not be reused.
   * - `error`: no snapshot was produced.
   */
  export type Mode =
    | "initial"
    | "reload"
    | "unchanged"
    | "incremental"
    | "rebuild"
    | "error";
}
