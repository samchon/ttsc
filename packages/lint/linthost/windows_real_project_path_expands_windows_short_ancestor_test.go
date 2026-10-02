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
// @evidence contracts/testing.md#execution-ownership This Windows-constrained Go unit directly invokes the maintained package operation in the owning linthost process over disposable filesystem inputs. Windows supplies aliases and junction fixtures; no installed SDK, source overlay, product build or product host child is required. Fixture-only mklink preparation does not execute the behavior under test.
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
