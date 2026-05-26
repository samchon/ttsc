package linthost

import "testing"

// TestNextjsNoPageCustomFontReportsPageFontLink verifies page-level Google font links are rejected.
//
// Custom font links should live in pages/_document. The test uses a regular
// pages file to pin the diagnostic path.
//
// 1. Parse a regular pages TSX file.
// 2. Render a Google Fonts stylesheet link.
// 3. Assert `nextjs/no-page-custom-font` reports it.
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
}
