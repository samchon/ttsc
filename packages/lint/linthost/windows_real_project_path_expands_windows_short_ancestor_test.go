//go:build windows

package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestWindowsRealProjectPathExpandsShortAncestorForMissingDescendant verifies missing descendants preserve real Windows short-path identity.
//
// An absent descendant cannot itself be realpathed, so its existing 8.3 ancestor must carry physical project identity.
//
// 1. Obtain an actual 8.3 alias for an existing long project root.
// 2. Resolve a nonexistent generated descendant to its authored long path.
// 3. Require the generated ignore to match inside the aliased project and reject another project.
//
// @evidence contracts/testing.md#behavioral-verification realProjectPath expands the actual short ancestor for a missing generated descendant; matchAnyPattern accepts the inside generated path and rejects the outside project path.
// @evidence contracts/testing.md#independent-expectations Windows GetShortPathName supplies the real alias; authored long-root descendant paths and the independent inside/outside generated pattern distinction establish expected canonical and scope results.
// @evidence contracts/testing.md#distinguishing-cases Owns missing descendant under a real 8.3 ancestor, matching generated scope, and outside-root rejection; the original unavailable-short-name volume skip is retained.
// @evidence contracts/testing.md#execution-ownership TestWindowsRealProjectPathExpandsShortAncestorForMissingDescendant is a Windows-only Go boundary entry in the setup batch; its source-private operation is executed through the shared Go overlay rather than repeated consumer installs or product builds.
// @evidence contracts/e2e.md#necessary-boundary Only the Windows kernel can produce and expand an actual 8.3 alias; a literal Windows-looking path under POSIX would not exercise this connection.
// @evidence contracts/e2e.md#shared-execution Reuses the setup Windows Go process and source overlay shared by the other kernel cases; only its small filesystem fixture is distinct, with no separate native producer or consumer install.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns the fixture and its link or alias inputs; no shared mutable project or cache entry is reused across cases, and test cleanup releases its directories.
// @evidence contracts/e2e.md#preserved-coverage Transfers all three original canonical-path, positive-ignore and outside-ignore assertions without replacing actual aliases with synthetic spellings.
func TestWindowsRealProjectPathExpandsShortAncestorForMissingDescendant(t *testing.T) {
  longRoot := realProjectPath(t.TempDir())
  shortRoot := windowsShortPathForTest(t, longRoot)
  shortFile := filepath.Join(shortRoot, "generated", "types", "validator.ts")
  longFile := filepath.Join(longRoot, "generated", "types", "validator.ts")

  if got := realProjectPath(shortFile); !strings.EqualFold(got, longFile) {
    t.Fatalf("missing descendant did not inherit long-path identity: got %q, want %q", got, longFile)
  }
  if !matchAnyPattern(shortRoot, []string{"generated/**"}, shortFile) {
    t.Fatal("global ignore did not match a missing descendant below an 8.3 project root")
  }

  outsideRoot := realProjectPath(t.TempDir())
  outside := filepath.Join(outsideRoot, "generated", "types", "validator.ts")
  if matchAnyPattern(shortRoot, []string{"generated/**"}, outside) {
    t.Fatal("global ignore matched a path outside the aliased project root")
  }
}
