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
// elements required E full-file walks. Collected once into
// a set on the shared per-file table, the walk must run exactly once per file
// and each tag uses the cached name set. This count oracle distinguishes collection from element
// population; it does not measure lookup time.
//
//  1. Build three files with wildly different undeclared-tag counts (50/500/2000).
//  2. Run react/jsx-no-undef over them with the walk counter zeroed.
//  3. Assert the collector ran once per file (== file count), never per tag.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify 2550 undeclared JSX tags across three files are reported while the declaration collector runs exactly three times; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Each authored Missing tag lacks a declaration, establishing exact finding count independently; one per-file shared collection is the expected reuse boundary.
// @evidence contracts/testing.md#distinguishing-cases 50, 500 and 2000 tags vary element population without varying the per-file collection count; declared-component tests own binding forms.
// @evidence contracts/testing.md#execution-ownership TestReactJSXNoUndefDeclarationsCollectedOncePerFile is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
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

  previousCount := reactDeclaredNamesCollectCount.Swap(0)
  defer reactDeclaredNamesCollectCount.Store(previousCount)
  findings := engine.Run(files, nil)
  if err := validateSemanticRuleFindings(RuleConfig{"react/jsx-no-undef": SeverityError}, findings); err != nil {
    t.Fatalf("invalid undeclared-component findings: %v", err)
  }
  if len(findings) != totalTags {
    t.Fatalf("expected react/jsx-no-undef to report the undeclared <Missing /> tags")
  }
  if got := reactDeclaredNamesCollectCount.Load(); got != int64(len(files)) {
    t.Fatalf(
      "reactExtrasFileDeclaredNames ran %d times over %d files (%d total JSX tags); want %d — the declaration walk must be O(files), not O(JSX-elements)",
      got, len(files), totalTags, len(files),
    )
  }
}
