package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFixUnicornPreventAbbreviationsKeepsCrossFileMergesDiagnosticOnly verifies that public in-process fix dispatch checks diagnostic exit/output and both unchanged cross-file declarations.
//
// A merged declaration spanning source files independently requires conservative diagnostic-only handling to preserve joint identity.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification Public in-process fix dispatch checks diagnostic exit/output and both unchanged cross-file declarations.
// @evidence contracts/testing.md#independent-expectations A merged declaration spanning source files independently requires conservative diagnostic-only handling to preserve joint identity.
// @evidence contracts/testing.md#distinguishing-cases Both interface Ctx files retain exact original text with the expected rule error exit; single-file merged renames belong to the merged-identity host.
// @evidence contracts/testing.md#execution-ownership TestCommandFixUnicornPreventAbbreviationsKeepsCrossFileMergesDiagnosticOnly owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestCommandFixUnicornPreventAbbreviationsKeepsCrossFileMergesDiagnosticOnly(t *testing.T) {
  const mainSource = "interface Ctx { first: string }\n"
  const otherSource = "interface Ctx { second: string }\n"
  root := seedLintProject(t, mainSource)
  otherPath := filepath.Join(root, "src", "other.ts")
  writeFile(t, otherPath, otherSource)
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts", "src/other.ts"]
}
`)
  seedLintRules(t, root, map[string]string{unicornPreventAbbreviationsRuleName: "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"fix", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "["+unicornPreventAbbreviationsRuleName+"]") {
    t.Fatalf("cross-file fix mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertFileText(t, filepath.Join(root, "src", "main.ts"), mainSource)
  assertFileText(t, otherPath, otherSource)
}
