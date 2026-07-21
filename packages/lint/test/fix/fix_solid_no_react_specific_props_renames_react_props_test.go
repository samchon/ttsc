package linthost

import "testing"

// TestFixSolidNoReactSpecificPropsRenamesReactProps verifies
// `solid/no-react-specific-props` applies the 1:1 rename it already names in
// its message, and leaves the `key` arm diagnostic-only.
//
// `className` and `class` are the same prop to a Solid DOM element, as are
// `htmlFor` and `for`, so the rewrite is a pure substitution of the name token
// and cannot change what the attribute does. `key` is not a rename at all —
// Solid DOM elements do not consume it — so its resolution is a deletion that
// would have to take the surrounding whitespace with it, and the rule declines
// to guess that span.
//
//  1. Fix a `<label>` carrying both React prop names and assert both are
//     renamed while string, expression, and bare boolean shapes survive.
//  2. Assert a `key` prop reports without applying any edit.
//  3. Assert the negative twins stay silent: the same element written with
//     Solid's own `class` and `for`, and `className` on a component, which is
//     a real prop name rather than a DOM attribute.
func TestFixSolidNoReactSpecificPropsRenamesReactProps(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "solid/no-react-specific-props",
    "main.tsx",
    "import { createSignal } from \"solid-js\";\n\nexport const App = () => <label className=\"a\" htmlFor={id()} />;\n",
    "import { createSignal } from \"solid-js\";\n\nexport const App = () => <label class=\"a\" for={id()} />;\n",
  )
  assertFixSnapshotFile(
    t,
    "solid/no-react-specific-props",
    "main.tsx",
    "import { createSignal } from \"solid-js\";\n\nexport const App = () => <label className htmlFor />;\n",
    "import { createSignal } from \"solid-js\";\n\nexport const App = () => <label class for />;\n",
  )

  keyed := "import { createSignal } from \"solid-js\";\n\nexport const App = () => <div key=\"k\" />;\n"
  got, applied := runFixSnapshotFile(t, "solid/no-react-specific-props", "main.tsx", keyed)
  if applied != 0 {
    t.Fatalf("key arm applied %d fixes, want 0", applied)
  }
  if got != keyed {
    t.Fatalf("key arm rewrote source:\nwant %q\ngot  %q", keyed, got)
  }

  for _, negative := range []string{
    "import { createSignal } from \"solid-js\";\n\nexport const App = () => <label class=\"a\" for={id()} />;\n",
    "import { createSignal } from \"solid-js\";\n\nexport const App = () => <Label className=\"a\" />;\n",
  } {
    _, _, findings := runRuleFindingsSnapshotFile(
      t,
      "solid/no-react-specific-props",
      "main.tsx",
      negative,
      nil,
    )
    if len(findings) != 0 {
      t.Fatalf("expected zero findings for %q, got %d (%+v)", negative, len(findings), findings)
    }
  }
}
