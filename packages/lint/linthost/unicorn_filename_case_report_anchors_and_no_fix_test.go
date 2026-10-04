package linthost

import (
  "strings"
  "testing"
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestUnicornFilenameCaseReportAnchorsAndNoFix verifies where the file-level
// diagnostic lands and that it never carries automatic edits.
//
// The native host anchors on the file's first statement so diagnostic output
// and the corpus `// expect:` convention
// point at real source, falling back to offset 0 for statement-less files.
// Renaming a file is not expressible as a text edit, so findings must carry
// neither fixes nor suggestions.
//
// 1. Lint a file whose first statement follows a comment block.
// 2. Lint a comment-only file.
// 3. Assert anchor offsets and the absence of Fix/Suggestions.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution checks where filename errors are anchored and requires no automatic edits or suggestions for the diagnosed path.
// @evidence contracts/testing.md#independent-expectations A filename diagnostic cannot safely rename a source through source-text edits; authored zero-position/range and diagnostic expectations establish that contract independently.
// @evidence contracts/testing.md#distinguishing-cases Statement-bearing and comment-only file shapes retain their anchor assertions, while filename transformations remain diagnostic-only.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseReportAnchorsAndNoFix owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseReportAnchorsAndNoFix(t *testing.T) {
  engine := NewEngine(RuleConfig{unicornFilenameCaseRuleName: SeverityError})
  engine.SetCurrentDirectory(unicornFilenameCaseTestRoot)
  source := "// leading comment\nexport const value = 1;\n"
  file := parseTSFile(t, unicornFilenameCaseTestRoot+"/src/foo_bar.ts", source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornFilenameCaseRuleName, findings)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d", len(findings))
  }
  if want := strings.Index(source, "export"); findings[0].Pos != want {
    t.Fatalf("finding anchor: want offset %d (first statement), got %d", want, findings[0].Pos)
  }
  if len(findings[0].Fix) != 0 || len(findings[0].Suggestions) != 0 {
    t.Fatalf("filename findings must not carry edits, got %+v", findings[0])
  }

  commentOnly := parseTSFile(
    t,
    unicornFilenameCaseTestRoot+"/src/foo_baz.ts",
    "// only a comment\n",
  )
  findings = engine.Run([]*shimast.SourceFile{commentOnly}, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornFilenameCaseRuleName, findings)
  if len(findings) != 1 {
    t.Fatalf("comment-only file: want one finding, got %d", len(findings))
  }
  if findings[0].Pos != 0 {
    t.Fatalf("comment-only file: want offset 0, got %d", findings[0].Pos)
  }
  if len(findings[0].Fix) != 0 || len(findings[0].Suggestions) != 0 {
    t.Fatalf("comment-only filename findings must not carry edits, got %+v", findings[0])
  }
}
