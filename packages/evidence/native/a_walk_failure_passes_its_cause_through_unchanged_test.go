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
 * @evidence contracts/testing.md#behavioral-verification unreadableWalkEntryProblem, resolvePopulationBase is exercised with the scenario below; the assertions require the reason survives verbatim, that it is not doubled, and that the path this rule prints is still its own.
 * @evidence contracts/testing.md#independent-expectations The cause belongs to the operating system and may embed an absolute path of its own, in that system's own separators. Spelling the path this rule chose to print is one claim; rewriting a sentence it did not author would be another, and would leave a reader unable to match the message against the syscall that produced it. Its terminator is the one thing taken, because Windows writes one and POSIX does not, and the sentence that continues after it supplies its own. Asserting the cause with its period still passes, since that period is restored by the rule rather than kept from the cause, so the reason and the punctuation are asserted apart.
 * @evidence contracts/testing.md#distinguishing-cases Compose the message over a cause carrying an OS-native absolute path and a terminator of its own. Read the message. Assert the reason survives verbatim, that it is not doubled, and that the path this rule prints is still its own.
 * @evidence contracts/testing.md#execution-ownership TestAWalkFailurePassesItsCauseThroughUnchanged is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
