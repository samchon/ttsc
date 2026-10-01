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
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationAcceptsAPackageReferenceWithNoSelector is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticConfigurationAcceptsAPackageReferenceWithNoSelector(t *testing.T) {
  problems := decodeReferenceProblems(t, `{"type":"typescript","package":"@org/api"}`)
  if len(problems) != 0 {
    t.Fatalf("a package reference should need no selector, got:\n%v", problems)
  }
}
