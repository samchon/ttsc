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
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies the same font link reports in a page but remains clean in _document for nextjs/no-page-custom-font; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations Document-level font loading is shared; page-level font loading violates the supported placement. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original fixture already carries its reported construct and the clean counterpart described above; exact finding enumeration keeps the counterpart from being over-reported. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoPageCustomFontReportsPageFontLink is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
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
