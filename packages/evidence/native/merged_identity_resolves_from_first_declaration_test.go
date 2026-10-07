package evidence

import (
  "sort"
  "strings"
  "testing"
)

const mergedIdentityGraphConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":["type","function","property"],
  "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
}]}`

const mergedIdentityReferenceConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/claim.ts"],
  "symbol":"type",
  "reference":{"type":"typescript","files":["src/subject.ts"],"symbol":"type"}
}]}`

// assertMergeFoundedAtLineTwo pins one class-and-namespace merge whose namespace
// half comes first.
//
// The exact `symbol:target` set is asserted rather than a lookup by target
// alone, so a regression that emitted `Sale` under another kind, or emitted a
// second `Sale` unit beside it, fails here rather than passing a test whose
// message still claims to check the type unit.
func assertMergeFoundedAtLineTwo(
  t *testing.T,
  path string,
  source string,
  want []string,
  descendants []string,
) {
  t.Helper()
  inventory := parseTypeScriptInventory(t, path, source)
  units := []string{}
  byTarget := map[string]*evidenceUnit{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
    byTarget[unit.Target] = unit
  }
  sort.Strings(units)
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "merged identity units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
  class := byTarget["Sale"]
  if class.Line != 2 {
    t.Fatalf("the type unit 'Sale' must be the namespace at line 2, got %d", class.Line)
  }
  for _, target := range descendants {
    if byTarget[target].ParentID != class.ID {
      t.Fatalf(
        "%s must hang below the merged identity, got parent %q",
        target,
        byTarget[target].ParentID,
      )
    }
  }
}
