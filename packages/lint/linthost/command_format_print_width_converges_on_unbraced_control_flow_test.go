package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// TestCommandFormatPrintWidthConvergesOnUnbracedControlFlow verifies print-width
// convergence across unbraced control-flow layouts.
//
// Unbraced forms must converge while preserving their original tokens. Braced
// bodies remain independent layout boundaries, including blocks nested below
// an outer unbraced branch.
//
// 1. Seed condition/body calls in each unbraced control-flow form.
// 2. Format twice and require original tokens, fragments and stable output.
// 3. Require long calls in braced bodies and standalone calls to reflow.
//
// @evidence contracts/testing.md#behavioral-verification Nine subcases run the in-process `format` command twice (printWidth 80) on an over-wide unbraced `if`, `else if`, `else`, `while`, `for(;;)`, `for-of`, `for-in`, `do-while` and `with` form, requiring exit 0, the condition fragment and the throw branch still present, and the second output equal to the first; a final project at width 40 requires exactly five `standalone(` calls to be broken across lines with a stable second pass.
// @evidence contracts/testing.md#independent-expectations Each pass compares token kinds and exact token text with the authored input, preserving control-flow keywords, operators, bindings, argument order and literal values; only a trailing comma immediately before a closing parenthesis is ignored in the braced fixture. The throw fragment independently preserves the exact interpolated template. The five broken-call count and second-pass equality are separate layout and convergence assertions, not the semantic oracle.
// @evidence contracts/testing.md#distinguishing-cases Separates nine unbraced control-flow forms from braced bodies and a standalone call that must reflow. Original-token equality rejects stable deletion or mutation of control-flow and call operands, while the broken-call count rejects complete abstention in the braced fixture. No full canonical whitespace layout is asserted; these explicit-semicolon fixtures do not cover whitespace-sensitive automatic semicolon insertion.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase seeds a temp-dir project and calls run with the format subcommand twice; no child process, built binary or installed consumer.
func TestCommandFormatPrintWidthConvergesOnUnbracedControlFlow(t *testing.T) {
  type token struct {
    kind shimast.Kind
    text string
  }
  tokens := func(text string, allowTrailingComma bool) []token {
    scanner := shimscanner.NewScanner()
    scanner.SetText(text)
    scanner.SetSkipTrivia(true)
    var result []token
    for kind := scanner.Scan(); kind != shimast.KindEndOfFile; kind = scanner.Scan() {
      if allowTrailingComma && kind == shimast.KindCloseParenToken && len(result) > 0 && result[len(result)-1].kind == shimast.KindCommaToken {
        result = result[:len(result)-1]
      }
      result = append(result, token{kind: kind, text: scanner.TokenText()})
    }
    return result
  }
  requireOriginalTokens := func(t *testing.T, original, got string, allowTrailingComma bool) {
    t.Helper()
    wantTokens := tokens(original, allowTrailingComma)
    gotTokens := tokens(got, allowTrailingComma)
    if len(gotTokens) != len(wantTokens) {
      t.Fatalf("token count changed: want=%d got=%d output=%s", len(wantTokens), len(gotTokens), got)
    }
    for index, want := range wantTokens {
      if gotTokens[index] != want {
        t.Fatalf("token %d changed: want=%#v got=%#v output=%s", index, want, gotTokens[index], got)
      }
    }
  }
  condition := "!fs.existsSync(entry)"
  branch := "throw new Error(`Typia preparation entrypoint not found: ${entry}`);"
  sources := []string{
    "if (" + condition + ") " + branch + "\n",
    "if (ready) {} else if (" + condition + ") " + branch + "\n",
    "if (" + condition + ") {} else " + branch + "\n",
    "while (" + condition + ") " + branch + "\n",
    "for (; " + condition + "; ) " + branch + "\n",
    "for (const item of fs.existsSync(entry)) " + branch + "\n",
    "for (const item in fs.existsSync(entry)) " + branch + "\n",
    "do " + branch + " while (" + condition + ");\n",
    "with (fs.existsSync(entry)) " + branch + "\n",
  }
  for _, source := range sources {
    t.Run(source[:strings.IndexByte(source, ' ')], func(t *testing.T) {
      root := seedLintProject(t, source)
      seedLintConfig(t, root, map[string]any{"format": map[string]any{"printWidth": 80}})
      main := filepath.Join(root, "src", "main.ts")
      var previous string
      for pass := 0; pass < 2; pass++ {
        code, _, stderr := captureCommandOutput(t, func() int {
          return run([]string{"format", "--cwd", root, "--plugins-json", lintManifest(t), "--single-threaded"})
        })
        if code != 0 {
          t.Fatalf("pass %d: code=%d stderr=%q", pass, code, stderr)
        }
        bytes, err := os.ReadFile(main)
        if err != nil {
          t.Fatal(err)
        }
        got := string(bytes)
        if !strings.Contains(got, "fs.existsSync(entry)") || !strings.Contains(got, branch) {
          t.Fatalf("unsupported fragments changed: %s", got)
        }
        requireOriginalTokens(t, source, got, false)
        if pass > 0 && got != previous {
          t.Fatalf("second format changed output: %s", got)
        }
        previous = got
      }
    })
  }
  source := "if (ready) {\n  standalone(\"alpha\", \"bravo\", \"charlie\");\n}\n" +
    "if (ready) while (ready) {\n  standalone(\"alpha\", \"bravo\", \"charlie\");\n}\n" +
    "const formatted = standalone(\"alpha\", \"bravo\", \"charlie\");\n" +
    "if (standalone(\"alpha\", \"bravo\", \"charlie\")) {} else if (standalone(\"alpha\", \"bravo\", \"charlie\")) {}\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{"format": map[string]any{"printWidth": 40}})
  var previous string
  for pass := 0; pass < 2; pass++ {
    code, _, stderr := captureCommandOutput(t, func() int {
      return run([]string{"format", "--cwd", root, "--plugins-json", lintManifest(t), "--single-threaded"})
    })
    if code != 0 {
      t.Fatalf("braced pass %d: code=%d stderr=%q", pass, code, stderr)
    }
    bytes, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
    if err != nil {
      t.Fatal(err)
    }
    got := string(bytes)
    if strings.Count(got, "standalone(\n") != 5 {
      t.Fatalf("calls did not reflow: %s", got)
    }
    requireOriginalTokens(t, source, got, true)
    if pass > 0 && got != previous {
      t.Fatalf("braced second format changed output: %s", got)
    }
    previous = got
  }
}
