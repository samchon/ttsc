package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandCheckScopesExtendsRuleOptionsPerFile covers the complete command
// path, including project-rule binding around ConfigStore. Both files contain
// both selectable nodes; each must report only the option tuple from entries
// that match its own path.
func TestCommandCheckScopesExtendsRuleOptionsPerFile(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
    "compilerOptions": {
      "target": "ES2022",
      "module": "commonjs",
      "strict": true,
      "rootDir": "."
    },
    "files": ["src/main.ts", "tests/unit.ts"]
  }`)
  source := "export {};\nconst value = 1;\ndebugger;\n"
  writeFile(t, filepath.Join(root, "src", "main.ts"), source)
  writeFile(t, filepath.Join(root, "tests", "unit.ts"), source)
  writeFile(t, filepath.Join(root, "base.json"), `{
    "rules": {
      "no-restricted-syntax": ["error", "VariableDeclaration"]
    }
  }`)
  writeFile(t, filepath.Join(root, "lint.config.json"), `{
    "extends": "./base.json",
    "files": ["tests/**"],
    "rules": {
      "no-restricted-syntax": ["warning", "DebuggerStatement"]
    }
  }`)

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || strings.Count(stderr, "[no-restricted-syntax]") != 2 {
    t.Fatalf("scoped command diagnostics mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  cleanStderr := ansiControlSequencePattern.ReplaceAllString(stderr, "")
  var mainDiagnostic, unitDiagnostic string
  for _, line := range strings.Split(cleanStderr, "\n") {
    if !strings.Contains(line, "[no-restricted-syntax]") {
      continue
    }
    if strings.Contains(line, "main.ts") {
      mainDiagnostic = line
    }
    if strings.Contains(line, "unit.ts") {
      unitDiagnostic = line
    }
  }
  if !strings.Contains(mainDiagnostic, "error TS") ||
    !strings.Contains(mainDiagnostic, "Using 'VariableDeclaration' is not allowed.") ||
    !strings.Contains(unitDiagnostic, "warning TS") ||
    !strings.Contains(unitDiagnostic, "Using 'DebuggerStatement' is not allowed.") {
    t.Fatalf("command did not preserve per-file options: %q", stderr)
  }
}
