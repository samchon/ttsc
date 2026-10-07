package evidence

import (
  "github.com/samchon/ttsc/packages/lint/rule"
  "testing"
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
 *
 * @evidence contracts/testing.md#behavioral-verification Two runs of runIndexRuleAtSeverity (error outer) over a cited, satisfied requirement and a warning-level Markdown reference rooted at the nonexistent `missing`: without a second owner the single source failure must be reported at warning, and with an additional error-level reference of the same missing root it must still be a single finding but at error.
 * @evidence contracts/testing.md#independent-expectations The expected levels are authored from the severity contract: loaders merge populations, but an unrelated error reference must not promote a warning-owned failure, while a shared failed root keeps the strongest owning level and is reported once.
 * @evidence contracts/testing.md#distinguishing-cases The not-shared and shared cases over the same failing root; the exactly-one-finding check in both runs separates deduplication from duplication.
 * @evidence contracts/testing.md#execution-ownership TestGraphSeverityScopesSourceFailures is a Go unit entry in the native test process that loops over two cases (not named subtests); runIndexRuleAtSeverity writes the fixtures to a temp directory and calls the graph rule with a captured reporter, with no consumer install or product host.
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
