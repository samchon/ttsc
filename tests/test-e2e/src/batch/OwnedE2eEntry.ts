import type { SpawnSyncOptions } from "node:child_process";

import { OwnedNativeProcess } from "../../../../packages/ttsc/lib/internal/OwnedNativeProcess";

/** The ordinary suite and transport controls share the native process owner. */
export namespace OwnedE2eEntry {
  /**
   * Join one Node entry and its descendants before releasing caller inputs.
   *
   * The entry inherits Node flags unless its owner supplies an explicit vector.
   * Flags and environment retain Node's semantics in the selected child cwd;
   * a relocated builtin-only control must own its compatible startup context.
   * Target input is closed; resident command pipes belong to the contained suite.
   * Cancellation rejects only after the native owner adjudicates retirement.
   *
   * @evidence contracts/testing.md#behavioral-verification The ordinary index and real carrier controls invoke the existing native owner with exact Node entry arguments and retain its status, streams and retirement classification.
   * @evidence contracts/testing.md#independent-expectations Static targets report their actual Node flags, argv/context and literal output; the native empty-boundary receipt, rather than process absence, supplies closure authority.
   * @evidence contracts/testing.md#distinguishing-cases Same-cwd default inheritance and explicitly selected flags in a different cwd retain success, nonzero status, pre-admission abort and cancellation with a live descendant as distinct actual outcomes.
   * @evidence contracts/testing.md#execution-ownership This test-only carrier starts real Node entries through the already-built platform helper; no compiler, installer or producer is added.
   * @evidence contracts/e2e.md#necessary-boundary The native helper must contain the actual Node process tree, which a portable callback unit cannot establish.
   * @evidence contracts/e2e.md#shared-execution One ordinary entry dispatches the existing selected batches and memoized preparation once; controls use a builtin-only target rather than repeating that preparation.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The existing native operation owns protocol storage, cancellation and original joins. Unknown retirement remains an error with retained native storage; target failure does not imply unknown closure.
   * @evidence contracts/e2e.md#preserved-coverage Default-inherited or explicitly supplied Node flags, selection arguments and standard output descriptors pass through unchanged. No option parser or environment filtering substitutes for Node's resolution; existing batch assertions remain in the contained main entry.
   */
  export async function run(props: {
    entry: string;
    args: readonly string[];
    /** Node arguments, inherited by default and interpreted in the child cwd. */
    execArgv?: readonly string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    signal?: AbortSignal;
    /** Standard output descriptors, inherited for the ordinary entry. */
    output?: "inherit" | "pipe";
    /** The native owner reports actual retirement even on rejected execution. */
    observeRetirement?: (
      state: "joined" | "not-started" | "unknown",
      reason?: string,
    ) => void;
  }) {
    return OwnedNativeProcess.run(
      process.execPath,
      [...(props.execArgv ?? process.execArgv), props.entry, ...props.args],
      {
        cwd: props.cwd ?? process.cwd(),
        env: props.env ?? process.env,
        stdio: ["ignore", props.output ?? "inherit", props.output ?? "inherit"],
        encoding: "utf8",
      } satisfies SpawnSyncOptions,
      props.signal,
      props.observeRetirement,
    );
  }
}
