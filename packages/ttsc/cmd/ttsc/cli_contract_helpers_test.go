package main

import (
  "bytes"
  "os"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// cliContractDiagnostic decodes the diagnostic wire fields observed by these
// units. Expectations remain literal keys and syntax in each test body.
//
// Private wire decoders retain native common grounds rather than unsupported
// exported-host Evidence annotations. These data carriers do not choose a
// processing algorithm, coordinate reusable work, own a lease lifecycle or
// access a native filesystem/process; their consumers own those decisions.
// Common: Principled implementation: Independently decodes the category and messageText wire fields; these fields permit literal diagnostic assertions without importing the production DTO.
// Common: Clear and simple design: Two string fields retain the observed JSON spellings; unknown envelope fields remain outside this focused test decoder.
// Common: Prohibited implementation shortcuts: The category assertion owns its literal error expectation; this representation neither manufactures diagnostics nor defines the product schema.
// Common: Meaningful documentation: Purpose and focused field coverage are stated; this decoder does not imply full diagnostic-envelope verification.
type cliContractDiagnostic struct {
  Category    string `json:"category"`
  MessageText string `json:"messageText"`
}

// cliContractCompileResult decodes diagnostics and emitted output text.
//
// Private wire decoders retain native common grounds rather than unsupported
// exported-host Evidence annotations. These data carriers do not choose a
// processing algorithm, coordinate reusable work, own a lease lifecycle or
// access a native filesystem/process; their consumers own those decisions.
// Common: Principled implementation: Independently decodes the optional diagnostic array and output text map so actual response JSON remains separate from literal key/export-syntax expectations.
// Common: Clear and simple design: The diagnostic slice and output map expose the two independently asserted envelope sections directly.
// Common: Prohibited implementation shortcuts: The decoder stores actual JSON data only; it contains no expected output, compiler cache or fake emitted-file producer.
// Common: Meaningful documentation: Native prose identifies optional diagnostics and the focused output observation; extra provenance fields remain outside this decoder.
type cliContractCompileResult struct {
  Diagnostics []cliContractDiagnostic `json:"diagnostics,omitempty"`
  Output      map[string]string       `json:"output"`
}

// cliContractTransformResult decodes diagnostics and source text.
//
// Private wire decoders retain native common grounds rather than unsupported
// exported-host Evidence annotations. These data carriers do not choose a
// processing algorithm, coordinate reusable work, own a lease lifecycle or
// access a native filesystem/process; their consumers own those decisions.
// Common: Principled implementation: Independently decodes optional diagnostics and TypeScript text keyed by the wire protocol, preserving the source-versus-emission distinction.
// Common: Clear and simple design: A diagnostic slice and source text map represent the original response assertions without the production envelope type.
// Common: Prohibited implementation shortcuts: Source declarations are asserted against literal authored syntax rather than copied from the implementation or fabricated by this decoder.
// Common: Meaningful documentation: Native prose identifies source text and optional diagnostics; graph/host-observation coverage belongs to separate response observers.
type cliContractTransformResult struct {
  Diagnostics []cliContractDiagnostic `json:"diagnostics,omitempty"`
  TypeScript  map[string]string       `json:"typescript"`
}

// runCLIContractCommand calls the actual owning dispatcher synchronously.
// Its package-local stream seams capture full stdout/stderr bytes and restore
// the prior writers and cwd resolver even if dispatch panics. The resolver is
// the real os.Getwd, and fixture-only dispatch has no linked-plugin manifest.
// Tests using these process-wide seams must remain sequential.
//
// Go Evidence addresses exported declarations only; these private review
// grounds apply to this helper and its direct dispatcher callees.
// Common: Principled implementation: run receives the original argv and executes its actual build/API/help/version/alias/error branches; status is returned by the owning operation, never synthesized from a mock.
// Common: Clear and simple design: One synchronous call owns two stream buffers and a deferred restoration of stdout, stderr and getwd.
// Common: Prohibited implementation shortcuts: No process is disguised as a unit, public API invented, diagnostic replaced, producer skipped or expected result derived from actual output.
// Common: Meaningful documentation: Native prose distinguishes owning-private dispatch, real cwd resolution, sequential global seams and full byte capture from OS transport.
// Portability: OS-neutral implementation: Go writers preserve output bytes; os.Getwd and native fixture paths supply real current-directory semantics without a shell.
// Performance: Efficient algorithms: Each stream is accumulated once with work proportional to its observed bytes; there is no independent buffer size cap.
// Performance: Reuse equivalent work: This helper executes each supplied full dispatcher invocation once without replay. Separate aggregate closures explicitly own borrowed operations and shared generations; they do not present a cached status as an invocation.
// Performance: Bound retention and release resources: Returned stream strings own each invocation's bytes, previous package seams are restored by defer, and t.Setenv restores the manifest after the test. No subprocess or independent command timeout exists here.
func runCLIContractCommand(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  t.Setenv(driver.LinkedPluginsEnv, "")
  previousOut, previousErr, previousGetwd := stdout, stderr, getwd
  var out, errOut bytes.Buffer
  stdout, stderr, getwd = &out, &errOut, os.Getwd
  defer func() { stdout, stderr, getwd = previousOut, previousErr, previousGetwd }()
  code := run(args)
  return code, out.String(), errOut.String()
}
