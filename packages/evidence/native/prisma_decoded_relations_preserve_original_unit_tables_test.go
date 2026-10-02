package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies decoded relation fields retain the original complete native tables.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls prismaModelUnits on literal User/Order/line and Post/Category decoded payloads, then compares every sorted target/kind with the original bridge expectation. Scalars stay columns and all relation fields stay relations, with no extra implicit join member. Each member additionally retains its model ParentID.
 * @evidence contracts/testing.md#independent-expectations Exact original target/kind tables and model parent IDs are authored from the declarations. Decoded field symbols are deliberately supplied inputs: this owns their native transfer and hierarchy, not classification of optional/list/Cascade/SetNull syntax by the parser. The separate source units preserve those exact schemas and classification expectations.
 * @evidence contracts/testing.md#distinguishing-cases The three-model explicit relation table includes foreign-key columns beside relation fields; the implicit two-model table contains no authored foreign-key/join field. Complete equality rejects omitted or added native obligations. Empty/hidden/invalid-name admission is complementary native coverage, not inferred from these valid tables.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDecodedRelationsPreserveOriginalUnitTables is one selectable native Go entry with two synchronous named cases. Literal decoded records and maintained prismaModelUnits run in-process without schema fixtures, parser bridge, Node child, artifact build, installation or product host. Actual source/JSON/native interoperability remains separately pending and original bridge entries are retained.
 */
func TestPrismaDecodedRelationsPreserveOriginalUnitTables(t *testing.T) {
  for _, scenario := range []struct {
    name string
    models []prismaModel
    want string
  }{
    {name: "explicit-relation-spellings", models: []prismaModel{
      {Name: "User", Fields: []prismaField{{Name: "id", Symbol: "column"}, {Name: "orders", Symbol: "relation"}}},
      {Name: "Order", Fields: []prismaField{{Name: "id", Symbol: "column"}, {Name: "owner_id", Symbol: "column"}, {Name: "owner", Symbol: "relation"}, {Name: "lines", Symbol: "relation"}}},
      {Name: "line", Fields: []prismaField{{Name: "id", Symbol: "column"}, {Name: "order_id", Symbol: "column"}, {Name: "order", Symbol: "relation"}}},
    }, want: "prisma:Order.id=column\nprisma:Order.lines=relation\nprisma:Order.owner=relation\nprisma:Order.owner_id=column\nprisma:Order=model\nprisma:User.id=column\nprisma:User.orders=relation\nprisma:User=model\nprisma:line.id=column\nprisma:line.order=relation\nprisma:line.order_id=column\nprisma:line=model"},
    {name: "implicit-many-to-many", models: []prismaModel{
      {Name: "Post", Fields: []prismaField{{Name: "id", Symbol: "column"}, {Name: "categories", Symbol: "relation"}}},
      {Name: "Category", Fields: []prismaField{{Name: "id", Symbol: "column"}, {Name: "posts", Symbol: "relation"}}},
    }, want: "prisma:Category.id=column\nprisma:Category.posts=relation\nprisma:Category=model\nprisma:Post.categories=relation\nprisma:Post.id=column\nprisma:Post=model"},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      rendered := []string{}
      for _, model := range scenario.models {
        for _, unit := range prismaModelUnits(model) {
          rendered = append(rendered, unit.Target+"="+unit.Symbol)
          expectedParent := "prisma:" + model.Name
          if unit.Symbol == "model" {
            expectedParent = ""
          }
          if unit.ParentID != expectedParent {
            t.Errorf("%s parent %q, want %q", unit.Target, unit.ParentID, expectedParent)
          }
        }
      }
      sort.Strings(rendered)
      if got := strings.Join(rendered, "\n"); got != scenario.want {
        t.Fatalf("native table:\n%s\nwant:\n%s", got, scenario.want)
      }
    })
  }
}
