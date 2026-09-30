package linthost

import (
  "path/filepath"
  "testing"
)

// seedCommandLintCorpusProject preserves the original lint-violations compiler
// options and include-based source selection for direct command semantics.
// The caller supplies the original lint JSON and source; native package loading
// belongs to the shared E2E producer rather than this filesystem fixture.
//
// @evidence contracts/common.md#principled-implementation An authored tsconfig retains ES2022/commonjs/strict/outDir/rootDir/plugins/include while each caller supplies its actual config and source. Files are inputs to the real command resolver, not assertions about repository arrangement.
// @evidence contracts/common.md#clear-and-simple-design One fixture writer shares the identical compiler setup across three independent command entries without sharing runtime command state or their assertion oracles.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The fixture uses ordinary temporary files and the supported plugin config shape; no production branch, native result or foreign function is replaced.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the original compiler setup, caller-owned config/source and separate native package-loading boundary before the acknowledgment tags.
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
