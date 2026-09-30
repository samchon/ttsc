package evidence

import (
  "testing"
)

/**
 * Verifies a local TypeScript reference must select something.
 *
 * There is no implicit project population: guessing one would make the
 * obligation depend on a convention the configuration never states, and an
 * obligation nobody declared is worse than none.
 *
 *  1. Configure a local reference with no selector.
 *  2. Decode the configuration.
 *  3. Assert the omission is rejected and names the repair.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts a local TypeScript reference cannot omit its explicit files selector.
 *
 * @evidence contracts/testing.md#independent-expectations A local TypeScript reference selects active Program files explicitly. Omitting files cannot silently select an undeclared population and must require globs.
 *
 * @evidence contracts/testing.md#distinguishing-cases A local TypeScript reference cannot omit its explicit files selector.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationRejectsALocalReferenceWithNoSelector is the selectable unit entry in tests/test-evidence/go/unit, compiled into the shared native Go package by the repository overlay. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticConfigurationRejectsALocalReferenceWithNoSelector(t *testing.T) {
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"typescript"}`),
    "needs 'files' globs",
  )
}
