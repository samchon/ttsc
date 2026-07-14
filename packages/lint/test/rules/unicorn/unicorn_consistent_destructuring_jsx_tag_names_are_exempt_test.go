package linthost

import (
  "strings"
  "testing"
)

// TestUnicornConsistentDestructuringJsxTagNamesAreExempt verifies JSX
// element tags never report while JSX expression containers still do.
//
// ESTree types member tags as JSXMemberExpression, which upstream's
// MemberExpression listener never receives; TypeScript-Go parses the same
// tag as a PropertyAccessExpression, so the port must filter tag positions
// explicitly or every `<Lib.Item />` after `const {Item} = Lib` would be
// told to rewrite its tag into an unrenderable identifier.
//
//  1. Destructure `Item` from `Lib` in a TSX file.
//  2. Use `Lib.Item` as an element tag and inside a JSX attribute expression.
//  3. Assert only the attribute expression read is reported.
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
