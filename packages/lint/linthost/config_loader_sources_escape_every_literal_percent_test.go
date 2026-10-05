package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
)

// TestConfigLoaderSourcesEscapeEveryLiteralPercent verifies generated loader syntax
// and the URL-separator guard survive Go format-string expansion.
//
// A malformed format verb can still produce parseable JavaScript while changing
// the guard's meaning. The exact generated guard and parser diagnostics therefore
// cover different defects; a quote counter cannot establish JavaScript syntax.
//
// 1. Generate the CommonJS and TypeScript loader sources.
// 2. Reject Go formatting artifacts and a changed encoded-separator guard.
// 3. Parse each complete script using its JavaScript or TypeScript grammar and require no syntax diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Calls both loader-source generators and checks their emitted scripts, preserving the URL guard while detecting formatting artifacts and actual syntax errors rather than repository source layout.
// @evidence contracts/testing.md#independent-expectations The authored `/%2f|%5c/i.test(target)` literal independently requires both encoded-separator percent signs to survive generation. The TypeScript-Go parser checks complete emitted syntax against a deliberately malformed string control without reproducing either generator's formatting. This unit does not execute the guard or certify runtime URL resolution and every generated token's meaning.
// @evidence contracts/testing.md#distinguishing-cases CommonJS and TypeScript loader variants both retain their complete emitted source checks; a deliberately unterminated JavaScript string also proves the parser oracle rejects the malformed boundary that a valid script must avoid.
// @evidence contracts/testing.md#execution-ownership TestConfigLoaderSourcesEscapeEveryLiteralPercent is a Go unit entry calling generators and the parser in the selected lint test process; it creates no consumer installation, native binary or script host. Actual executable config evaluation belongs to the config E2E batch.
func TestConfigLoaderSourcesEscapeEveryLiteralPercent(t *testing.T) {
  malformed := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{FileName: "/virtual/malformed.js"},
    "const value = \"unterminated\n",
    shimcore.ScriptKindJS,
  )
  if malformed == nil || len(malformed.Diagnostics()) == 0 {
    t.Fatal("parser oracle accepted an unterminated JavaScript string")
  }
  for _, generated := range []struct {
    name   string
    source string
    kind   shimcore.ScriptKind
  }{
    {name: "script", source: scriptConfigLoaderSource(), kind: shimcore.ScriptKindJS},
    {
      name: "typescript",
      kind: shimcore.ScriptKindTS,
      source: typeScriptConfigLoaderSource(
        `"file:///lint.config.ts"`,
        `"/tmp/ttsc-lint/result.json"`,
        `"/tmp/ttsc-lint"`,
      ),
    },
  } {
    if index := strings.Index(generated.source, "%!"); index != -1 {
      end := index + 64
      if end > len(generated.source) {
        end = len(generated.source)
      }
      t.Fatalf(
        "%s loader source carries a Go formatting artifact: %q",
        generated.name,
        generated.source[index:end],
      )
    }
    if !strings.Contains(generated.source, `/%2f|%5c/i.test(target)`) {
      t.Fatalf(
        "%s loader source lost Node's encoded separator guard",
        generated.name,
      )
    }
    parsed := shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{FileName: "/virtual/" + generated.name + map[shimcore.ScriptKind]string{shimcore.ScriptKindJS: ".js", shimcore.ScriptKindTS: ".ts"}[generated.kind]},
      generated.source,
      generated.kind,
    )
    if parsed == nil {
      t.Fatalf("%s loader parser returned no source file", generated.name)
    }
    if diagnostics := parsed.Diagnostics(); len(diagnostics) != 0 {
      t.Fatalf("%s loader source has syntax diagnostics: %+v", generated.name, diagnostics)
    }
  }
}
