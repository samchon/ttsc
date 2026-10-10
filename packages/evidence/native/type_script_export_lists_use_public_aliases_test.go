package evidence

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "path/filepath"
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies local export lists and aliases use the public export identity.
 *
 * An exported contract need not carry an `export` modifier on its declaration.
 * When `export { Local as Public }` exposes it, evidence targets must use the
 * public name; a type-only export must not expose runtime callable behavior.
 *
 *  1. Export local type, function, class, and namespace declarations by alias.
 *  2. Export a second function through `export type` only.
 *  3. Assert public aliases materialize and local/runtime-only names do not.
 *
 * @evidence contracts/testing.md#behavioral-verification scanTypeScriptInventory exercises the authored fixture. Assert public aliases materialize and local/runtime-only names do not.
 * @evidence contracts/testing.md#independent-expectations An exported contract need not carry an `export` modifier on its declaration. When `export { Local as Public }` exposes it, evidence targets must use the public name; a type-only export must not expose runtime callable behavior. The authored scenario requires this outcome: Assert public aliases materialize and local/runtime-only names do not.
 * @evidence contracts/testing.md#distinguishing-cases Export local type, function, class, and namespace declarations by alias. Export a second function through `export type` only. Assert public aliases materialize and local/runtime-only names do not.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptExportListsUsePublicAliases runs as a Go unit entry in the native package. scanTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptExportListsUsePublicAliases(t *testing.T) {
  source := `
interface LocalType {
  field: string;
}
const localFunction = (): void => {};
const typeOnlyFunction = (): void => {};
const localValue = 1;
class LocalClass {
  run(): void {}
}
namespace LocalNamespace {
  export const act = (): void => {};
}
export {
  LocalType as PublicType,
  localFunction as publicFunction,
  localValue as publicValue,
  LocalClass as PublicClass,
  LocalNamespace as PublicNamespace,
};
export type {
  LocalType as TypeOnlyPublicType,
  typeOnlyFunction as TypeOnlyFunction,
};
`
  absolute := shimtspath.RootedFilePathFromAbsolute(filepath.Join(t.TempDir(), "exports.ts"))
  file := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{FileName: absolute},
    source,
    shimcore.ScriptKindTS,
  )
  inventory := scanTypeScriptInventory("src/exports.ts", file)
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.Target)
  }
  sort.Strings(targets)
  want := []string{
    "PublicClass",
    "PublicClass.prototype.run",
    "PublicNamespace",
    "PublicNamespace.act",
    "PublicType",
    "PublicType.field",
    "TypeOnlyPublicType",
    "TypeOnlyPublicType.field",
    "publicFunction",
    "publicValue",
  }
  sort.Strings(want)
  if strings.Join(targets, "\n") != strings.Join(want, "\n") {
    t.Fatalf("export-list targets:\n%s\nwant:\n%s", strings.Join(targets, "\n"), strings.Join(want, "\n"))
  }
}
