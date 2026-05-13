package ttsc_test

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCLICommandAcceptsProjectFlagAliases verifies `-p` and `--project` route
// into the project build command.
//
// These aliases are parsed before the build flag set sees the arguments. The
// command rewrites them into `--tsconfig=...`, so this test uses an absolute
// config path and verifies both spellings stay equivalent.
//
// 1. Create a no-emit project fixture with a non-default config path.
// 2. Execute both project alias spellings against that config.
// 3. Assert both aliases succeed without creating JavaScript output.
func TestCLICommandAcceptsProjectFlagAliases(t *testing.T) {
  root := t.TempDir()
  config := filepath.Join(root, "nested", "tsconfig.app.json")
  writeProjectFile(t, root, "nested/tsconfig.app.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "../bin"
  },
  "files": ["../src/index.ts"]
}
`)
  writeProjectFile(t, root, "src/index.ts", `export const value = 1;
`)

  for _, flag := range []string{"-p", "--project"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := runNativeCommand(t, flag, config, "--noEmit")
      if code != 0 {
        t.Fatalf("%s alias failed: code=%d stdout=%q stderr=%q", flag, code, out, errOut)
      }
      if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); !os.IsNotExist(err) {
        t.Fatalf("%s alias should not emit JavaScript: %v", flag, err)
      }
    })
  }
}
