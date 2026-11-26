package diagnosticcompletion

import (
  "crypto/sha256"
  "encoding/hex"
  "fmt"
  "io"
  "os"
)

// Request binds a launcher token to one native invocation's arguments and
// compiler environment. Its zero value leaves reporting unacknowledged.
//
// @evidence contracts/common.md#principled-implementation The private token and digest identify one launcher request without carrying source or diagnostic data.
// @evidence contracts/common.md#clear-and-simple-design A value follows the reporting invocation and is cleared by assigning the zero value.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The request alone proves no diagnostic work; acknowledgement requires Report to deliver the batch.
// @evidence contracts/common.md#meaningful-documentation The comment identifies the invocation and zero-value behavior.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The value stores strings only; Capture and Report own process and stream operations.
// @evidenceExclude contracts/performance.md#efficient-algorithms This record performs no work; Capture and Report own its construction and use.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The value belongs to one command; it retains no reusable Program or diagnostic batch.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The value carries no open resource, output buffer or task.
type Request struct {
  token   string
  command string
}

// Capture reads the private request before the host loads its Program. The
// digest covers the dispatched command, every argument and each fixed
// compiler channel in wire order, with a NUL delimiter after every value.
//
// @evidence contracts/common.md#principled-implementation The launcher and Go hosts hash the same ordered native argv and compiler channels with unambiguous NUL framing.
// @evidence contracts/common.md#clear-and-simple-design Capture owns invocation identity, while Report owns delivery and the calling host owns the complete diagnostic batch.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A missing token does no digest work. A receipt never exposes argument or environment values.
// @evidence contracts/common.md#meaningful-documentation The comment identifies when to capture the request and which native inputs it covers.
// @evidence contracts/portability.md#os-neutral-implementation Arguments and process environment values already crossed the platform's native invocation boundary; there is no shell or path reinterpretation.
// @evidence contracts/performance.md#efficient-algorithms One incremental hash reads each argument and compiler channel once. Without a token Capture returns before allocating a hash.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each request belongs to one invocation with its own token and compiler channels.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Capture returns only the token and digest and acquires no external resource.
func Capture(command string, args []string) Request {
  token := os.Getenv("TTSC_DIAGNOSTICS_COMPLETION_TOKEN")
  if token == "" {
    return Request{}
  }
  hash := sha256.New()
  add := func(value string) {
    _, _ = io.WriteString(hash, value)
    _, _ = hash.Write([]byte{0})
  }
  add(command)
  for _, arg := range args {
    add(arg)
  }
  for _, name := range []string{
    "TTSC_TSGO_ARGS",
    "TTSC_TSGO_ARGS_CWD",
    "TTSC_SEMANTIC_CONFIG_PATH",
    "TTSC_PLUGIN_CONFIG_DIR",
    "TTSC_COMPILATION_SNAPSHOT",
    "TTSC_LINKED_PLUGINS_JSON",
  } {
    add(os.Getenv(name))
  }
  return Request{token: token, command: hex.EncodeToString(hash.Sum(nil))}
}

// Report streams a loaded Program's complete diagnostic batch, including an
// empty batch, to stderr. It acknowledges delivery only if each write succeeds
// in full. The zero Request streams directly to the caller's writer.
//
// @evidence contracts/common.md#principled-implementation The real renderer writes once through the tracked stderr stream before a PID- and command-bound receipt may follow.
// @evidence contracts/common.md#clear-and-simple-design The host decides whether it has a complete Program batch. Report owns only streaming and receipt delivery.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Failed and short writes withhold the receipt. No extra Program, diagnosis, temporary file or synthetic diagnostic is created.
// @evidence contracts/common.md#meaningful-documentation The comment describes empty batches, complete writes and unrequested behavior.
// @evidence contracts/portability.md#os-neutral-implementation Report writes UTF-8 text and structured metadata to the supplied stream without platform path or shell handling.
// @evidence contracts/performance.md#efficient-algorithms Renderer output is streamed once with constant tracking state and no retained copy of diagnostic text.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Every report records one invocation's own delivery; the caller can use its receipt to skip equivalent work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call retains no writer or batch after return and never closes caller-owned stderr.
func (r Request) Report(stderr io.Writer, render func(io.Writer)) {
  if r.token == "" {
    render(stderr)
    return
  }
  report := reportWriter{target: stderr}
  render(&report)
  if !report.failed {
    fmt.Fprintf(stderr, "\n%s {\"pid\":%d,\"command\":%q}\n", r.token, os.Getpid(), r.command)
  }
}

// reportWriter leaves the renderer's original transfer outcomes intact and
// remembers any failed or incomplete transfer.
type reportWriter struct {
  target io.Writer
  failed bool
}

func (w *reportWriter) Write(data []byte) (int, error) {
  count, err := w.target.Write(data)
  if err != nil || count != len(data) {
    w.failed = true
  }
  return count, err
}
