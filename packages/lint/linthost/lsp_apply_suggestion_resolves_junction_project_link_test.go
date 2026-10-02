//go:build windows

package linthost

import (
  "os/exec"
  "testing"
)

// TestLSPApplySuggestionResolvesJunctionProjectLink verifies the logical editor
// URI survives the Windows NTFS junction boundary through suggestion discovery
// and execution.
//
// A junction can resolve to a physical cwd while the editor retains a different
// URI. The admission guards must resolve that alias without hiding outside-cwd
// or node_modules targets behind other junctions.
//
//  1. Create the project, outside-source and dependency aliases with mklink /J.
//  2. Discover and execute the authored prefer-as-const suggestion.
//  3. Require logical URI edits, unchanged physical bytes and both guard results.
//
// @evidence contracts/testing.md#behavioral-verification The shared scenario returns the literal prefer-as-const rewrite under the junction URI, preserves physical bytes, rejects the junction to an outside source with status 2 and returns null for the dependency junction.
// @evidence contracts/testing.md#independent-expectations The authored rewritten/original source strings and explicit logical URI establish edit content and identity independently of path resolution; literal error/null expectations define the two protected boundaries.
// @evidence contracts/testing.md#distinguishing-cases Project, outside-root and node_modules junctions distinguish allowed alias resolution from accidental guard bypass. The portable sibling runs the same assertions with filesystem symlinks.
// @evidence contracts/testing.md#execution-ownership This Windows-constrained Go unit directly invokes the maintained package operation in the owning linthost process over disposable filesystem inputs. Windows supplies aliases and junction fixtures; no installed SDK, source overlay, product build or product host child is required. Fixture-only mklink preparation does not execute the behavior under test.
func TestLSPApplySuggestionResolvesJunctionProjectLink(t *testing.T) {
  assertLSPLogicalProjectLink(t, func(t *testing.T, target string, link string) {
    t.Helper()
    if output, err := exec.Command("cmd", "/c", "mklink", "/J", link, target).CombinedOutput(); err != nil {
      t.Fatalf("create directory junction: %v: %s", err, output)
    }
  })
}
