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
