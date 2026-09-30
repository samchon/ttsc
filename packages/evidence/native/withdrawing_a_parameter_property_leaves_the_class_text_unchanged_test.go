package evidence

import "testing"

/**
 * Verifies ClassScopeReviewExpiresWhenAParameterPropertyIsWithdrawn moves only the member's
 * contribution.
 *
 * The case is worth only as much as this. Its baseline and its changed source
 * differ by the content of one documentation block, and a block is cut out of
 * every digest as a position a tag can occupy, so the class's own digest has to
 * come out identical. If it moved, the review would expire for the textual
 * reason rather than the structural one and the case would prove nothing about
 * subtree membership.
 *
 *  1. Materialize the baseline and the withdrawn source.
 *  2. Compare the class unit's own digest.
 *  3. Assert they are equal and that only the member's mark changed.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory retrieves Sale and Sale.prototype.price before/after withdrawal; class/member digests must stay equal, with only Hidden changing from empty to @internal.
 * @evidence contracts/testing.md#independent-expectations Documentation is excluded from declaration content digests while the withdrawal marker remains a separate semantic contribution.
 * @evidence contracts/testing.md#distinguishing-cases Both units must exist and both text digests remain stable; this certifies the premise of the withdrawal-expiry case, not the aggregate scope's hash calculation.
 * @evidence contracts/testing.md#execution-ownership TestWithdrawingAParameterPropertyLeavesTheClassTextUnchanged is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
 */
func TestWithdrawingAParameterPropertyLeavesTheClassTextUnchanged(t *testing.T) {
  digestOf := func(source string, target string) (string, string) {
    t.Helper()
    for _, unit := range parseTypeScriptInventory(t, "src/Sale.ts", source).Units {
      if unit.Target == target {
        return unit.Digest, unit.Hidden
      }
    }
    t.Fatalf("%s must materialize", target)
    return "", ""
  }
  baseClass, _ := digestOf(classReviewSource, "Sale")
  hiddenClass, _ := digestOf(classWithdrawnSource, "Sale")
  if baseClass != hiddenClass {
    t.Fatalf(
      "the class's own digest must not move: %s then %s",
      baseClass,
      hiddenClass,
    )
  }
  baseMember, baseTag := digestOf(classReviewSource, "Sale.prototype.price")
  hiddenMember, hiddenTag := digestOf(classWithdrawnSource, "Sale.prototype.price")
  if baseMember != hiddenMember {
    t.Fatalf(
      "the member's own digest must not move either: %s then %s",
      baseMember,
      hiddenMember,
    )
  }
  if baseTag != "" || hiddenTag != "@internal" {
    t.Fatalf("only the mark may change, got %q then %q", baseTag, hiddenTag)
  }
}
