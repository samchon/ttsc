package linthost

import "testing"

// TestFixSolidImportsRewritesSoleSpecifierModule verifies `solid/imports`
// names the canonical module it already computed and rewrites the specifier
// when that rewrite moves nothing else.
//
// The rule obtains the supported entry point from `solidPreferredSource`.
// The independently authored message must name both the symbol and module.
//
// This case owns the narrowest repair: a declaration whose sole binding is the
// misplaced specifier is fixed by rewriting the module specifier, moving no
// other text. The shapes that need the specifier cut out and relocated are
// pinned by `solid_imports_relocates_a_misrouted_specifier_test.go` rather than
// this sole-binding test. No installed Solid execution is asserted here.
//
//  1. Fix `import { render } from "solid-js"`, whose sole binding belongs to
//     `solid-js/web`, and assert the module is rewritten and the message names
//     the symbol and the module.
//  2. Assert an aliased specifier still resolves from its imported name, and a
//     single-quoted specifier keeps its quotes, proving only source text inside
//     the quotes is replaced.
//  3. Assert an already-canonical import reports nothing at all.
//
// @evidence contracts/testing.md#behavioral-verification solid/imports rewrites sole render/createStore module specifiers while preserving quotes and aliases, and names the canonical render module.
// @evidence contracts/testing.md#independent-expectations Literal solid-js/web and solid-js/store outputs plus the exact Import render message independently specify the supported entry points.
// @evidence contracts/testing.md#distinguishing-cases Single-quoted createStore and aliased render must fix; already-canonical createSignal is silent. Relocation of mixed/default bindings is owned by the separate relocation test.
// @evidence contracts/testing.md#execution-ownership TestFixSolidImportsRewritesSoleSpecifierModule owns the three disk rewrites, explicit runRuleFindingsSnapshot message check and zero-finding canonical control.
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
