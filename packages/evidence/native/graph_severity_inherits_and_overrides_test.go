package evidence

import (
  "encoding/json"
  "fmt"
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies severity inheritance and explicit overrides through graph evaluation.
 *
 * An off value must differ from an omitted one, and a warning must stay a
 * warning even when the enclosing rule fails on errors by default.
 *
 * 1. Evaluate every outer, claim, and reference severity combination.
 * 2. Leave one selected requirement uncited.
 * 3. Assert the effective level, or complete silence for a disabled population.
 *
 * @evidence contracts/testing.md#behavioral-verification For each outer severity (warning, error) and each of four claim-level and four reference-level settings (omitted, off, warning, error) a t.Run subtest marshals a typescript claim with a markdown reference, runs runIndexRuleAtSeverity over one uncited requirement, and requires either no message and no failure for an effective off, or exactly one finding at the effective level with the reporter failed.
 * @evidence contracts/testing.md#independent-expectations The expected level is recomputed in the test from the contract: the innermost explicit setting wins, a claim-level `off` disables the population, and an omitted level inherits the outer severity; this inheritance logic is written independently of the rule, but it is a model of the contract rather than a table of literals.
 * @evidence contracts/testing.md#distinguishing-cases Thirty-two named combinations, including `off` against omitted and a warning beneath an error-by-default rule, so an off that behaved like inheritance or a warning promoted to an error would fail the specific row.
 * @evidence contracts/testing.md#execution-ownership TestGraphSeverityInheritsAndOverrides is a Go unit entry in the native test process that owns thirty-two t.Run subtests; each calls runIndexRuleAtSeverity (graph rule over a temp directory) with a captured reporter, with no consumer install or product host.
 */
func TestGraphSeverityInheritsAndOverrides(t *testing.T) {
  levels := []string{"", "off", "warning", "error"}
  for _, outer := range []rule.Severity{rule.SeverityWarn, rule.SeverityError} {
    for _, claimLevel := range levels {
      for _, referenceLevel := range levels {
        t.Run(fmt.Sprintf("%d/%s/%s", outer, claimLevel, referenceLevel), func(t *testing.T) {
          reference := map[string]any{"type": "markdown", "files": []string{"docs/spec.md"}, "symbol": "h2"}
          claim := map[string]any{"type": "typescript", "files": []string{"src/**"}, "symbol": "type", "reference": reference}
          want := outer
          for _, entry := range []struct {
            object map[string]any
            level  string
          }{{claim, claimLevel}, {reference, referenceLevel}} {
            if entry.level != "" {
              entry.object["severity"] = entry.level
              switch entry.level {
              case "off":
                want = rule.SeverityOff
              case "warning":
                want = rule.SeverityWarn
              case "error":
                want = rule.SeverityError
              }
            }
          }
          if claimLevel == "off" {
            want = rule.SeverityOff
          }
          raw, err := json.Marshal(map[string]any{"claims": []any{claim}})
          if err != nil {
            t.Fatal(err)
          }
          reporter := runIndexRuleAtSeverity(t, t.TempDir(), map[string]string{
            "src/contract.ts": "export interface IContract {}\n",
            "docs/spec.md":    "## Requirement {#requirement}\n",
          }, string(raw), outer)
          if want == rule.SeverityOff {
            if len(reporter.messages) != 0 || reporter.failed {
              t.Fatalf("off population reported: %v", reporter.messages)
            }
          } else if len(reporter.findings) != 1 || reporter.findings[0].Severity != want || !reporter.failed {
            t.Fatalf("want one finding at %v and failed graph state, got %#v", want, reporter)
          }
        })
      }
    }
  }
}
