package evidence

import (
  "os"
  "path/filepath"
  "reflect"
  "testing"
)

/**
 * Verifies decoded rooted inventories merge physical aliases but not neighbors.
 *
 * @evidence contracts/testing.md#behavioral-verification Preserves the original directory-link, actual-volume case-alias and distinct sale/refund inputs. Actual configured walk/distinctPrismaSources must produce literal one-source or two-source tables. prismaUnitsFromOutcome files literal decoded models into both inventories, with complete model/id tables; shared aliases retain unit identity and citation while distinct files retain their own model.
 * @evidence contracts/testing.md#independent-expectations Literal source/path/unit tables follow the physical fixtures: linked and case-equivalent names denote one file, two separately written schemas denote two. The volume is queried instead of assumed case-insensitive. Pointer equality is required only for shared physical declarations. Authored decoded records establish native input and do not prove parser admission.
 * @evidence contracts/testing.md#distinguishing-cases Three named original cases contrast directory alias, case-only alias and same-relative-name distinct files. Each requires two healthy inventories and full members. The directory-link case retains its scanned citation; the case-only original requires shared model identity. Distinct files must not collapse to the same unit. Hard-linked directory entries remain in their separate decoded fan-out test.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDecodedRootAliasesFollowPhysicalFiles registers synchronous native subtests. t.TempDir owns filesystem inputs; linkDirectory uses os.Symlink on POSIX and the existing cmd.exe junction fixture helper on Windows, solely to create a directory link. Actual link/case capability refusal preserves the original skip boundary. Native walk/scan/materialization starts no Node parser, built artifact, consumer or product host. Original bridge cases remain pending actual survivor execution.
 */
func TestPrismaDecodedRootAliasesFollowPhysicalFiles(t *testing.T) {
  for _, name := range []string{"linked-directory", "case-only-volume", "distinct-files"} {
    t.Run(name, func(t *testing.T) {
      root := t.TempDir()
      if err := os.MkdirAll(filepath.Join(root, "store"), 0o755); err != nil {
        t.Fatal(err)
      }
      schema := "/// @evidence https://example.com/sale\nmodel sale {\n  id String @id\n}\n"
      if name == "distinct-files" {
        schema = "model sale {\n  id String @id\n}\n"
      }
      if err := os.WriteFile(filepath.Join(root, "store", "main.prisma"), []byte(schema), 0o644); err != nil {
        t.Fatal(err)
      }
      second := "mirror"
      wantSources := []string{"mirror/main.prisma"}
      models := []prismaModel{{Name: "sale", Fields: []prismaField{{Name: "id", Symbol: "column"}}}}
      switch name {
      case "linked-directory":
        if err := linkDirectory(t, filepath.Join(root, "store"), filepath.Join(root, "mirror")); err != nil {
          t.Skipf("this environment cannot create a directory link: %v", err)
        }
      case "case-only-volume":
        second = "STORE"
        wantSources = []string{"STORE/main.prisma"}
        if _, err := os.Stat(filepath.Join(root, "STORE", "main.prisma")); err != nil {
          t.Skipf("this volume distinguishes case, so the roots are two directories: %v", err)
        }
      case "distinct-files":
        if err := os.MkdirAll(filepath.Join(root, "mirror"), 0o755); err != nil {
          t.Fatal(err)
        }
        if err := os.WriteFile(filepath.Join(root, "mirror", "main.prisma"), []byte("model refund {\n  id String @id\n}\n"), 0o644); err != nil {
          t.Fatal(err)
        }
        wantSources = []string{"mirror/main.prisma", "store/main.prisma"}
        models = append(models, prismaModel{Name: "refund", Fields: []prismaField{{Name: "id", Symbol: "column"}}})
      }
      config := twoRootedPrismaGraph(t, root)
      if second == "STORE" {
        config = decodeInventoryConfig(t, root, `{"claims":[{
          "type":"typescript","files":["src/**"],"reference":[
            {"type":"prisma","root":"store","files":["**/*.prisma"],"symbol":"model"},
            {"type":"prisma","root":"STORE","files":["**/*.prisma"],"symbol":"model"}
          ]
        }]}`)
      }
      addresses, _, problems := configuredPrismaAddressesWithHealth(config)
      if len(problems) != 0 || len(addresses) != 2 {
        t.Fatalf("both rooted addresses must be healthy: %d, %v", len(addresses), problems)
      }
      set := distinctPrismaSources(root, addresses)
      if !reflect.DeepEqual(set.Sources, wantSources) {
        t.Fatalf("physical file set = %v, want %v", set.Sources, wantSources)
      }
      inventories := map[string]*artifactInventory{}
      for _, address := range addresses {
        inventories[address.Key] = &artifactInventory{Path: address.Display, Type: artifactPrisma}
      }
      if problems := prismaUnitsFromOutcome(root, set, inventories, prismaSetOutcome{Models: models}, config); len(problems) != 0 {
        t.Fatalf("decoded native fan-out must be clean: %v", problems)
      }
      if len(inventories) != 2 || !reflect.DeepEqual(prismaPopulationPaths(inventories), []string{second + "/main.prisma", "store/main.prisma"}) {
        t.Fatalf("both exact rooted inventories must remain: %v", prismaPopulationPaths(inventories))
      }
      store := prismaInventoryAt(t, inventories, "store/main.prisma")
      other := prismaInventoryAt(t, inventories, second+"/main.prisma")
      if store.LoadFailed || other.LoadFailed || len(store.Problems) != 0 || len(other.Problems) != 0 ||
        prismaUnitIndex(store.Units) != "prisma:sale=model\nprisma:sale.id=column" {
        t.Fatalf("store must retain its exact healthy population: %#v", store)
      }
      if name == "distinct-files" {
        if prismaUnitIndex(other.Units) != "prisma:refund=model\nprisma:refund.id=column" || store.Units[0] == other.Units[0] {
          t.Fatalf("distinct file must retain refund identity: %#v", other)
        }
      } else {
        if prismaUnitIndex(other.Units) != "prisma:sale=model\nprisma:sale.id=column" || store.Units[0] != other.Units[0] {
          t.Fatalf("physical aliases must share complete model identity: %#v", other)
        }
        if name == "linked-directory" && (store.Units[0].Path != "mirror/main.prisma" ||
          len(store.Declarations) != 1 || len(other.Declarations) != 1 || store.Declarations[0] != other.Declarations[0]) {
          t.Fatal("directory aliases must share the original citation and canonical mirror location")
        }
      }
    })
  }
}
