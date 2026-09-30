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
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtSeverity exercises this case: Verifies source failures keep the severity of their owning populations. The original assertions check assert the failure is deduplicated at the strongest owning level.
 * @evidence contracts/testing.md#independent-expectations Loaders merge populations for efficiency. An unrelated error reference must not promote a warning source failure, while a shared failure keeps an error when any population reading that source requires it. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Load missing Markdown roots beside a healthy error population. Repeat with a second owner of the same failed root at error level. Assert the failure is deduplicated at the strongest owning level. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphSeverityScopesSourceFailures is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises runIndexRuleAtSeverity within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
