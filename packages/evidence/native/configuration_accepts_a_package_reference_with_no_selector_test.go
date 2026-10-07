package evidence

import (
  "testing"
)

/**
 * Verifies a package reference needs no selector.
 *
 * The negative twin of the case above. A package can name its own declaration
 * entry, so requiring one from the consumer would be asking them to restate
 * what the manifest already says.
 *
 *  1. Configure a package reference with neither selector.
 *  2. Decode the configuration.
 *  3. Assert it is accepted.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts a package reference without a local selector is accepted as the adjacent negative twin of local reference omission.
 *
 * @evidence contracts/testing.md#independent-expectations The public package reference may use its package declaration entry when files is omitted. A clean decode admits that declared package shape; the local omission rejection is the adjacent negative case.
 *
 * @evidence contracts/testing.md#distinguishing-cases A package reference without a local selector is accepted as the adjacent negative twin of local reference omission.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationAcceptsAPackageReferenceWithNoSelector is a Go unit entry in the native test process; it decodes one in-memory JSON reference through the decodeReferenceProblems helper and decodeGraphConfig with no filesystem, package installation, artifact build or product host, and has a single case with no table.
 */
func TestEvidenceSemanticConfigurationAcceptsAPackageReferenceWithNoSelector(t *testing.T) {
  problems := decodeReferenceProblems(t, `{"type":"typescript","package":"@org/api"}`)
  if len(problems) != 0 {
    t.Fatalf("a package reference should need no selector, got:\n%v", problems)
  }
}
