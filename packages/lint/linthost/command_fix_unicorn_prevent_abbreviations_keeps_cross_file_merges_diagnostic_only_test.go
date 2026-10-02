package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFixUnicornPreventAbbreviationsKeepsCrossFileMergesDiagnosticOnly verifies that public in-process fix dispatch checks diagnostic exit/output and both unchanged cross-file declarations.
//
// The two authored interface Ctx declarations share one global identity across source files. A source-local automatic rename must not split that identity; literal original bytes in both files establish the conservative no-write result.
//
// @evidence contracts/testing.md#behavioral-verification Actual run(fix) returns status two with empty stdout and a unicorn/prevent-abbreviations diagnostic, while both complete interface Ctx source files remain unchanged.
// @evidence contracts/testing.md#independent-expectations The two authored interface Ctx declarations share one global identity across source files. A source-local automatic rename must not split that identity; literal original bytes in both files establish the conservative no-write result.
// @evidence contracts/testing.md#distinguishing-cases Both global interface Ctx files retain exact original text with the expected rule error exit; TestUnicornPreventAbbreviationsRenamesMergedTypeAndValueReferencesTogether owns the contrasting single-file merged rename.
// @evidence contracts/testing.md#execution-ownership This single discoverable Go unit entry executes in-process fix dispatch, checker-backed merged-binding analysis and actual unchanged-file reads on two isolated authored files; no dynamic subcases, installed consumer, native producer or product child runs.
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
