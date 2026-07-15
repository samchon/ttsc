package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNextjsNoPageCustomFontReportsPageFontLink verifies page-level Google font links are rejected.
//
// Custom font links should live in pages/_document. The positive and negative
// use the same link so only the logical filename can change the result.
//
//  1. Parse a regular page and pages/_document with the same font link.
//  2. Assert `nextjs/no-page-custom-font` reports the regular page.
//  3. Dispatch the rule for _document and assert it produces no finding.
func TestNextjsNoPageCustomFontReportsPageFontLink(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  return (
    <>
      // expect: nextjs/no-page-custom-font error
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter&display=swap" />
    </>
  );
}
`)

  document := parseTSXFile(t, "/virtual/pages/_document.tsx", `
export default function Document() {
  return <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter&display=swap" />;
}
`)
  findings := NewEngine(RuleConfig{
    "nextjs/no-page-custom-font": SeverityError,
  }).Run([]*shimast.SourceFile{document}, nil)
  if len(findings) != 0 {
    t.Fatalf("pages/_document.tsx should allow the shared font link, got %+v", findings)
  }
}
