package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// Verifies print-width convergence across unbraced control-flow layouts.
//
// A condition and its unbraced body otherwise alternate their column budgets
// and hit the ten-pass cascade cap (#1366). Braced bodies remain independent
// layout boundaries, including blocks nested below an outer unbraced branch.
//
// 1. Seed condition/body calls in each unbraced control-flow form.
// 2. Format twice and require unchanged fragments and byte-identical output.
// 3. Require long calls in braced bodies and standalone calls to reflow.
func TestCommandFormatPrintWidthConvergesOnUnbracedControlFlow(t *testing.T) {
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
        if code != 0 { t.Fatalf("pass %d: code=%d stderr=%q", pass, code, stderr) }
        bytes, err := os.ReadFile(main)
        if err != nil { t.Fatal(err) }
        got := string(bytes)
        if !strings.Contains(got, "fs.existsSync(entry)") || !strings.Contains(got, branch) {
          t.Fatalf("unsupported fragments changed: %s", got)
        }
        if pass > 0 && got != previous { t.Fatalf("second format changed output: %s", got) }
        previous = got
      }
    })
  }
  source := "if (ready) {\n  standalone(\"alpha\", \"bravo\", \"charlie\");\n}\n" +
    "if (ready) while (ready) {\n  standalone(\"alpha\", \"bravo\", \"charlie\");\n}\n" +
    "const formatted = standalone(\"alpha\", \"bravo\", \"charlie\");\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{"format": map[string]any{"printWidth": 40}})
  var previous string
  for pass := 0; pass < 2; pass++ {
    code, _, stderr := captureCommandOutput(t, func() int {
      return run([]string{"format", "--cwd", root, "--plugins-json", lintManifest(t), "--single-threaded"})
    })
    if code != 0 { t.Fatalf("braced pass %d: code=%d stderr=%q", pass, code, stderr) }
    bytes, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
    if err != nil { t.Fatal(err) }
    got := string(bytes)
    if strings.Count(got, "standalone(\n") != 3 { t.Fatalf("calls did not reflow: %s", got) }
    if pass > 0 && got != previous { t.Fatalf("braced second format changed output: %s", got) }
    previous = got
  }
}
