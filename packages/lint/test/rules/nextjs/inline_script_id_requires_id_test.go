package linthost

import "testing"

// TestNextjsInlineScriptIDRequiresID verifies inline next/script content needs an id.
//
// Inline scripts are keyed by id for stable injection. This locks the default
// import tracking and JSX children path together.
//
// 1. Import the default Script component from `next/script`.
// 2. Render inline script text without an id.
// 3. Assert `nextjs/inline-script-id` reports the Script element.
func TestNextjsInlineScriptIDRequiresID(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
import Script from "next/script";

export default function Page() {
  return (
    <>
      // expect: nextjs/inline-script-id error
      <Script>{`+"`"+`window.__ready = true;`+"`"+`}</Script>
    </>
  );
}
`)
}
