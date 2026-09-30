package evidence

import (
  "io/fs"
  "strings"
  "testing"
)

/**
 * Verifies a reason keeps its words and loses only its terminator.
 *
 * Thirteen messages join a reason to a sentence of their own, and Windows writes
 * a terminator where POSIX does not, so the rule that decides which one survives
 * is asserted here rather than thirteen times. Five take their reason as text
 * rather than as an error, which is how one of them stayed unrepaired through two
 * commits that claimed the class was empty, and the reasons come from the
 * filesystem, a subprocess, a parser behind one, and this rule's own validation.
 *
 *  1. Trim a reason ending in a period, one that does not, a doubled one, a
 *     question mark, a bare period, and an empty string.
 *  2. Read each result, and the same rule reached through an error.
 *  3. Assert one terminator is removed and nothing else is.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification causeReason, causeText is exercised with the scenario below; the assertions require one terminator is removed and nothing else is.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Thirteen messages join a reason to a sentence of their own, and Windows writes a terminator where POSIX does not, so the rule that decides which one survives is asserted here rather than thirteen times. Five take their reason as text rather than as an error, which is how one of them stayed unrepaired through two commits that claimed the class was empty, and the reasons come from the filesystem, a subprocess, a parser behind one, and this rule's own validation.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Trim a reason ending in a period, one that does not, a doubled one, a question mark, a bare period, and an empty string. Read each result, and the same rule reached through an error. Assert one terminator is removed and nothing else is.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAReasonKeepsItsWordsAndLosesItsTerminator is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestAReasonKeepsItsWordsAndLosesItsTerminator(t *testing.T) {
  for _, entry := range []struct {
    reason   string
    expected string
  }{
    {"Access is denied.", "Access is denied"},
    {"permission denied", "permission denied"},
    {"stat C:/x: not a directory..", "stat C:/x: not a directory."},
    {"is it?", "is it?"},
    {".", ""},
    {"", ""},
  } {
    if got := causeReason(entry.reason); got != entry.expected {
      t.Fatalf("causeReason(%q) = %q, want %q", entry.reason, got, entry.expected)
    }
  }
  wrapped := &fs.PathError{Op: "stat", Path: "C:/x", Err: errAlreadyTerminated}
  if got := causeText(wrapped); !strings.HasSuffix(got, "denied") {
    t.Fatalf("causeText kept a terminator: %q", got)
  }
}
