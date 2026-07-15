package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactJSXNoUndefDeclarationsCollectedOncePerFile verifies the file's set
// of declared names is built once per file, not once per capitalized JSX tag.
//
// react/jsx-no-undef called `reactExtrasFileHasDeclaration(ctx.File, name)` —
// a full-file walk — for every uppercase tag, so a file with E component
// elements walked the whole file E times (O(E) per file). Collected once into
// a set on the shared per-file table, the walk must run exactly once per file
// and each tag becomes an O(1) membership check, independent of the element
// count.
//
//  1. Build three files with wildly different undeclared-tag counts (50/500/2000).
//  2. Run react/jsx-no-undef over them with the walk counter zeroed.
//  3. Assert the collector ran once per file (== file count), never per tag.
func TestReactJSXNoUndefDeclarationsCollectedOncePerFile(t *testing.T) {
  makeFile := func(name string, tags int) *shimast.SourceFile {
    var sb strings.Builder
    sb.WriteString("const App = () => (\n  <div>\n")
    for i := 0; i < tags; i++ {
      sb.WriteString("    <Missing />\n")
    }
    sb.WriteString("  </div>\n);\nJSON.stringify(App);\n")
    return parseTSXFile(t, name, sb.String())
  }
  files := []*shimast.SourceFile{
    makeFile("/virtual/jsx-scale-a.tsx", 50),
    makeFile("/virtual/jsx-scale-b.tsx", 500),
    makeFile("/virtual/jsx-scale-c.tsx", 2000),
  }
  totalTags := 50 + 500 + 2000

  engine := NewEngine(RuleConfig{"react/jsx-no-undef": SeverityError})
  engine.SetSerial(true)

  reactDeclaredNamesCollectCount.Store(0)
  findings := engine.Run(files, nil)
  if len(findings) == 0 {
    t.Fatalf("expected react/jsx-no-undef to report the undeclared <Missing /> tags")
  }
  if got := reactDeclaredNamesCollectCount.Load(); got != int64(len(files)) {
    t.Fatalf(
      "reactExtrasFileDeclaredNames ran %d times over %d files (%d total JSX tags); want %d — the declaration walk must be O(files), not O(JSX-elements)",
      got, len(files), totalTags, len(files),
    )
  }
}
