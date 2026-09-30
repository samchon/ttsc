package linthost

import (
  "os"
  "testing"
)

// TestLSPApplySuggestionResolvesLogicalProjectLink verifies suggestion
// discovery and execution use the same physical project boundary while the
// returned WorkspaceEdit keeps the editor's logical document URI.
//
// NativePluginSource runs the lint sidecar from PhysicalProjectRoot but keeps
// the logical URI supplied by an editor that opened a symlink or junction.
// Code-action discovery and execution must resolve both paths consistently
// without rejecting the action, reading a different file, or relaxing the
// outside-project and node_modules guards.
//
//  1. Expose one physical project through a logical directory link.
//  2. Discover and execute a manual suggestion for the logical URI.
//  3. Assert the edit is keyed by that URI and leaves the physical file alone.
//  4. Reuse the signed selection with outside and node_modules URIs and assert
//     both command boundaries still fail closed.
// @evidence contracts/testing.md#behavioral-verification Suggestion discovery and execution must return the authored rewrite under the logical URI, leave the physical source intact and reject outside/dependency URIs.
// @evidence contracts/testing.md#independent-expectations The literal rewritten switch and original disk bytes are independent answer keys; the editor URI is supplied by the fixture rather than derived from the resolved path.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Expose one physical project through a logical directory link. The asserted decision is: Reuse the signed selection with outside and node_modules URIs and assert both command boundaries still fail closed. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestLSPApplySuggestionResolvesLogicalProjectLink owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestLSPApplySuggestionResolvesLogicalProjectLink(t *testing.T) {
  assertLSPLogicalProjectLink(t, func(t *testing.T, target string, link string) {
    t.Helper()
    if err := os.Symlink(target, link); err != nil {
      t.Fatalf("directory symlink unavailable: %v", err)
    }
  })
}
