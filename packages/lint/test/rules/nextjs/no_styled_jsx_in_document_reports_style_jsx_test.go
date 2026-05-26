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
func TestNextjsNoStyledJSXInDocumentReportsStyleJSX(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/_document.tsx", `
export default function Document() {
  return (
    <>
      // expect: nextjs/no-styled-jsx-in-document error
      <style jsx>{`+"`"+`body { color: red; }`+"`"+`}</style>
    </>
  );
}
`)
}
