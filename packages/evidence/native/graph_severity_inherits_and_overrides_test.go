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
