package evidence

import (
  "sort"
  "strings"
  "testing"
)

// prismaBridgeUnits parses one schema through the real bridge and renders its
// units as `target=symbol`, so a case can assert the whole classification at
// once instead of reaching through the payload.
func prismaBridgeUnits(t *testing.T, schema string) string {
  t.Helper()
  root := prismaBridgeRoot(t, map[string]string{"prisma/schema.prisma": schema})
  result, err := normalizePrismaSet(root, []string{"prisma/schema.prisma"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 1 {
    t.Fatalf("expected one parsed set, got problems %v", result.Problems)
  }
  rendered := []string{}
  for _, model := range result.Documents[0].Models {
    for _, unit := range prismaModelUnits(model) {
      rendered = append(rendered, unit.Target+"="+unit.Symbol)
    }
  }
  sort.Strings(rendered)
  return strings.Join(rendered, "\n")
}
