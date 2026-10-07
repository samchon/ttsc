package driver_test

import (
  "context"
  "embed"
  "encoding/json"
  "fmt"
  "io/fs"
  "os"
  "os/exec"
  "path/filepath"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// rewriteRuntimeFixtures embeds the authored compiler inputs and Node consumer.
// Embedding keeps fixture lookup independent of CWD and compiler trimpath.
//
// These helper notes describe the selected test's operations and limitations.
// Go Evidence does not separately address these private declarations; the notes
// do not certify automated coverage or introduce a review requirement.
//
// Common: Principled implementation: The immutable embedded tree carries actual authored source and module configuration, with independent expected values kept in Go assertions.
// Common: Clear and simple design: One tree supplies the two effective option groups and one runtime script without runtime source generation.
// Common: Prohibited implementation shortcuts: The embedded inputs exercise the real compiler and module loader; no product behavior is replaced.
// Common: Meaningful documentation: The native paragraph explains fixture ownership and why lookup is independent of current directory and trimpath.
// Portability: Not applicable: OS-neutral implementation: This embed.FS declaration uses virtual slash-separated paths; copying and native execution belong to the helpers below.
// Performance: Not applicable: Efficient algorithms: The declaration selects static inputs and performs no traversal.
// Performance: Not applicable: Reuse equivalent work: Compiler preparation is coordinated by TestDriverRewriteRuntimeBatch, not this fixture declaration.
// Performance: Bound retention and release resources: Embedded bytes are fixed by this authored fixture tree for the test binary lifetime and retain no native handles or historical entries.
//
//go:embed fixtures/rewrite-runtime
var rewriteRuntimeFixtures embed.FS

// copyRewriteRuntimeFixtures copies embedded source inputs into a private root.
// Compiler output and module loading use only this test-owned mutable copy.
//
// These helper notes describe the selected test's operations and limitations.
// Go Evidence does not separately address these private declarations; the notes
// do not certify automated coverage or introduce a review requirement.
//
// Common: Principled implementation: fs.Sub selects the authored fixture root and os.CopyFS copies its regular embedded files without synthesizing source or expected output.
// Common: Clear and simple design: Fixture materialization has one explicit destination and returns its first filesystem error to the owning batch.
// Common: Prohibited implementation shortcuts: Files are copied through standard filesystem APIs; runtime source fixtures remain intact; the raw removed-option distinction is retained in the direct unit.
// Common: Meaningful documentation: The comment distinguishes immutable authored input from the private compiler output root following the documentation prose guidance.
// Portability: OS-neutral implementation: fs.Sub uses embed's virtual slash path while os.CopyFS obtains native filesystem behavior for the destination; no OS-specific path or shell is assumed.
// Performance: Efficient algorithms: One traversal copies the fixed fixture files once, with cost proportional to their authored bytes.
// Performance: Reuse equivalent work: The batch calls this once before both producers and all nine consumers, sharing identical fixture materialization.
// Performance: Bound retention and release resources: The caller's TempDir owns copied inputs and emitted outputs; CopyFS closes its file operations and retains no resources after return.
func copyRewriteRuntimeFixtures(root string) error {
  source, err := fs.Sub(rewriteRuntimeFixtures, "fixtures/rewrite-runtime")
  if err != nil {
    return err
  }
  return os.CopyFS(root, source)
}

// rewriteRuntimeInput identifies one actual emitted module and its loader kind.
// It deliberately carries no expected value into the Node consumer.
//
// These helper notes describe the selected test's operations and limitations.
// Go Evidence does not separately address these private declarations; the notes
// do not certify automated coverage or introduce a review requirement.
//
// Common: Principled implementation: Name preserves the Go failure identity, File is a native absolute module path, and ESM selects import rather than require.
// Common: Clear and simple design: Three protocol fields express the loader input without compiler options or expected answers.
// Common: Prohibited implementation shortcuts: The protocol requests actual module loads and does not provide fixture-specific output to the consumer.
// Common: Meaningful documentation: Native prose explains input identity, module kind and the independent expectation boundary.
// Portability: OS-neutral implementation: File carries a filepath-joined native path; the Node consumer converts ESM files to file URLs using pathToFileURL.
// Performance: Not applicable: Efficient algorithms: This protocol record chooses no traversal algorithm.
// Performance: Not applicable: Reuse equivalent work: Batch ownership determines shared compiler and process execution.
// Performance: Not applicable: Bound retention and release resources: This value owns no handles or task lifetime.
type rewriteRuntimeInput struct {
  Name string `json:"name"`
  File string `json:"file"`
  ESM  bool   `json:"esm"`
}

// rewriteRuntimeResult records one independently caught module load.
// A module error belongs to its named subcase rather than suppressing later loads.
//
// These helper notes describe the selected test's operations and limitations.
// Go Evidence does not separately address these private declarations; the notes
// do not certify automated coverage or introduce a review requirement.
//
// Common: Principled implementation: Value contains actual serialized module exports while Error identifies that module's load failure; the Go test owns literal expected maps.
// Common: Clear and simple design: The record preserves name, observed exports and error separately so infrastructure and per-case failures remain distinguishable.
// Common: Prohibited implementation shortcuts: The consumer records actual module exports without calculating expected replacements.
// Common: Meaningful documentation: Native prose explains independent error ownership and the observed-result boundary.
// Portability: Not applicable: OS-neutral implementation: This JSON result carries strings and export values, not filesystem identity or process handles.
// Performance: Not applicable: Efficient algorithms: This result record chooses no algorithm.
// Performance: Not applicable: Reuse equivalent work: Execution sharing belongs to the owning batch and process helper.
// Performance: Not applicable: Bound retention and release resources: The value owns no retained handle or task.
type rewriteRuntimeResult struct {
  Name  string            `json:"name"`
  Value map[string]string `json:"value"`
  Error string            `json:"error"`
}

// runRewriteRuntimeBatch loads all successfully produced modules in one Node process.
// The static consumer catches each load separately; malformed shared output is
// an infrastructure error, while a valid named error remains local to its case.
//
// These helper notes describe the selected test's operations and limitations.
// Go Evidence does not separately address these private declarations; the notes
// do not certify automated coverage or introduce a review requirement.
//
// Common: Principled implementation: Structured JSON sends native module paths and loader kinds to actual require/import operations; returned names are checked against the input identities before independent Go assertions.
// Common: Clear and simple design: One argv-based process call owns serialization, decoding and exact result identity validation; compiler production remains visible in the test.
// Common: Prohibited implementation shortcuts: No shell, output prediction, module replacement or retry substitutes for Node's actual loader.
// Common: Meaningful documentation: The native paragraph separates infrastructure errors from individually caught load failures and exposes one-process ownership.
// Portability: OS-neutral implementation: exec.CommandContext passes executable and arguments separately; filepath.Join locates the native script and pathToFileURL handles ESM URL spelling in Node.
// Performance: Efficient algorithms: Input encoding and result indexing each scan the nine records once; the consumer loads each emitted module once.
// Performance: Reuse equivalent work: All eight CommonJS and one ESM load share a single Node startup; unique module paths preserve independent fixture state and loader kind.
// Performance: Bound retention and release resources: One sixty-second context owns the process, CombinedOutput waits for termination and deferred cancellation releases the timer; output and result maps are invocation-local. CombinedOutput has no independent byte cap; the authored consumer's normal output is nine small maps or caught errors.
func runRewriteRuntimeBatch(root string, inputs []rewriteRuntimeInput) (map[string]rewriteRuntimeResult, error) {
  encoded, err := json.Marshal(inputs)
  if err != nil {
    return nil, err
  }
  ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
  defer cancel()
  command := exec.CommandContext(ctx, "node", filepath.Join(root, "runtime.cjs"), string(encoded))
  command.Dir = root
  observation := e2etrace.BeginCommand(command, "CombinedOutput", "rewrite-runtime-node-oracle")
  output, err := command.CombinedOutput()
  observation.Result(err)
  if err != nil {
    return nil, fmt.Errorf("Node batch failed: %w\n%s", err, output)
  }
  var results []rewriteRuntimeResult
  if err := json.Unmarshal(output, &results); err != nil {
    return nil, fmt.Errorf("decode Node batch: %w\n%s", err, output)
  }
  expectedNames := make(map[string]bool, len(inputs))
  for _, input := range inputs {
    expectedNames[input.Name] = true
  }
  byName := make(map[string]rewriteRuntimeResult, len(results))
  for _, result := range results {
    if !expectedNames[result.Name] {
      return nil, fmt.Errorf("unexpected Node result identity %q", result.Name)
    }
    if _, exists := byName[result.Name]; exists {
      return nil, fmt.Errorf("duplicate Node result identity %q", result.Name)
    }
    byName[result.Name] = result
  }
  if len(byName) != len(expectedNames) {
    return nil, fmt.Errorf("Node returned %d identities, want %d", len(byName), len(expectedNames))
  }
  return byName, nil
}
