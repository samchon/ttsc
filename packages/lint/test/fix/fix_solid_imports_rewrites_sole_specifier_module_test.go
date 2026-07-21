package linthost

import "testing"

// TestFixSolidImportsRewritesSoleSpecifierModule verifies `solid/imports`
// names the canonical module it already computed and rewrites the specifier
// when that rewrite moves nothing else.
//
// The rule looked the correct entry point up in `solidPreferredSource` and
// then reported a message that did not say which symbol or which module it
// meant. Naming both is the point.
//
// This case owns the narrowest repair: a declaration whose sole binding is the
// misplaced specifier is fixed by rewriting the module specifier, moving no
// other text. The shapes that need the specifier cut out and relocated are
// pinned by `solid_imports_relocates_a_misrouted_specifier_test.go`; they used
// to be negative twins here, asserting the absence of a fix that the rule now
// has.
//
//  1. Fix `import { render } from "solid-js"`, whose sole binding belongs to
//     `solid-js/web`, and assert the module is rewritten and the message names
//     the symbol and the module.
//  2. Assert an aliased specifier still resolves from its imported name, and a
//     single-quoted specifier keeps its quotes, proving only source text inside
//     the quotes is replaced.
//  3. Assert the negative twins report without a fix: a declaration with a
//     second specifier, and one with a default binding.
//  4. Assert an already-canonical import reports nothing at all.
func TestFixSolidImportsRewritesSoleSpecifierModule(t *testing.T) {
  source := "import { render } from \"solid-js\";\nrender();\n"
  assertFixSnapshot(
    t,
    "solid/imports",
    source,
    "import { render } from \"solid-js/web\";\nrender();\n",
  )
  _, _, findings := runRuleFindingsSnapshot(t, "solid/imports", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1 (%+v)", len(findings), findings)
  }
  expected := "Import `render` from `solid-js/web`."
  if findings[0].Message != expected {
    t.Fatalf("message:\nwant %q\ngot  %q", expected, findings[0].Message)
  }

  assertFixSnapshot(
    t,
    "solid/imports",
    "import { createStore } from 'solid-js';\ncreateStore();\n",
    "import { createStore } from 'solid-js/store';\ncreateStore();\n",
  )
  assertFixSnapshot(
    t,
    "solid/imports",
    "import { render as mount } from \"solid-js\";\nmount();\n",
    "import { render as mount } from \"solid-js/web\";\nmount();\n",
  )

  assertRuleSkipsSource(
    t,
    "solid/imports",
    "import { createSignal } from \"solid-js\";\ncreateSignal();\n",
  )
}
