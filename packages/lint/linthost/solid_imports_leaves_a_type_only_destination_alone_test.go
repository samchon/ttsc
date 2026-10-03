package linthost

import "testing"

// TestSolidImportsLeavesATypeOnlyDestinationAlone is the negative twin for the
// relocation's type-only rule.
//
// A value specifier must not join `import type { … }`, and a type specifier
// must not join a value declaration. Both are legal edits that produce code the
// compiler rejects or the emitter mishandles: the first makes every use of the
// symbol a TS1361 error, and the second survives into the emitted JavaScript
// under `verbatimModuleSyntax` for a symbol with no runtime existence.
//
// The fix is expected to synthesize a matching declaration instead of appending
// into the mismatched one, which is what these two sources assert.
//
// @evidence contracts/testing.md#behavioral-verification assertFixSnapshot exercises the actual engine and fixer to verify two named fix cases synthesize declarations rather than merging value/type bindings into mismatched destinations; the assertions below retain the observable identity of every expected result.
// @evidence contracts/testing.md#independent-expectations Type-only declarations must retain type-only semantics and value imports must remain runtime values; each complete fixed string is authored from the intended import meaning.
// @evidence contracts/testing.md#distinguishing-cases Both mismatch directions preserve the existing destination, unrelated bindings and uses. TestSolidImportsRelocatesAMisroutedSpecifier owns matching destinations.
// @evidence contracts/testing.md#execution-ownership TestSolidImportsLeavesATypeOnlyDestinationAlone owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine and fixer calls execute in the shared process without a Solid installation or native product host.
func TestSolidImportsLeavesATypeOnlyDestinationAlone(t *testing.T) {
  for _, tc := range []struct {
    name   string
    source string
    fixed  string
  }{
    {
      "a value specifier does not join a type-only destination",
      "import type { MountableElement } from \"solid-js/web\";\nimport { createEffect, render } from \"solid-js\";\nJSON.stringify({ createEffect, render } as unknown as MountableElement);\n",
      "import type { MountableElement } from \"solid-js/web\";\nimport { render } from \"solid-js/web\";\nimport { createEffect } from \"solid-js\";\nJSON.stringify({ createEffect, render } as unknown as MountableElement);\n",
    },
    {
      "a type specifier does not join a value destination",
      "import { hydrate } from \"solid-js/web\";\nimport type { createEffect, render } from \"solid-js\";\nJSON.stringify({ hydrate } as { a: typeof createEffect; b: typeof render });\n",
      "import { hydrate } from \"solid-js/web\";\nimport type { render } from \"solid-js/web\";\nimport type { createEffect } from \"solid-js\";\nJSON.stringify({ hydrate } as { a: typeof createEffect; b: typeof render });\n",
    },
  } {
    t.Run(tc.name, func(t *testing.T) {
      assertFixSnapshot(t, "solid/imports", tc.source, tc.fixed)
    })
  }
}
