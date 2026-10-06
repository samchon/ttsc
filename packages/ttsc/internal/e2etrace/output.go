package e2etrace

import (
	"crypto/sha256"
	"fmt"
	"os"
)

// Output preserves the caller's already captured stdout/stderr under the same
// actual Cmd invocation. It does not consume streams, reread files, or run a
// child. Truncation stays explicit; an observer failure leaves missing evidence
// and never changes the original command result.
//
// @evidence contracts/common.md#principled-implementation The Cmd owner supplies its retained output buffers after the actual Run result; the same invocation, PID, argv and raw byte digests connect those buffers to the observed operation without inferring a new process or certifying uncaptured bytes.
// @evidence contracts/common.md#clear-and-simple-design Two bounded payload records use the existing artifact writer; one output event retains their identities and each buffer's truncation flag beside the original command token.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Neither output is replaced by a parsed reply or expected value. Missing capture, writer failure and truncation remain distinct from complete raw output, and the caller's result is untouched.
// @evidence contracts/common.md#meaningful-documentation The prose states actual caller-buffer ownership, same-invocation association, disabled behavior and limits rather than claiming child or descendant settlement.
// @evidence contracts/portability.md#os-neutral-implementation Native Cmd PID/argv/cwd and uninterpreted bytes pass through the existing sink; platform newline and signal differences are retained rather than normalized into a successful result.
// @evidence contracts/performance.md#efficient-algorithms Disabled capture performs no file IO or byte hashing. Enabled capture hashes and writes each supplied buffer once under the existing 64MiB-per-payload limit, then encodes argv and fixed metadata. No stream or project is reread.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each actual command owns distinct output; equal bytes from another command do not establish this invocation's result.
// @evidence contracts/performance.md#bound-retention-and-release-resources Payload files are exclusively created and closed by the existing 256MiB-budgeted writer. This method acquires no process or stream handle and retains no caller buffer after return; saved payloads transfer to the coordinator. Failure can leave partial evidence and does not claim automatic reclamation.
func (observation *Command) Output(stdout, stderr []byte, stdoutTruncated, stderrTruncated bool) {
	defer func() { _ = recover() }()
	if observation == nil || os.Getenv("TTSC_E2E_TRACE") == "" {
		return
	}
	data := map[string]any{"stdoutTruncated": stdoutTruncated, "stderrTruncated": stderrTruncated}
	pid := 0
	if observation.cmd.Process != nil {
		pid = observation.cmd.Process.Pid
	}
	for _, stream := range []struct {
		name string
		body []byte
	}{{"stdout", stdout}, {"stderr", stderr}} {
		raw, err := writeArtifactPayload(observation.invocation, stream.name, stream.body)
		if err != nil {
			data["outcome"] = "capture-failed"
			data["error"] = err.Error()
			writeEvent("integrity-failure", observation.invocation, pid, observation.cmd.Args, observation.cmd.Dir, data)
			return
		}
		data[stream.name] = map[string]any{"raw": raw, "sha256": fmt.Sprintf("%x", sha256.Sum256(stream.body))}
	}
	data["outcome"] = "complete"
	if stdoutTruncated || stderrTruncated {
		data["outcome"] = "truncated"
	}
	writeEvent("process-output", observation.invocation, pid, observation.cmd.Args, observation.cmd.Dir, data)
}
