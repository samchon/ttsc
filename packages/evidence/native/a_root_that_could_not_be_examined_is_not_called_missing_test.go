package evidence

import (
  "errors"
  "io/fs"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a root the rule could not examine is not called missing.
 *
 * A stat fails on more than absence. An unreadable parent, a name the
 * filesystem refuses to spell, a path too long, and a link loop all come back
 * as a failure that does not say the path is absent, and under the first of
 * them the directory may already be there. "Create that directory" is then the
 * same unfollowable repair a file occupying the path produces: the author does
 * what the message says, nothing changes, and the message returns.
 *
 * Between an absent path and a directory it could not reach, the rule does not
 * know which it is looking at, so it says that, names no cause of its own, and
 * passes the operating system's reason through. Only an absent answer is asked
 * whether a link is standing there instead; the rest keep the reason the
 * filesystem gave them.
 *
 *  1. Describe a stat that failed without saying the path is absent, and one
 *     that said so.
 *  2. Read each rendered sentence, and the TypeScript form of the first.
 *  3. Assert only the absent one asks for the directory to be created, that
 *     neither names a cause the filesystem did not give, that a reason ending
 *     in a period does not double the one this rule writes, and that a
 *     TypeScript root still explains what it does with the directory.
 *
 * @evidence contracts/testing.md#behavioral-verification describeBaseDirectoryProblem is called on a base for `../contracts` with a permission-denied stat error, a Windows-style error whose text ends in a period, and an ErrNotExist stat error; the test checks the could-not-examine wording, the passed-through reason and repair clause, the TypeScript explanation, and that only the absent case says `create that directory`.
 * @evidence contracts/testing.md#independent-expectations Expected substrings are authored literals for the message contract: a stat failure that does not say the path is absent must not be called missing or ask for creation, the filesystem reason is passed through without doubling its terminator, and an absent path is known to be absent; no wording is read back from the builder.
 * @evidence contracts/testing.md#distinguishing-cases An unexaminable root (permission denied) against an absent root separates the two repairs; the period-terminated reason covers the doubled-terminator boundary (`.. ` must not appear); and the TypeScript form of the permission error must still explain the re-basing.
 * @evidence contracts/testing.md#execution-ownership TestARootThatCouldNotBeExaminedIsNotCalledMissing is a Go unit entry in the native test process; it resolves a base from a temp path and calls the message builder on constructed fs.PathError values, with no real stat failure, consumer install or product host.
 */
func TestARootThatCouldNotBeExaminedIsNotCalledMissing(t *testing.T) {
  base := resolvePopulationBase(filepath.Join(t.TempDir(), "project"), "../contracts")
  denied := &fs.PathError{Op: "stat", Path: base.Absolute, Err: fs.ErrPermission}
  unexaminable := describeBaseDirectoryProblem(base, artifactMarkdown, false, denied)
  for _, expected := range []string{
    "could not examine the markdown root '../contracts'",
    "which resolves to '",
    "permission denied",
    "clear the condition the filesystem reported",
    "it resolves against the ttsc project root",
  } {
    if !strings.Contains(unexaminable, expected) {
      t.Fatalf("expected %q in:\n%s", expected, unexaminable)
    }
  }
  if strings.Contains(unexaminable, "reachable by this process") {
    t.Fatalf("the rule names no cause the filesystem did not give:\n%s", unexaminable)
  }
  windows := &fs.PathError{
    Op:   "CreateFile",
    Path: base.Absolute,
    Err:  errors.New("The name of the file cannot be resolved by the system."),
  }
  terminated := describeBaseDirectoryProblem(base, artifactMarkdown, false, windows)
  if strings.Contains(terminated, ".. ") {
    t.Fatalf("the sentence owns its terminator, the reason does not:\n%s", terminated)
  }
  typescript := describeBaseDirectoryProblem(base, artifactTypeScript, false, denied)
  if !strings.Contains(
    typescript,
    "A typescript root is checked by this stat alone: it re-bases Program sources onto itself",
  ) {
    t.Fatalf("a typescript root explains itself in every state:\n%s", typescript)
  }
  if strings.Contains(unexaminable, "create that directory") {
    t.Fatalf("a directory that may already exist is not created:\n%s", unexaminable)
  }

  absent := describeBaseDirectoryProblem(
    base,
    artifactMarkdown,
    false,
    &fs.PathError{Op: "stat", Path: base.Absolute, Err: fs.ErrNotExist},
  )
  assertProblemContains(t, []string{absent}, "create that directory")
  if strings.Contains(absent, "could not examine") {
    t.Fatalf("an absent path is known to be absent:\n%s", absent)
  }
}
