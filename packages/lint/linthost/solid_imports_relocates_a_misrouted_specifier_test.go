package linthost

import "testing"

// TestSolidImportsRelocatesAMisroutedSpecifier verifies six authored relocation
// shapes: sole, sibling and default bindings, matching existing destinations,
// and a type-only source declaration. Every case compares complete fixed bytes,
// rather than accepting a diagnostic with no edits.
//
// The destination is consulted before the in-place rewrite. Checking the other
// order lets the rewrite win on a file that already imports from the correct
// module, leaving two declarations of it — the duplicate the rule's own
// description promises to avoid.
//
// The authored type-only declaration remains type-only after relocation, so
// its render binding is not turned into a runtime import. These source oracles
// do not compile or emit the results or establish every use is a TS1361 error.
//
// @evidence contracts/testing.md#behavioral-verification assertFixSnapshot exercises the actual engine and fixer to verify six named fix cases relocate render into solid-js/web and preserve sibling/default/type bindings; the assertions below retain the observable identity of every expected result.
// @evidence contracts/testing.md#independent-expectations Solid module ownership puts render in solid-js/web; literal whole-source expected strings establish the required relocation and retained syntax independently of the fixer.
// @evidence contracts/testing.md#distinguishing-cases Sole/sibling/default/type-only imports and existing destinations cover in-place, split and merge edits; the mismatch test owns destinations of the wrong import kind.
// @evidence contracts/testing.md#execution-ownership TestSolidImportsRelocatesAMisroutedSpecifier owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine and fixer calls execute in the shared process without a Solid installation or native product host.
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
      // anyone meant; the expected result preserves only the default binding here.
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
