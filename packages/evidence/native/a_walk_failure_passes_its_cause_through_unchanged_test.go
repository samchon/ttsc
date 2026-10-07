package evidence

import (
  "errors"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies the underlying filesystem error survives untouched.
 *
 * The cause belongs to the operating system and may embed an absolute path of
 * its own, in that system's own separators. Spelling the path this rule chose to
 * print is one claim; rewriting a sentence it did not author would be another,
 * and would leave a reader unable to match the message against the syscall that
 * produced it.
 *
 * Its terminator is the one thing taken, because Windows writes one and POSIX
 * does not, and the sentence that continues after it supplies its own. Asserting
 * the cause with its period still passes, since that period is restored by the
 * rule rather than kept from the cause, so the reason and the punctuation are
 * asserted apart.
 *
 *  1. Compose the message over a cause carrying an OS-native absolute path and
 *     a terminator of its own.
 *  2. Read the message.
 *  3. Assert the reason survives verbatim, that it is not doubled, and that the
 *     path this rule prints is still its own.
 *
 * @evidence contracts/testing.md#behavioral-verification unreadableWalkEntryProblem is called for a base `../documents`, entry `requirements/private` and a cause whose text is `open C:\Users\one\documents\private: Access is denied.`; the message must contain that text with its period followed by `. Fix filesystem access`, must not contain `.. `, and must quote `'../documents/requirements/private'`.
 * @evidence contracts/testing.md#independent-expectations The expected reason is the cause text written in the test, so the check is that the operating-system sentence, including its Windows path and separators, is kept verbatim and only its terminator is normalized; the rule's own path is asserted separately.
 * @evidence contracts/testing.md#distinguishing-cases A cause that already ends in a period and embeds a native absolute path covers the doubled-terminator boundary and the no-rewriting-of-the-cause boundary; a cause without a terminator is covered by the causeReason entry.
 * @evidence contracts/testing.md#execution-ownership TestAWalkFailurePassesItsCauseThroughUnchanged is a Go unit entry in the native test process; it calls resolvePopulationBase and the message builder on constructed values with no filesystem access, consumer install or product host.
 */
func TestAWalkFailurePassesItsCauseThroughUnchanged(t *testing.T) {
  root := filepath.Join(t.TempDir(), "project")
  cause := errors.New(`open C:\Users\one\documents\private: Access is denied.`)
  problem := unreadableWalkEntryProblem(
    resolvePopulationBase(root, "../documents"),
    "requirements/private",
    "Markdown",
    cause,
  )
  reason := strings.TrimSuffix(cause.Error(), ".")
  if !strings.Contains(problem, reason+". Fix filesystem access") {
    t.Fatalf("the cause is the filesystem's own sentence, got: %s", problem)
  }
  if strings.Contains(problem, ".. ") {
    t.Fatalf("the sentence supplies the terminator the cause already had: %s", problem)
  }
  if !strings.Contains(problem, "'../documents/requirements/private'") {
    t.Fatalf("the path this rule prints is still its own, got: %s", problem)
  }
}
