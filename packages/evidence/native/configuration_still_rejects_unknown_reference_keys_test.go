package evidence

import (
  "testing"
)

/**
 * Verifies an unknown reference key is still rejected.
 *
 * Adding two keys widens the accepted set, and a decoder that stopped checking
 * would let a typo like `packages` decode to the zero value and silently select
 * the local project instead.
 *
 *  1. Configure a misspelled key.
 *  2. Decode the configuration.
 *  3. Assert it is named as unknown.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts the packages misspelling remains an unknown-property failure instead of silently becoming a local reference.
 *
 * @evidence contracts/testing.md#independent-expectations The public property is package, never packages. The authored misspelling must yield an unknown-property diagnostic; this assertion checks refusal rather than the full offered-property list.
 *
 * @evidence contracts/testing.md#distinguishing-cases The packages misspelling remains an unknown-property failure instead of silently becoming a local reference.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationStillRejectsUnknownReferenceKeys is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticConfigurationStillRejectsUnknownReferenceKeys(t *testing.T) {
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"typescript","packages":"@org/api"}`),
    "unknown property",
  )
}
