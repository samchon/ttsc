package evidence

import (
  "sort"
  "strings"
)

// prismaClaimOf scans one schema, materializes the models it names, and returns
// the declarations and problems a claim over it would see.
//
// The models are supplied rather than parsed, because this is the native half:
// what a schema declares is Prisma's answer, and what a comment cites is this
// scan's. Supplying the population keeps a case about attribution.
func prismaClaimOf(
  content string,
  models []prismaModel,
) ([]*evidenceDeclaration, []string) {
  inventories := map[string]*artifactInventory{
    "prisma/schema.prisma": {
      Path: "prisma/schema.prisma",
      Type: artifactPrisma,
    },
  }
  locations := map[string]prismaLocation{}
  scan := scanPrismaFile("prisma/schema.prisma", content, locations)
  hosts := map[string]*evidenceUnit{}
  for _, model := range models {
    for _, unit := range prismaModelUnits(model) {
      key := joinPrismaIdentity(unit.Identity)
      unit.Path = "prisma/schema.prisma"
      unit.Line = locations[key].Line
      hosts[key] = unit
    }
  }
  problems := prismaDeclarationsFromComments(scan.Comments, hosts, prismaInventoriesByDisplay(inventories), nil)
  declarations := inventories["prisma/schema.prisma"].Declarations
  sort.SliceStable(declarations, func(left int, right int) bool {
    return declarations[left].Line < declarations[right].Line
  })
  return declarations, problemMessages(problems)
}

func prismaDeclarationIndex(declarations []*evidenceDeclaration) string {
  rendered := make([]string, 0, len(declarations))
  for _, declaration := range declarations {
    rendered = append(
      rendered,
      string(declaration.Tag)+"@"+decimal(declaration.Line)+
        " host="+declaration.Hosts.names()+
        " target="+declaration.Target+
        " reason="+declaration.Reason,
    )
  }
  return strings.Join(rendered, "\n")
}

var prismaClaimModels = []prismaModel{{
  Name: "Sale",
  Fields: []prismaField{
    {Name: "price", Symbol: "column"},
    {Name: "seller", Symbol: "relation"},
  },
}}
