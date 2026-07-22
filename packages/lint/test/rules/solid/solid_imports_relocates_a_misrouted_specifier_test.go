package linthost

import "testing"

// TestSolidImportsRelocatesAMisroutedSpecifier verifies `solid/imports` fixes
// every shape a misrouted specifier can be in, not only the one where it stands
// alone.
//
// The fix used to return no edits whenever the specifier had a sibling or the
// declaration carried a default binding, so `import { createEffect, render }
// from "solid-js"` — the most common way a Solid file goes wrong — produced a
// message and nothing else. `ReportFix` with no edits is a diagnostic, and the
// corpus asserted only that the diagnostic appeared, so the restriction was
// invisible.
//
// The destination is consulted before the in-place rewrite. Checking the other
// order lets the rewrite win on a file that already imports from the correct
// module, leaving two declarations of it — the duplicate the rule's own
// description promises to avoid.
//
// A type-only declaration relocates into a type-only one. Appending a value
// import into `import type { … }` makes every use of it a TS1361 error, and
// dropping `type` from a synthesized declaration emits a runtime import for a
// symbol with no runtime existence.
func TestSolidImportsRelocatesAMisroutedSpecifier(t *testing.T) {
  for _, tc := range []struct {
    name   string
    source string
    fixed  string
  }{
    {
      "sole binding rewrites the source in place",
      "import { render } from \"solid-js\";\nJSON.stringify(render);\n",
      "import { render } from \"solid-js/web\";\nJSON.stringify(render);\n",
    },
    {
      "a sibling no longer blocks the fix",
      "import { createEffect, render } from \"solid-js\";\nJSON.stringify({ createEffect, render });\n",
      "import { render } from \"solid-js/web\";\nimport { createEffect } from \"solid-js\";\nJSON.stringify({ createEffect, render });\n",
    },
    {
      "an existing destination receives the specifier",
      "import { createEffect, render } from \"solid-js\";\nimport { hydrate } from \"solid-js/web\";\nJSON.stringify({ createEffect, render, hydrate });\n",
      "import { createEffect } from \"solid-js\";\nimport { hydrate, render } from \"solid-js/web\";\nJSON.stringify({ createEffect, render, hydrate });\n",
    },
    {
      // Preferring the destination over the in-place rewrite is what keeps this
      // from becoming a second `solid-js/web` declaration. The emptied
      // declaration goes with it, line break included.
      "a sole binding joins an existing destination rather than duplicating it",
      "import { render } from \"solid-js\";\nimport { hydrate } from \"solid-js/web\";\nJSON.stringify({ render, hydrate });\n",
      "import { hydrate, render } from \"solid-js/web\";\nJSON.stringify({ render, hydrate });\n",
    },
    {
      // The braces go with the specifier: `import Solid, {} from` is not what
      // anyone meant. This shape had no fix at all before.
      "a default binding no longer blocks the fix",
      "import Solid, { render } from \"solid-js\";\nJSON.stringify({ Solid, render });\n",
      "import { render } from \"solid-js/web\";\nimport Solid from \"solid-js\";\nJSON.stringify({ Solid, render });\n",
    },
    {
      "a type-only declaration synthesizes a type-only one",
      "import type { createEffect, render } from \"solid-js\";\nJSON.stringify({} as { a: typeof createEffect; b: typeof render });\n",
      "import type { render } from \"solid-js/web\";\nimport type { createEffect } from \"solid-js\";\nJSON.stringify({} as { a: typeof createEffect; b: typeof render });\n",
    },
  } {
    t.Run(tc.name, func(t *testing.T) {
      assertFixSnapshot(t, "solid/imports", tc.source, tc.fixed)
    })
  }
}
