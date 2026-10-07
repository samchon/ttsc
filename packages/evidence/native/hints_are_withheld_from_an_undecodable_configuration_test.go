package evidence

import (
  "testing"
)

/**
 * Verifies an undecodable configuration publishes nothing.
 *
 * The rule reports the configuration error, which fails it, which withdraws the
 * corpus — one consequence rather than a second code path. Pinned so the
 * absence is attributed to the gate rather than read as a decoding quirk.
 *
 *  1. Configure the rule with an unsupported artifact type.
 *  2. Run it.
 *  3. Assert it reports and publishes no corpus.
 *
 * @evidence contracts/testing.md#behavioral-verification runGraphHints receives an unsupported artifact type, must return at least one diagnostic and no hints.
 * @evidence contracts/testing.md#independent-expectations Unsupported artifact types cannot produce a valid graph state, and the modeled passing gate must withhold a corpus. The test asserts failure existence rather than the exact decoding diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases The nonsense artifact type owns the invalid configuration branch; passing graph publication is the complementary TestHintsFollowThePassingGate case.
 * @evidence contracts/testing.md#execution-ownership TestHintsAreWithheldFromAnUndecodableConfiguration is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsAreWithheldFromAnUndecodableConfiguration(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
  }, `{"claims":[{"type":"nonsense","files":["docs/**"]}]}`)
  if len(messages) == 0 {
    t.Fatal("expected the configuration to be reported")
  }
  if len(hints) != 0 {
    t.Fatalf("expected no corpus, got %d hints", len(hints))
  }
}
