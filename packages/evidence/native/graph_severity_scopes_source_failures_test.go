package evidence

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies source failures keep the severity of their owning populations.
 *
 * Loaders merge populations for efficiency. An unrelated error reference must
 * not promote a warning source failure, while a shared failure keeps an error
 * when any population reading that source requires it.
 *
 * 1. Load missing Markdown roots beside a healthy error population.
 * 2. Repeat with a second owner of the same failed root at error level.
 * 3. Assert the failure is deduplicated at the strongest owning level.
 */
func TestGraphSeverityScopesSourceFailures(t *testing.T) {
  for _, shared := range []bool{false, true} {
    extra := ""
    want := rule.SeverityWarn
    if shared {
      extra = `,{"type":"markdown","root":"missing","files":["**"],"severity":"error"}`
      want = rule.SeverityError
    }
    reporter := runIndexRuleAtSeverity(t, t.TempDir(), map[string]string{
      "src/contract.ts": "/** @evidence docs/spec.md#requirement Implements the requirement. */\nexport interface IContract {}\n",
      "docs/spec.md":    "## Requirement {#requirement}\n",
    }, `{"claims":[{"type":"typescript","files":["src/**"],"symbol":"type","reference":[
      {"type":"markdown","root":"missing","files":["**"],"severity":"warning"},
      {"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}`+extra+`
    ]}]}`, rule.SeverityError)
    if len(reporter.findings) != 1 || reporter.findings[0].Severity != want {
      t.Fatalf("shared=%v: want one source failure at %v, got %#v", shared, want, reporter.findings)
    }
  }
}
