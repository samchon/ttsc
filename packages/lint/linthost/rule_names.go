package linthost

import "strings"

// normalizeBuiltinRuleName strips standard ESLint namespace prefixes while
// leaving @ttsc/lint's canonical kebab/slash rule IDs intact.
func normalizeBuiltinRuleName(name string) string {
  name = strings.TrimSpace(name)
  name = strings.TrimPrefix(name, "@typescript-eslint/")
  name = strings.TrimPrefix(name, "typescript-eslint/")
  name = strings.TrimPrefix(name, "eslint/")
  return name
}
