import typia from "typia";
import { ITtscGraphSnapshot } from "../structures/ITtscGraphSnapshot";

/**
 * The serve protocol version this client speaks.
 *
 * Keep it equal to `serveProtocolVersion` in
 * `packages/ttsc/cmd/ttscgraph/serve.go`. The two are hand-synchronized.
 */
const PROTOCOL_VERSION = 1;

/**
 * Decode the graph serve envelope before any state or body facts are consumed.
 *
 * @evidence contracts/common.md#principled-implementation JSON framing, protocol agreement and generated complete-envelope validation precede typed state admission.
 * @evidence contracts/common.md#clear-and-simple-design The decoder owns the wire contract; state owns correlation and generation semantics after this boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The installed typia transform validates the declared envelope rather than a partial cast or handwritten schema replacement.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain why protocol agreement must precede shape validation and why routing fields belong in the envelope.
 * @evidenceExclude contracts/performance.md#efficient-algorithms decode owns JSON and generated envelope validation; the namespace adds no processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work decode validates each submitted line, while state establishes reuse of graph generations.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no decoded frame or native handle; its caller owns typed results.
 */
export namespace TtscGraphProtocol {
  /**
   * Decode one line or throw the owned framing/version/schema diagnostic.
   *
   * @evidence contracts/common.md#principled-implementation JSON parsing precedes protocol agreement and generated complete-envelope validation, so no field is routed before its declared wire contract holds.
   * @evidence contracts/common.md#clear-and-simple-design This single decoder supplies typed inputs to state; state owns pending correlation, schema body agreement and generation semantics.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Installed typia validates the whole declared envelope rather than a handwritten partial guard or a fabricated trusted frame.
   * @evidence contracts/common.md#meaningful-documentation The headline states owned failure behavior; private comments explain version-before-shape and routing-field validation.
   * @evidence contracts/performance.md#efficient-algorithms JSON parsing and generated field traversal process the line and carried graph facts linearly; no project, directory or historical-frame scan occurs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each submitted wire line requires validation; graph state alone coordinates current-model reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Parsed values and error text are local; the typed result transfers to state and no native reader, child or frame history is retained.
   */
  export function decode(line: string): ITtscGraphSnapshot {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(
          `@ttsc/graph: native session returned invalid JSON: ${asError(error).message}`,
      );
    }

    // Read the version before the shape, because a server speaking another
    // version is entitled to a different shape. Asserting first would report
    // that mismatch as a field complaint — "expected string at $input.mode" —
    // about a contract the other side never agreed to, which is the misparse
    // this field exists to prevent. Ask what protocol it is first, then hold it
    // to that protocol.
    const version: number | undefined = typia.is<{ protocolVersion: number }>(
      parsed,
    )
      ? parsed.protocolVersion
      : undefined;
    if (version !== PROTOCOL_VERSION) {
      // Session-wide: a version mismatch is not one bad frame, it is the wrong
      // binary, and every request against it is equally doomed.
      throw new Error(
          `@ttsc/graph: ttscgraph speaks serve protocol ${
            version === undefined ? "an unknown version" : `v${String(version)}`
          }, this client speaks v${String(PROTOCOL_VERSION)}. ` +
            "Install a matching `ttsc` (the binary resolves from the target " +
            "project, or from TTSC_GRAPH_BINARY).",
      );
    }

    let response: ITtscGraphSnapshot;
    try {
      // Validate the envelope, not just the dump it carries. The dump was
      // typia-asserted while the envelope around it was a bare cast, so the
      // fields the client actually branches on — the mode, and the id that
      // routes the frame — were the unchecked ones. Anything added to the
      // envelope belongs on this side of that line.
      response = typia.assert<ITtscGraphSnapshot>(parsed);
    } catch (error) {
      throw new Error(
          `@ttsc/graph: native session returned an unreadable response: ${asError(error).message}`,
      );
    }
    return response;
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
