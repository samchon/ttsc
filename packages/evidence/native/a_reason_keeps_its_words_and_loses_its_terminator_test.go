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
 * @evidence contracts/testing.md#behavioral-verification causeReason is called on six literal reasons (`Access is denied.`, `permission denied`, a doubled trailing period, `is it?`, a bare `.`, and an empty string) and compared with literal results, and causeText is called on an fs.PathError wrapping the error `Access is denied.` and must yield text ending in `denied`.
 * @evidence contracts/testing.md#independent-expectations Each expected string is a literal authored here: exactly one trailing period is removed and every other character is kept; the causeText check is a suffix check, so it only establishes that the error path also drops the terminator, not its full wording.
 * @evidence contracts/testing.md#distinguishing-cases Reasons with a period, without one, with a doubled period, ending in a question mark, a lone period and the empty string cover the removal and the no-op boundaries; the causeText case covers the same rule reached through an error.
 * @evidence contracts/testing.md#execution-ownership TestAReasonKeepsItsWordsAndLosesItsTerminator is a Go unit entry in the native test process; it calls causeReason and causeText directly on literals with no filesystem, consumer install or product host.
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
