package evidence

import (
  "testing"
)

// unreadableTagConfig selects the variables a destructuring pattern declares,
// so the shapes below are inside a population rather than beside one.
const unreadableTagConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":"property",
  "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
}]}`

// runUnreadableRule evaluates one source file against a Markdown section that
// the file's first declarator acknowledges.
//
// The acknowledgement is there so the obligation is discharged and the only
// diagnostics left are the ones a case is about. Without it every case would
// also carry a coverage finding, and an assertion that counts diagnostics could
// not tell the two apart.
func runUnreadableRule(t *testing.T, source string) []string {
  t.Helper()
  return runIndexRule(t, map[string]string{
    "docs/spec.md":     "## Pricing {#pricing}\n",
    "src/contracts.ts": source,
  }, unreadableTagConfig)
}
