package evidence

import (
  "testing"
)

/**
 * Verifies an entirely unusable options payload declares nothing quietly.
 *
 * `Check` reports the configuration failure with a position and a repair; this
 * contract has no reporter and runs before a Program exists, so its only sound
 * answer is an empty declaration. Returning an error or panicking here would
 * convert one rule's misconfiguration into a failed build for the whole project.
 *
 *  1. Publish project inputs for options that are not an object at all.
 *  2. Repeat for an empty claim array and for absent options.
 *  3. Assert each declares nothing without panicking.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.ProjectInputs through declaredInputs is exercised with the scenario below; the assertions require each declares nothing without panicking.
 * @evidence contracts/testing.md#independent-expectations `Check` reports the configuration failure with a position and a repair; this contract has no reporter and runs before a Program exists, so its only sound answer is an empty declaration. Returning an error or panicking here would convert one rule's misconfiguration into a failed build for the whole project.
 * @evidence contracts/testing.md#distinguishing-cases Publish project inputs for options that are not an object at all. Repeat for an empty claim array and for absent options. Assert each declares nothing without panicking.
 * @evidence contracts/testing.md#execution-ownership TestUnusableOptionsDeclareNothingWithoutPanicking is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestUnusableOptionsDeclareNothingWithoutPanicking(t *testing.T) {
  for _, options := range []string{`"not-an-object"`, `{"claims":[]}`, ``} {
    if inputs := declaredInputs(t, options); len(inputs) != 0 {
      t.Fatalf("expected options %q to declare nothing, got %v", options, inputs)
    }
  }
}
