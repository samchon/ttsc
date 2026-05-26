package linthost

import "testing"

// TestNextjsNoImgElementReportsRawImg verifies raw img elements are reported.
//
// Next.js image optimization requires `next/image`; this locks the intrinsic JSX
// tag detection branch.
//
// 1. Parse a TSX page with a raw img.
// 2. Enable `nextjs/no-img-element`.
// 3. Assert the img element is reported.
func TestNextjsNoImgElementReportsRawImg(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  // expect: nextjs/no-img-element error
  return <img src="/logo.png" alt="Logo" />;
}
`)
}
