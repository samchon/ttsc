package evidence

import (
  "sort"
  "strings"
  "testing"
)

// reportedLines lists every unit of one file as `target:line`, sorted, which is
// the whole answer rather than the one row a case is about. A position rule
// that fixes one form by moving another is a repair only for the form it was
// written against.
func reportedLines(t *testing.T, content string) []string {
  t.Helper()
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", content)
  rows := []string{}
  for _, unit := range inventory.Units {
    rows = append(rows, unit.Target+":"+decimal(unit.Line))
  }
  sort.Strings(rows)
  return rows
}

func assertReportedLines(t *testing.T, content string, want []string) {
  t.Helper()
  rows := reportedLines(t, content)
  if strings.Join(rows, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "reported lines:\n%s\nwant:\n%s",
      strings.Join(rows, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
