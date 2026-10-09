package e2etrace

import "os"

// CompletionHintsPublication records one producer's actual asynchronous hint
// outcome after native execution, decoding and any successful corpus store.
// A successful empty publication is distinct from a pending or failed fetch.
// This private opt-in observation changes no LSP reply, optional-verb logging
// policy, corpus retention or producer execution.
//
// @evidence contracts/common.md#principled-implementation The native source emits after the actual producer result and publication decision; generation and producer label identify that result independently of editor diagnostics or trigger advertisement.
// @evidence contracts/common.md#clear-and-simple-design One terminal event uses the existing private sink and scalar result fields without adding a product protocol or retained publication state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The existing opt-in observation boundary records the real operation, including failed and successful-empty outcomes, without substituting completion items or changing old-plugin silence and last-good retention.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain terminal timing, empty-state meaning and observation-only effects with separated acknowledgment prose.
// @evidence contracts/portability.md#os-neutral-implementation The source supplies its native cwd and producer label; the existing sink uses native absolute paths and process identity without inferring case policy.
// @evidence contracts/performance.md#efficient-algorithms Disabled observation performs no filesystem work. Enabled emission encodes the supplied cwd, producer and error text once; it neither copies hints nor reads a project or stream.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each event records one actual producer generation; it does not coordinate or reuse discovery work.
// @evidence contracts/performance.md#bound-retention-and-release-resources The existing budgeted synchronous sink opens and closes its own append file. This operation acquires no process or background task, retains no error or corpus after return and transfers saved evidence to the coordinator.
func CompletionHintsPublication(cwd, producer string, generation uint64, outcome string, hints int, err error) {
  defer func() { _ = recover() }()
  invocation := nextInvocation()
  if invocation == "" {
    return
  }
  data := map[string]any{
    "producer": producer,
    "generation": generation,
    "outcome": outcome,
    "hints": hints,
  }
  if err != nil {
    data["error"] = err.Error()
  }
  writeEvent("lsp-hints-publication", invocation, os.Getpid(), os.Args, cwd, data)
}
