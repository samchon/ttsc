package linthost

import "testing"

// TestNextjsNoStyledJSXInDocumentReportsStyleJSX verifies styled-jsx is rejected in pages/_document.
//
// The rule only needs a document file path and a boolean JSX attr to catch the
// problematic style tag.
//
// 1. Parse pages/_document as TSX.
// 2. Render `<style jsx>`.
// 3. Assert `nextjs/no-styled-jsx-in-document` reports it.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies style jsx in _document is reported for nextjs/no-styled-jsx-in-document; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The same styled JSX belongs in the ordinary page component. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoStyledJSXInDocumentReportsStyleJSX is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoStyledJSXInDocumentReportsStyleJSX(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-styled-jsx-in-document", "pages/index.tsx", "export default function Page() { return <style jsx>{\"body { color: red; }\"}</style>; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
