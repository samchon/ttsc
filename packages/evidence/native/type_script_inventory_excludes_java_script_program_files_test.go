package evidence

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  "path/filepath"
  "testing"
)

/**
 * Verifies the TypeScript artifact discriminator does not absorb JavaScript
 * files merely because `allowJs` placed them in the compiler Program.
 *
 * SourceFile ASTs can represent both languages, but the public variant is
 * explicitly `"typescript"`. Its file inventory therefore accepts TypeScript
 * extensions and leaves JavaScript for a future artifact variant.
 *
 *  1. Parse equivalent `.ts` and `.js` source files under one project root.
 *  2. Build the TypeScript inventory from both Program entries.
 *  3. Assert only the TypeScript path is available to globs.
 *
 * @evidence contracts/testing.md#behavioral-verification loadTypeScriptInventories exercises the authored fixture. Assert only the TypeScript path is available to globs.
 * @evidence contracts/testing.md#independent-expectations SourceFile ASTs can represent both languages, but the public variant is explicitly `"typescript"`. Its file inventory therefore accepts TypeScript extensions and leaves JavaScript for a future artifact variant. The authored scenario requires this outcome: Assert only the TypeScript path is available to globs.
 * @evidence contracts/testing.md#distinguishing-cases Parse equivalent `.ts` and `.js` source files under one project root. Build the TypeScript inventory from both Program entries. Assert only the TypeScript path is available to globs.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptInventoryExcludesJavaScriptProgramFiles runs as a Go unit entry in the native package. loadTypeScriptInventories executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptInventoryExcludesJavaScriptProgramFiles(t *testing.T) {
  root := t.TempDir()
  parse := func(name string, kind shimcore.ScriptKind) *shimast.SourceFile {
    return shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{
        FileName: shimtspath.RootedFilePathFromAbsolute(filepath.Join(root, name)),
      },
      "export function run(): void {}",
      kind,
    )
  }
  inventories := loadTypeScriptInventories(
    root,
    []*shimast.SourceFile{
      parse("api.ts", shimcore.ScriptKindTS),
      parse("api.js", shimcore.ScriptKindJS),
    },
    anchoredGraph(root, graphConfig{Claims: []claimSpec{{
      Type: artifactTypeScript,
    }}}),
  )
  if inventories["api.ts"] == nil {
    t.Fatal("TypeScript Program file was not indexed")
  }
  if inventories["api.js"] != nil {
    t.Fatal("JavaScript Program file entered the TypeScript artifact inventory")
  }
}
