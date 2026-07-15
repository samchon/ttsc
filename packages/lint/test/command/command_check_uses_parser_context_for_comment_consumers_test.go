package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckUsesParserContextForCommentConsumers verifies the check
// front door shares parser-aware comments across ban and inline-disable paths.
//
// Comment-shaped JSX text must neither suppress a diagnostic nor fabricate a
// banned TypeScript directive, a real JSX expression comment must suppress its
// next line, and regex braces inside a nested template must not hide a later
// TypeScript directive. Exercising the project command locks parser, engine,
// filter, and renderer integration.
//
//  1. Materialize a TSX project with fake lint and TypeScript markers in JSX text.
//  2. Follow nested template regexes with one genuine `@ts-ignore` comment.
//  3. Assert exact command diagnostics for the unsuppressed debugger and directive.
func TestCommandCheckUsesParserContextForCommentConsumers(t *testing.T) {
  source := "declare namespace JSX { interface IntrinsicElements { div: any; } }\n" +
    "const visible = <div>/* eslint-disable-next-line no-debugger *//* @ts-ignore */</div>;\n" +
    "debugger;\n" +
    "const active = <div>{/* eslint-disable-next-line no-debugger */}</div>;\n" +
    "debugger;\n" +
    "const value = `${`${1}`} ${/[}]/.test(\"}\")} ${/a\\/b/.test(\"a/b\")} ${/[{]/.test(\"{\")}`;\n" +
    "// @ts-ignore\n" +
    "const answer: number = 1;\n" +
    "JSON.stringify([visible, active, value, answer]);\n"
  root := seedLintProjectFile(t, "main.tsx", source)
  seedLintRules(t, root, map[string]string{
    "no-debugger":               "error",
    "typescript/ban-ts-comment": "error",
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("check result mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[no-debugger]"); got != 1 {
    t.Fatalf("want 1 no-debugger diagnostic, got %d: %s", got, stderr)
  }
  if got := strings.Count(stderr, "[typescript/ban-ts-comment]"); got != 1 {
    t.Fatalf("want 1 ban-ts-comment diagnostic, got %d: %s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.tsx:3:1") ||
    !diagnosticOutputContains(stderr, "main.tsx:7:1") ||
    diagnosticOutputContains(stderr, "main.tsx:5:1") {
    t.Fatalf("unexpected parser-context diagnostic ranges: %s", stderr)
  }
}
