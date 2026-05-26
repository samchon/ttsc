package linthost

import "strings"

// normalizeBuiltinRuleName strips the optional `eslint/` namespace prefix
// so users may write either the bare rule id or the explicit `eslint/<id>`
// form. `@ttsc/lint` deliberately rejects the legacy `@typescript-eslint/`
// and `typescript-eslint/` prefixes — TypeScript-only rules live under
// the canonical `typescript/<id>` namespace.
func normalizeBuiltinRuleName(name string) string {
  name = strings.TrimSpace(name)
  name = strings.TrimPrefix(name, "eslint/")
  return name
}
