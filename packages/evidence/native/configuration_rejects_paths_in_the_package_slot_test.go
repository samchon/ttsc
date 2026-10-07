package evidence

import (
  "testing"
)

/**
 * Verifies a path in the package slot is rejected with the right repair.
 *
 * `./lib` and `@org/api/lib` are the two ways someone reaches for a local or
 * nested selection through the wrong key, and each has a different correct
 * answer, so the diagnostics differ.
 *
 *  1. Configure a relative path and a deep package path.
 *  2. Decode each configuration.
 *  3. Assert each is told which key it wanted.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts relative filesystem and deep package paths receive their different literal files-selector repairs.
 *
 * @evidence contracts/testing.md#independent-expectations The package property names a package identity, not a relative file tree or deep subpath. The two literal repair fragments independently direct ./lib to local files and @org/api/lib to package-narrowing files.
 *
 * @evidence contracts/testing.md#distinguishing-cases Relative filesystem and deep package paths receive their different literal files-selector repairs.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationRejectsPathsInThePackageSlot is a Go unit entry in the native test process; it decodes two in-memory JSON references through the decodeReferenceProblems helper and decodeGraphConfig with no filesystem, package installation, artifact build or product host, and has no table of variants.
 */
func TestEvidenceSemanticConfigurationRejectsPathsInThePackageSlot(t *testing.T) {
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"typescript","package":"./lib"}`),
    "use 'files' for a local population",
  )
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"typescript","package":"@org/api/lib"}`),
    "narrow it with 'files'",
  )
}
