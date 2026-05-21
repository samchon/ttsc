package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandCheckAppliesForwardedTsgoFlag verifies a forwarded tsgo CLI flag
// overrides the project tsconfig for the in-process lint program.
//
// `@ttsc/lint` builds its Program in-process, so a `ttsc --strict` the launcher
// could not satisfy by shelling out to tsgo rides into the sidecar as the
// `--tsgo-args` JSON payload instead. The sidecar replays it through tsgo's own
// option parser and merges it over the tsconfig. The fixture's tsconfig sets
// `strict: false`, so a strict-null diagnostic can only appear if the overlay
// actually won.
//
//  1. Create a project whose tsconfig disables strict mode, with a possibly-null
//     dereference in the source.
//  2. Run `check` with `--tsgo-args ["--strict"]`.
//  3. Assert a non-zero exit and a strict-null diagnostic on stderr.
func TestCommandCheckAppliesForwardedTsgoFlag(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": false,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"),
    "export const len = (x: string | null): number => x.length;\n")

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--tsgo-args", `["--strict"]`,
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "possibly") {
    t.Fatalf("forwarded --strict not applied: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
