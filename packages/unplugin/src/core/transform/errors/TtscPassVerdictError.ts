import { formatUnknownError } from "../diagnostics/formatUnknownError";
import { TtscTerminalGenerationError } from "./TtscTerminalGenerationError";

/**
 * A compile this pass already attempted, whose envelope failed outright.
 *
 * Native project diagnostics carry a structured failure envelope; setup and
 * host failures can still arrive as opaque exceptions. Both settle the current
 * attempt, so the adapter uses the delivery boundary it owns rather than
 * guessing retryability from a diagnostic message. Inside a pass the answer is
 * already settled, so every later module replays it instead of repeating a
 * whole-project transform to reach the same verdict, which is what made a
 * single broken save cost one compile per delivered module
 * (samchon/ttsc#1303).
 *
 * The scope is exactly the pass. A host whose `buildStart` repeats drops the
 * verdict at its next rebuild, so a transient host failure costs that one
 * rebuild. A host with no pass boundary never retains one at all and keeps
 * retrying on its very next delivery. Between them sits a host that opens
 * exactly one pass for its whole process — Bun's runtime plugin, and a Vite dev
 * server configured with `server.watch: null` — where the verdict lasts the
 * session. That follows from what those hosts already publish about themselves,
 * that their session is one immutable load session and the remedy for changed
 * inputs is to restart, and it is the deliberate trade: without it, one type
 * error costs such a session a whole-project compile per delivered module,
 * which is the workload samchon/ttsc#970 is about.
 *
 * It carries the original error's message, stack and `cause` rather than
 * replacing them, so what a bundler reports is what it reported before the
 * verdict existed.
 *
 * @evidence contracts/common.md#principled-implementation The epoch records the pass that authorizes replay, while Error cause and the original stack preserve the actual failure; outside that pass callers must attempt again.
 * @evidence contracts/common.md#clear-and-simple-design The subclass adds one replay boundary and delegates terminal-error identity instead of duplicating cached compile state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Retry scope comes from the host's explicit epoch, not guessed message severity or synthetic output hiding an adapter failure.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain pass-boundary, immutable-session and host-without-pass behavior, and the field comment names the complete replay scope.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   An error class that carries a message and fields only; it touches no
 *   filesystem, path or process.
 * @evidence contracts/performance.md#efficient-algorithms
 *   An Error contributes its message and stack directly. Another thrown value
 *   delegates one text conversion and CSI scan to formatUnknownError; that
 *   work follows the produced text length and any user-defined conversion.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Computes nothing that could be reused.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Retains only the message, cause and fields given to the constructor,
 *   released with the error.
 */
export class TtscPassVerdictError extends TtscTerminalGenerationError {
  /** The delivery pass this verdict belongs to, and its whole scope. */
  public readonly epoch: number;

  public constructor(original: unknown, epoch: number) {
    super(
      original instanceof Error
        ? original.message
        : formatUnknownError(original),
      { cause: original },
    );
    if (original instanceof Error) {
      this.name = original.name;
      if (original.stack !== undefined) this.stack = original.stack;
    } else {
      this.name = "TtscPassVerdictError";
    }
    this.epoch = epoch;
  }
}
