package linthost

import (
  "strings"
  "testing"
)

// TestSwitchExhaustivenessCheckParserCommentRanges verifies the real command
// path recognizes only a trailing parser-classified default marker.
//
// The switch's AST-bounded trailing trivia gap is scanned independently. A
// Unicode-separated real comment must suppress the open-switch diagnostic,
// while identical bytes inside a template in the last clause remain outside
// that eligible gap.
//
//  1. Put a template-shaped marker in one open switch and expect a diagnostic.
//  2. Put a U+2028-separated real marker after another switch's last clause.
//  3. Assert the negative twin reports once and the real marker suppresses.
func TestSwitchExhaustivenessCheckParserCommentRanges(t *testing.T) {
  templateSource := "\ndeclare const value: string;\n" +
    "switch (value) {\n" +
    "  case \"known\":\n" +
    "    `${\"// No Default\"}`;\n" +
    "    break;\n" +
    "}\n"
  assertSwitchExhaustivenessCheckForTest(t, templateSource, map[string]any{
    "requireDefaultForNonUnion": true,
  }, 1, map[string]int{"Cases not matched: default": 1})

  markerSource := "\ndeclare const value: string;\nswitch (value) {\n  case \"known\": break;\u2028// No Default\u2029}\n"
  assertSwitchExhaustivenessCheckForTest(t, markerSource, map[string]any{
    "requireDefaultForNonUnion": true,
  }, 0, nil)

  file := parseTS(t, markerSource)
  if file.Statements == nil || len(file.Statements.Nodes) != 2 {
    t.Fatalf("want declaration and switch statements, got %+v", file.Statements)
  }
  switchNode := file.Statements.Nodes[1]
  sw := switchNode.AsSwitchStatement()
  if sw == nil || sw.CaseBlock == nil {
    t.Fatalf("parser did not retain switch case block: %+v", switchNode)
  }
  block := sw.CaseBlock.AsCaseBlock()
  if block == nil || block.Clauses == nil || len(block.Clauses.Nodes) != 1 {
    t.Fatalf("parser did not retain the switch clause: %+v", sw.CaseBlock)
  }
  marker := switchExhaustivenessCheckCommentDefaultCase(
    &Context{File: file},
    sw.CaseBlock,
    block.Clauses.Nodes[0],
    switchExhaustivenessCheckDefaultCommentPattern,
  )
  start := strings.Index(markerSource, "// No Default")
  end := start + len("// No Default")
  if marker == nil || marker.pos != start || marker.end != end {
    t.Fatalf("want exact marker range [%d,%d), got %+v", start, end, marker)
  }
}
