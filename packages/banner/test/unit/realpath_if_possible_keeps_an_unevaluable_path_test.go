package banner_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestRealpathIfPossibleKeepsAnUnevaluablePath verifies a path that cannot be
// evaluated is returned unchanged rather than emptied.
//
// The compiler resolution realpaths the `typescript` install before hopping to
// its platform sibling. filepath.EvalSymlinks fails on a path that does not
// exist and on an NTFS junction it refuses to traverse, and answering "" there
// would turn a resolvable install into an upward walk from the filesystem root.
// Returning the input keeps the failure inert.
//
//  1. Realpath a directory that exists and assert it still names something.
//  2. Realpath a path below it that does not exist.
//  3. Assert the missing path comes back verbatim.
//
// @evidence contracts/testing.md#behavioral-verification Calls bannerRealpathIfPossible on an existing temp directory and a missing descendant; the first result must remain nonempty and the missing path must return unchanged.
// @evidence contracts/testing.md#independent-expectations The fallback contract preserves the input when EvalSymlinks cannot resolve it. The missing path is constructed independently; the positive assertion only checks nonempty identity.
// @evidence contracts/testing.md#distinguishing-cases Contrasts existing-directory success with missing-path fallback. Linked-install and Windows junction identity are owned by boundary cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestRealpathIfPossibleKeepsAnUnevaluablePath is selected from test/unit by the root test:go command (`go test ./packages/banner/...`). Calls bannerRealpathIfPossible in the Go process on ordinary paths; it creates no link or subprocess.
func TestRealpathIfPossibleKeepsAnUnevaluablePath(t *testing.T) {
  root := t.TempDir()
  if real := shared.BannerRealpathIfPossible(root); real == "" {
    t.Fatal("realpathIfPossible emptied an existing directory")
  }

  missing := filepath.Join(shared.BannerRealpathIfPossible(root), "no-such-directory", "package.json")
  if got := shared.BannerRealpathIfPossible(missing); got != missing {
    t.Fatalf("realpathIfPossible = %q, want the unevaluable path %q back", got, missing)
  }
}
