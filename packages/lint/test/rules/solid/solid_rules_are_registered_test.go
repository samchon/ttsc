package linthost

import "testing"

/**
 * Verifies solid rule family: registers the 20 diagnostic-producing rule ids.
 *
 * Locks the public `solid/*` rule surface before individual behavior tests cover
 * representative AST-only patterns. A missing registration would make user
 * configs report an unknown rule instead of running the native lint pass.
 *
 * 1. List every diagnostic-producing rule supported from eslint-plugin-solid.
 * 2. Look up each `solid/*` id in the native registry.
 * 3. Assert every rule exists.
 */
func TestSolidRulesAreRegistered(t *testing.T) {
  names := []string{
    "components-return-once",
    "event-handlers",
    "imports",
    "jsx-no-duplicate-props",
    "jsx-no-script-url",
    "jsx-no-undef",
    "no-array-handlers",
    "no-destructure",
    "no-innerhtml",
    "no-proxy-apis",
    "no-react-deps",
    "no-react-specific-props",
    "no-unknown-namespaces",
    "prefer-classlist",
    "prefer-for",
    "prefer-show",
    "reactivity",
    "self-closing-comp",
    "style-prop",
    "validate-jsx-nesting",
  }
  for _, name := range names {
    if LookupRule("solid/"+name) == nil {
      t.Fatalf("missing solid/%s", name)
    }
  }
}
