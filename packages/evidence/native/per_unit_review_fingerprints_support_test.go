package evidence

import (
  "strings"
  "testing"
)

// prismaFieldDigests reads one parsed set's model and field digests through the
// real bridge, keyed by target.
func prismaFieldDigests(t *testing.T, schema string) map[string]string {
  t.Helper()
  root := prismaBridgeRoot(t, map[string]string{"prisma/schema.prisma": schema})
  result, err := normalizePrismaSet(root, []string{"prisma/schema.prisma"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 1 {
    t.Fatalf("expected one parsed set, got %d (%v)", len(result.Documents), result.Problems)
  }
  digests := map[string]string{}
  for _, model := range result.Documents[0].Models {
    digests[model.Name] = model.Digest
    for _, field := range model.Fields {
      digests[model.Name+"."+field.Name] = field.Digest
    }
  }
  return digests
}

// prismaScopeOf composes a model's scope fingerprint from exactly the units one
// parse produced.
//
// Built from the digests in hand rather than from a fixed list, because a fixed
// list makes the two sides differ only in one unit's digest and never in how
// many units there are. That is not the composition production performs, and a
// regression in which a new field materializes no unit at all would leave a
// fixed-list assertion green.
func prismaScopeOf(digests map[string]string) string {
  units := []*evidenceUnit{}
  for target, digest := range digests {
    unit := &evidenceUnit{
      ID:     "prisma:" + target,
      Target: "prisma:" + target,
      Symbol: "model",
      Digest: digest,
    }
    if owner, member, split := strings.Cut(target, "."); split {
      unit.ParentID = "prisma:" + owner
      unit.Symbol = "column"
      _ = member
    }
    units = append(units, unit)
  }
  return newScopeIndex(units).fingerprint("prisma:Sale")
}
