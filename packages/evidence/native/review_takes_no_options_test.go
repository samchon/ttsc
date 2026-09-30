package evidence

import (
  "testing"
)

/**
 * Verifies the rule refuses options through the host's marker interface.
 *
 * `rule.OptionsRule` documents that a contributor rule defaults to *accepting*
 * options for backward compatibility, so the refusal has to be declared rather
 * than assumed: an unimplemented marker would let this rule take a configuration
 * object it never validates, and the host would pass it through in silence.
 * There is nothing to select here, since a citation on any public identity owes
 * a review, and per-directory scoping belongs in the outer `files` setting.
 *
 *  1. Read the rule's `AcceptsTtscLintOptions` declaration.
 *  2. Assert it refuses.
 *
 * @evidence contracts/testing.md#behavioral-verification reviewRule.AcceptsTtscLintOptions must return false.
 * @evidence contracts/testing.md#independent-expectations The rule's option marker contract explicitly refuses payloads; the false expectation is independent of host construction.
 * @evidence contracts/testing.md#distinguishing-cases This pins the contributor marker only; it does not execute the host's configured-payload rejection path.
 * @evidence contracts/testing.md#execution-ownership TestReviewTakesNoOptions is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
 */
func TestReviewTakesNoOptions(t *testing.T) {
  if (reviewRule{}).AcceptsTtscLintOptions() {
    t.Fatal("evidence/review must refuse options so the host rejects a configured payload")
  }
}
