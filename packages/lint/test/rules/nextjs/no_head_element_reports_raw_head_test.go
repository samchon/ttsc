package linthost

import "testing"

// TestNextjsNoHeadElementReportsRawHead verifies raw head tags are reported outside app.
//
// Raw `<head>` elements bypass Next.js head handling. The app directory is
// skipped separately, so a pages fixture exercises the diagnostic path.
//
// 1. Parse a pages TSX file.
// 2. Render a lowercase head element.
// 3. Assert `nextjs/no-head-element` reports it.
func TestNextjsNoHeadElementReportsRawHead(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  // expect: nextjs/no-head-element error
  return <head />;
}
`)
}
