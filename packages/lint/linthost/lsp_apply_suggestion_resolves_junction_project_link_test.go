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
// @evidence contracts/testing.md#behavioral-verification The shared scenario returns the literal prefer-as-const rewrite under the junction URI, preserves physical bytes, rejects the junction to an outside source with status 2 and returns null for the dependency junction.
// @evidence contracts/testing.md#independent-expectations The authored rewritten/original source strings and explicit logical URI establish edit content and identity independently of path resolution; literal error/null expectations define the two protected boundaries.
// @evidence contracts/testing.md#distinguishing-cases Project, outside-root and node_modules junctions distinguish allowed alias resolution from accidental guard bypass. The portable sibling runs the same assertions with filesystem symlinks.
// @evidence contracts/testing.md#execution-ownership This one Go boundary entry is selected by the existing Windows setup batch and owns the shared scenario's three junction fixtures; the Linux unit population does not select it.
// @evidence contracts/e2e.md#necessary-boundary Real NTFS junctions connect the editor URI to Windows physical paths; synthetic path strings cannot prove native resolution and admission retain the same identity.
// @evidence contracts/e2e.md#shared-execution The Windows setup batch shares one Go package preparation and installed toolchain across kernel cases. This entry invokes mklink only to create its three necessary junction inputs and builds no separate product binary.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disposable projects isolate each source/configuration and the aliases whose topology differs. Go test cleanup owns those directories; every captured dispatcher request restores stdout/stderr before the next case.
// @evidence contracts/e2e.md#preserved-coverage The original logical-project-link assertions remain in the shared scenario and execute for both the portable symlink unit and this Windows junction entry, including outside/dependency rejection and exact source non-mutation.
func TestLSPApplySuggestionResolvesJunctionProjectLink(t *testing.T) {
  assertLSPLogicalProjectLink(t, func(t *testing.T, target string, link string) {
    t.Helper()
    if output, err := exec.Command("cmd", "/c", "mklink", "/J", link, target).CombinedOutput(); err != nil {
      t.Fatalf("create directory junction: %v: %s", err, output)
    }
  })
}
