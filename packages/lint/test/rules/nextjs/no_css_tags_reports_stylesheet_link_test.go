package linthost

import "testing"

// TestNextjsNoCSSTagsReportsStylesheetLink verifies raw stylesheet links are reported.
//
// Next.js expects CSS imports through supported entrypoints. This keeps the rule
// at the JSX attribute level.
//
// 1. Parse a TSX page with a stylesheet link.
// 2. Enable `nextjs/no-css-tags`.
// 3. Assert the raw link tag is reported.
func TestNextjsNoCSSTagsReportsStylesheetLink(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  return (
    <>
      // expect: nextjs/no-css-tags error
      <link rel="stylesheet" href="/main.css" />
    </>
  );
}
`)
}
