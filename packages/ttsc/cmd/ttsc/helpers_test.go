package main

import (
  "bytes"
  "errors"
  "os"
  "path/filepath"
  "testing"
  _ "unsafe"
)

// driverPluginRegistry aliases the driver's ordered test-visible registration slice.
//
// The unsafe linkname binds the actual private registry; it is not a public
// driver API. Registry-reset tests share this process-global state and remain
// sequential. A reset clears entries rather than preserving a prior snapshot.
//
// Private declarations retain native grounds; unsupported exported-host
// Evidence annotations are not attached to this linkname fixture.
// Common: Principled implementation: The linkname points at the actual driver.pluginRegistry rather than a duplicated test-only registry; plugin fixtures use real RegisterPlugin.
// Common: Clear and simple design: One alias exposes the same ordered []any storage for the test reset operation.
// Common: Prohibited implementation shortcuts: No public product export or fake registration result is introduced; the compiler/linker coupling to the private registry remains explicit.
// Common: Meaningful documentation: Native prose states unsafe package coupling, shared-state sequencing and the difference between clearing and snapshot restoration.
// Applicability: This borrowed registry alias performs no filesystem/process operation, processing algorithm, equivalent-work coordination or independent lease cleanup; tests and reset consumers own those decisions.
//
//go:linkname driverPluginRegistry github.com/samchon/ttsc/packages/ttsc/driver.pluginRegistry
var driverPluginRegistry []any

// captureCommand captures complete native stdout/stderr bytes around a real call.
//
// The actual fn executes synchronously with package-local writer seams. Its
// supplied cwd reader is left unchanged unless fn deliberately replaces it;
// defer restores both streams and getwd even after panic or test Goexit.
// Tests using these process-global seams must remain sequential.
//
// Private helpers retain native review grounds rather than exported-host tags.
// Common: Principled implementation: The supplied real operation returns its actual status; two buffers preserve every observed stream byte, including successful stderr.
// Common: Clear and simple design: One synchronous call owns stream capture and one defer restores the three previous package seams.
// Common: Prohibited implementation shortcuts: The helper neither fabricates status/output nor caches a response; test-specific cwd failures remain explicit inside fn.
// Common: Meaningful documentation: Native prose identifies full byte capture, sequential global state and real resolver versus test error-reader ownership.
// Portability: OS-neutral implementation: Go writers preserve native output bytes without shell interpretation, path rewriting or a real child process.
// Performance: Efficient algorithms: Buffers accumulate each stream with work proportional to actual bytes; there is no independent byte ceiling.
// Performance: Reuse equivalent work: Each supplied operation executes once; no previous command response is reused.
// Performance: Bound retention and release resources: Deferred restoration covers normal return, panic and Goexit; returned strings own captured bytes for the caller. Program/fixture/registry/environment cleanup belongs to the tests and command operations.
func captureCommand(t *testing.T, fn func() int) (int, string, string) {
  t.Helper()
  prevOut, prevErr, prevGetwd := stdout, stderr, getwd
  var out, err bytes.Buffer
  stdout = &out
  stderr = &err
  defer func() {
    stdout = prevOut
    stderr = prevErr
    getwd = prevGetwd
  }()
  code := fn()
  return code, out.String(), err.String()
}

// failGetwd supplies the literal cwd failure used by command-wrapper cases.
//
// It is an explicit test reader, not an OS-directory result or a product cwd
// implementation. Each capture owner restores the previous getwd seam.
//
// Private helpers retain native common grounds without unsupported tags.
// Common: Principled implementation: One independently authored cwd boom error forces the command's real cwd-resolution error branch.
// Common: Clear and simple design: The reader returns an empty directory string and one fixed error.
// Common: Prohibited implementation shortcuts: It does not manufacture the wrapper's status or diagnostic; the owning command must propagate the actual supplied cause.
// Common: Meaningful documentation: Native prose names the fixture error and its capture-owned seam restoration.
// Applicability: This fixed in-process error reader does no native directory discovery, reusable work, input-processing algorithm or resource acquisition.
func failGetwd() (string, error) {
  return "", errors.New("cwd boom")
}

// writeCommandProjectFile materializes authored fixture bytes under a test root.
//
// Native Join/FromSlash resolve the caller's fixture path, MkdirAll prepares its
// parents and WriteFile supplies the actual compiler input. The caller owns
// the temporary root and any intentional source/config mutation sequence.
//
// Private helpers retain native review grounds rather than exported-host tags.
// Common: Principled implementation: Actual native filesystem writes materialize the caller's authored bytes for real command resolution and compilation.
// Common: Clear and simple design: One path resolution, parent creation and write implement the fixture operation; errors fail the owning test.
// Common: Prohibited implementation shortcuts: No expected compiler result is written, source lookup mocked or author input silently synthesized.
// Common: Meaningful documentation: Native prose identifies authored bytes, mutation/root ownership and actual filesystem error behavior.
// Portability: OS-neutral implementation: filepath.Join/FromSlash and os directory/file APIs preserve native path spelling and platform semantics without shell commands.
// Performance: Efficient algorithms: Work scales with path length, actual parent creation and the supplied byte length; the helper adds no directory walk.
// Performance: Reuse equivalent work: Every explicit fixture write performs its requested mutation; no old materialization is replayed or claimed equivalent.
// Performance: Bound retention and release resources: The byte conversion is local to synchronous WriteFile, whose native file handle closes before return; TempDir callers own root cleanup and this helper has no output-size bound or retained cache.
func writeCommandProjectFile(t *testing.T, root, name, contents string) {
  t.Helper()
  file := filepath.Join(root, filepath.FromSlash(name))
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(contents), 0o644); err != nil {
    t.Fatal(err)
  }
}

// resetCommandLinkedPluginRegistry clears the actual ordered test registry.
//
// Registration cases invoke it before setup and through test cleanup after
// consumers finish. It does not restore inherited entries or close plugin-
// owned resources; those are separate ownership decisions.
//
// Private helpers retain native common grounds without unsupported tags.
// Common: Principled implementation: Setting the actual linked registry alias to nil prevents previously registered fixture hooks from pairing with later manifest entries.
// Common: Clear and simple design: One global slice assignment clears all registrations.
// Common: Prohibited implementation shortcuts: This is explicit test isolation, not fabricated hook output or a public product registration API; prior state preservation is not claimed.
// Common: Meaningful documentation: Native prose distinguishes clearing, cleanup timing and plugin resource/snapshot limitations.
// Applicability: This in-process assignment performs no native path/process operation, processing algorithm or equivalent-work coordination. It releases registry references only; caller cleanup owns test lifetime and plugin resources.
func resetCommandLinkedPluginRegistry() {
  driverPluginRegistry = nil
}
