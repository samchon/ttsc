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
