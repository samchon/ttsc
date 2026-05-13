package ttsc_test

import "testing"

// TestCLICommandAcceptsFlagShapedBuildAlias verifies build flags work without
// the explicit `build` command word.
//
// The native front door treats a leading flag as the tsc-compatible project
// build lane. This keeps `ttsc --noEmit` and similar compiler-shaped commands
// from being rejected as unknown subcommands.
//
// 1. Create a compilable project fixture.
// 2. Execute the CLI with `--cwd` as the first argument.
// 3. Assert the command succeeds through the build lane.
func TestCLICommandAcceptsFlagShapedBuildAlias(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  code, out, errOut := runNativeCommand(t, "--cwd", root, "--noEmit")
  if code != 0 {
    t.Fatalf("flag-shaped build alias failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
