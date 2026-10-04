package linthost

import (
  "strings"
  "testing"
)

// TestUnicornConsistentDestructuringJsxTagNamesAreExempt verifies JSX
// element tags never report while JSX expression containers still do.
//
// TypeScript-Go represents the member tag as a PropertyAccessExpression.
// The rule explicitly excludes JSX tag positions while admitting expression
// containers. The source below checks that distinction for the same Lib.Item
// spelling; it does not apply a suggestion or execute/render either form.
//
//  1. Destructure `Item` from `Lib` in a TSX file.
//  2. Use `Lib.Item` as an element tag and inside a JSX attribute expression.
//  3. Assert only the attribute expression read is reported.
//
// @evidence contracts/testing.md#behavioral-verification runRuleFindingsSnapshotFile checks exactly one attribute-expression member range and its literal suggestion title, detecting JSX tags misclassified as ordinary property reads.
// @evidence contracts/testing.md#independent-expectations The authored JSX-tag exclusion and expression-read expectation establish the independently located marker member and literal Item suggestion title; replacement application is not observed.
// @evidence contracts/testing.md#distinguishing-cases The same Lib.Item spelling is clean as a JSX tag but reports inside marker={...}; the tag-position distinction is the decision boundary.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentDestructuringJsxTagNamesAreExempt owns this authored source matrix as one discoverable Go unit entry. Its TSX fixture exercises the owning checker-backed engine in the shared Go process; failure output identifies the member range or suggestion payload. No installed consumer, native build or child product host runs.
func TestUnicornConsistentDestructuringJsxTagNamesAreExempt(t *testing.T) {
  source := `declare global {
  namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      section: {marker?: unknown};
    }
  }
}
export const Lib = {
  Item: (): JSX.Element => ({}),
};
const {Item} = Lib;
void Item;
export const tag = <Lib.Item />;
export const attribute = <section marker={Lib.Item} />;
`
  _, _, findings := runRuleFindingsSnapshotFile(t, "unicorn/consistent-destructuring", "main.tsx", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1: %+v", len(findings), findings)
  }
  finding := findings[0]
  start := strings.Index(source, "marker={Lib.Item}") + len("marker={")
  if finding.Pos != start || finding.End != start+len("Lib.Item") {
    t.Fatalf("finding range = [%d, %d), want [%d, %d)", finding.Pos, finding.End, start, start+len("Lib.Item"))
  }
  if len(finding.Suggestions) != 1 || finding.Suggestions[0].Title != "Replace `Lib.Item` with destructured property `Item`." {
    t.Fatalf("suggestion = %+v", finding.Suggestions)
  }
}
