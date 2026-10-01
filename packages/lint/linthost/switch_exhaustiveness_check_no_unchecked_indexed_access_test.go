package linthost

import (
  "path/filepath"
  "testing"
)

// TestSwitchExhaustivenessCheckNoUncheckedIndexedAccess verifies ordinary and
// checker-synthesized undefined types compare as the same runtime switch value.
//
//  1. Enable noUncheckedIndexedAccess in a real tsconfig.
//  2. Report the missing undefined member in an incomplete source.
//  3. Check a separate explicit case undefined source with no findings even
//     though its Type pointer differs
//     from the checker's missing/optional undefined constituent.
// @evidence contracts/testing.md#behavioral-verification Compiler indexed-access configuration must preserve the missing undefined switch branch.
// @evidence contracts/testing.md#independent-expectations The real noUncheckedIndexedAccess project requires one authored undefined message before its case is added and zero findings afterward.
// @evidence contracts/testing.md#distinguishing-cases The same array index switch changes only by handling undefined; the actual compiler option is an input to the checker, not a file-existence oracle.
// @evidence contracts/testing.md#execution-ownership TestSwitchExhaustivenessCheckNoUncheckedIndexedAccess executes the in-process check command with real Program/Checker through the shared switch oracle; every original source/options/assertion remains and no compiler child, installation or native build runs.
func TestSwitchExhaustivenessCheckNoUncheckedIndexedAccess(t *testing.T) {
  configure := func(root string) {
    writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  }
  code, stderr := runSwitchExhaustivenessCheckForTest(t, `
declare const values: string[];
switch (values[0]) {
  case "known":
    break;
}
`, nil, configure)
  assertSwitchExhaustivenessCheckResultForTest(t, code, stderr, 1, map[string]int{
    "Cases not matched: undefined": 1,
  })

  code, stderr = runSwitchExhaustivenessCheckForTest(t, `
declare const values: string[];
switch (values[0]) {
  case "known":
    break;
  case undefined:
    break;
}
`, nil, configure)
  assertSwitchExhaustivenessCheckResultForTest(t, code, stderr, 0, nil)
}
