package linthost

import "testing"

// TestNextjsNoBeforeInteractiveScriptOutsideDocumentReportsPageUsage verifies beforeInteractive stays in _document.
//
// The rule is path-sensitive but filesystem-free: a virtual pages file is enough
// to exercise the non-document branch.
//
// 1. Parse a regular pages TSX file.
// 2. Render `next/script` with strategy beforeInteractive.
// 3. Assert the Script element is reported.
func TestNextjsNoBeforeInteractiveScriptOutsideDocumentReportsPageUsage(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
import Script from "next/script";

export default function Page() {
  return (
    <>
      // expect: nextjs/no-before-interactive-script-outside-document error
      <Script strategy="beforeInteractive" src="/early.js" />
    </>
  );
}
`)
}
