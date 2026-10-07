package linthost

import (
  "encoding/json"
  "testing"

  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type unicornIsolatedFunctionsFinding struct {
  line    int
  target  string
  message string
}

// runUnicornIsolatedFunctions lints one source through the checker-backed
// snapshot path and normalizes findings to (line, reported text, message).
// The engine order is preserved: the rule emits position-sorted problems, and
// equal positions keep the upstream inner-function-first report order.
func runUnicornIsolatedFunctions(t *testing.T, source string, optionsJSON string) []unicornIsolatedFunctionsFinding {
  t.Helper()
  var options json.RawMessage
  if optionsJSON != "" {
    options = json.RawMessage(optionsJSON)
  }
  _, _, findings := runRuleFindingsSnapshot(t, "unicorn/isolated-functions", source, options)
  normalized := make([]unicornIsolatedFunctionsFinding, 0, len(findings))
  for _, finding := range findings {
    if finding.Rule != "unicorn/isolated-functions" {
      t.Fatalf("unexpected rule in unicorn/isolated-functions findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("unicorn/isolated-functions must not offer edits: %+v", finding)
    }
    if finding.Pos < 0 || finding.End < finding.Pos || finding.End > len(source) {
      t.Fatalf("unicorn/isolated-functions returned an invalid source range: %+v", finding)
    }
    normalized = append(normalized, unicornIsolatedFunctionsFinding{
      line:    shimscanner.GetECMALineOfPosition(finding.File, finding.Pos) + 1,
      target:  source[finding.Pos:finding.End],
      message: finding.Message,
    })
  }
  return normalized
}

func assertUnicornIsolatedFunctionsFindings(
  t *testing.T,
  got []unicornIsolatedFunctionsFinding,
  want ...unicornIsolatedFunctionsFinding,
) {
  t.Helper()
  if len(got) != len(want) {
    t.Fatalf("unicorn/isolated-functions finding count mismatch:\nwant=%+v\ngot =%+v", want, got)
  }
  for index := range want {
    if got[index] != want[index] {
      t.Fatalf("unicorn/isolated-functions finding[%d] mismatch:\nwant=%+v\ngot =%+v\nall =%+v",
        index, want[index], got[index], got)
    }
  }
}

// unicornIsolatedFunctionsVariableMessage builds the externally-scoped
// diagnostic exactly as upstream interpolates it.
func unicornIsolatedFunctionsVariableMessage(name, reason string) string {
  return "Variable " + name + " not defined in scope of isolated function. Function is isolated because: " + reason + "."
}

func unicornIsolatedFunctionsThisMessage(reason string) string {
  return "Unexpected `this` in isolated function. Function is isolated because: " + reason + "."
}

func unicornIsolatedFunctionsSuperMessage(reason string) string {
  return "Unexpected `super` in isolated function. Function is isolated because: " + reason + "."
}
