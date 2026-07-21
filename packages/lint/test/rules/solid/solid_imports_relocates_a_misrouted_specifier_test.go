package linthost

import "testing"

// TestSolidImportsRelocatesAMisroutedSpecifier verifies `solid/imports` fixes
// the ordinary shape, not only the one where the misrouted name stands alone.
//
// The fix used to return no edits whenever the specifier had a sibling or the
// declaration carried a default binding, so `import { createEffect, render }
// from "solid-js"` — the most common way a Solid file goes wrong — produced a
// message and nothing else. `ReportFix` with no edits is a diagnostic, and the
// corpus asserted only that the diagnostic appeared, so the restriction was
// invisible.
//
// Three shapes, because a specifier is alone or not and the destination exists
// or not:
//
//  1. Alone: rewrite the module specifier in place, the narrowest edit.
//  2. With siblings and no destination: cut it out and synthesize the import.
//  3. With siblings and a destination: cut it out and append it there, which is
//     the merge the rule's own description promises.
func TestSolidImportsRelocatesAMisroutedSpecifier(t *testing.T) {
  t.Run("sole binding rewrites the source", func(t *testing.T) {
    assertFixSnapshot(
      t,
      "solid/imports",
      "import { render } from \"solid-js\";\nJSON.stringify(render);\n",
      "import { render } from \"solid-js/web\";\nJSON.stringify(render);\n",
    )
  })

  t.Run("a sibling no longer blocks the fix", func(t *testing.T) {
    assertFixSnapshot(
      t,
      "solid/imports",
      "import { createEffect, render } from \"solid-js\";\nJSON.stringify({ createEffect, render });\n",
      "import { render } from \"solid-js/web\";\nimport { createEffect } from \"solid-js\";\nJSON.stringify({ createEffect, render });\n",
    )
  })

  t.Run("an existing destination receives the specifier", func(t *testing.T) {
    assertFixSnapshot(
      t,
      "solid/imports",
      "import { createEffect, render } from \"solid-js\";\nimport { hydrate } from \"solid-js/web\";\nJSON.stringify({ createEffect, render, hydrate });\n",
      "import { createEffect } from \"solid-js\";\nimport { hydrate, render } from \"solid-js/web\";\nJSON.stringify({ createEffect, render, hydrate });\n",
    )
  })
}

// TestSolidImportsLeavesCorrectlyRoutedImportsAlone is the negative twin: a
// specifier already importing from its canonical module produces no finding, so
// the relocation above is driven by the routing table rather than by the
// declaration's shape.
func TestSolidImportsLeavesCorrectlyRoutedImportsAlone(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "solid/imports",
    "import { createEffect, createSignal } from \"solid-js\";\nimport { render } from \"solid-js/web\";\nimport { createStore } from \"solid-js/store\";\nJSON.stringify({ createEffect, createSignal, render, createStore });\n",
  )
}
