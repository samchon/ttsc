package evidence

import (
  "testing"
)

/**
 * Verifies only TypeScript references accept a package.
 *
 * Markdown and Swagger evidence lives in this project. Accepting the key for
 * them would silently ignore it, leaving a configuration that reads as
 * selecting a package and does not.
 *
 *  1. Configure a package on a Markdown reference.
 *  2. Decode the configuration.
 *  3. Assert the key is rejected for that artifact kind.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts a Markdown reference cannot select a package even when it also supplies local files.
 *
 * @evidence contracts/testing.md#independent-expectations Only the TypeScript reference publishes package. This case specifically rejects an authored Markdown package selection even with local files; it does not repeat every other artifact-kind combination.
 *
 * @evidence contracts/testing.md#distinguishing-cases A Markdown reference cannot select a package even when it also supplies local files.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationRejectsAPackageOnNonTypeScriptReferences is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticConfigurationRejectsAPackageOnNonTypeScriptReferences(t *testing.T) {
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"markdown","package":"@org/api","files":["docs/**"]}`),
    "only a TypeScript reference can select an installed package",
  )
}
