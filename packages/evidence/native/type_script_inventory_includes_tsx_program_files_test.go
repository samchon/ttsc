package evidence

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  "path/filepath"
  "testing"
)

/**
 * Verifies every TypeScript-family extension in the public artifact boundary is
 * eligible when the compiler Program supplies it, including TSX.
 *
 * The Program, rather than a filesystem crawl, owns TypeScript availability.
 * An extension filter that accidentally recognizes only `.ts` would make a
 * valid exported callable disappear even though ttsc parsed the file.
 *
 *  1. Parse a TSX Program entry containing an exported arrow component.
 *  2. Load TypeScript inventories from that Program.
 *  3. Assert the TSX path and callable unit are present.
 *
 * @evidence contracts/testing.md#behavioral-verification loadTypeScriptInventories exercises the authored fixture. Assert the TSX path and callable unit are present.
 * @evidence contracts/testing.md#independent-expectations The Program, rather than a filesystem crawl, owns TypeScript availability. An extension filter that accidentally recognizes only `.ts` would make a valid exported callable disappear even though ttsc parsed the file. The authored scenario requires this outcome: Assert the TSX path and callable unit are present.
 * @evidence contracts/testing.md#distinguishing-cases Parse a TSX Program entry containing an exported arrow component. Load TypeScript inventories from that Program. Assert the TSX path and callable unit are present.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptInventoryIncludesTSXProgramFiles runs as a Go unit entry in the native package. loadTypeScriptInventories executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptInventoryIncludesTSXProgramFiles(t *testing.T) {
  root := t.TempDir()
  file := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{
      FileName: filepath.ToSlash(filepath.Join(root, "view.tsx")),
    },
    "export const View = () => <div />;",
    shimcore.ScriptKindTSX,
  )
  inventory := loadTypeScriptInventories(
    root,
    []*shimast.SourceFile{file},
    anchoredGraph(root, graphConfig{Claims: []claimSpec{{
      Type: artifactTypeScript,
    }}}),
  )["view.tsx"]
  if inventory == nil {
    t.Fatal("TSX Program file was not indexed")
  }
  if len(inventory.Units) != 1 ||
    inventory.Units[0].Symbol != "function" ||
    inventory.Units[0].Target != "View" {
    t.Fatalf("TSX callable inventory = %+v", inventory.Units)
  }
}
