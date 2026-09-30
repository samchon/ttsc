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
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies a raw img element is reported for nextjs/no-img-element; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The Next Image component owns the supported image optimization path. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoImgElementReportsRawImg is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoImgElementReportsRawImg(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  // expect: nextjs/no-img-element error
  return <img src="/logo.png" alt="Logo" />;
}
`)
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-img-element", "pages/index.tsx", "import Image from \"next/image\"; export default function Page() { return <Image src=\"/logo.png\" alt=\"Logo\" />; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
