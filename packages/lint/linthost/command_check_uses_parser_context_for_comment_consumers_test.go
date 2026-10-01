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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX check reports exactly one no-debugger at line three and one ban-ts-comment at line seven, while a real JSX expression comment suppresses line five and comment-shaped JSX text does not fabricate directives.
// @evidence contracts/testing.md#independent-expectations The authored source layout independently fixes literal lines 3/7 versus forbidden 5 and one finding per rule; expected coordinates/messages do not come from parser comment output.
// @evidence contracts/testing.md#distinguishing-cases Fake JSX text, genuine expression comment and nested-template regex braces exercise distinct grammar boundaries in the same project, distinguishing raw comment-pattern scanning from real parser context.
// @evidence contracts/testing.md#execution-ownership Actual in-process compiler parser, Engine, directive filter and renderer execute through the Go command on a temporary TSX/JSON-config project; no installed CLI, native source producer or script subprocess runs.
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
