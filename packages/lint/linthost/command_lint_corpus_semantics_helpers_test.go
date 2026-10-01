package linthost

import (
  "path/filepath"
  "testing"
)

// seedCommandLintCorpusProject preserves the original lint-violations compiler
// options and include-based source selection for direct command semantics.
// The caller supplies the original lint JSON and source; native package loading
// belongs to the shared E2E producer rather than this filesystem fixture.
func seedCommandLintCorpusProject(t *testing.T, lintConfig, source string) string {
  t.Helper()
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
    "compilerOptions": {
      "target": "ES2022",
      "module": "commonjs",
      "strict": true,
      "outDir": "dist",
      "rootDir": "src",
      "plugins": [{ "transform": "@ttsc/lint" }]
    },
    "include": ["src"]
  }`)
  writeFile(t, filepath.Join(root, "lint.config.json"), lintConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), source)
  return root
}
