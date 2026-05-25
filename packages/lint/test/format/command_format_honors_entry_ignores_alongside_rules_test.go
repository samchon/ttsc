package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatHonorsEntryIgnoresAlongsideRules verifies the end-to-end
// `ttsc format` path leaves a file alone when the active lint config entry
// has both a `rules` block and an `ignores` list that names it.
//
// `ConfigStore.ResolveRules` only flips `Ignored` for entries that contain
// nothing but `ignores`. An entry that carries both `rules` and `ignores`
// has its rule contributions filtered per file via
// `ConfigEntry.matchesFile`, but the engine still hands the file to the
// resolver with `Ignored = false`. Before this fix, the format resolver
// re-upgraded every registered format rule to warn anyway, so the typeorm
// fixture's lint config ignored `src/driver/mongodb/typings.ts` for lint
// purposes yet still saw `ttsc format` rewrite it. This e2e test pins the
// integrated behavior on the smallest possible project.
//
//  1. Seed a project whose only source file is missing trailing semicolons.
//  2. Write a lint.config.json with one entry that has a `format` block,
//     a `rules` block, and an `ignores` glob naming that source file.
//  3. Run the format subcommand and assert the source file is untouched.
func TestCommandFormatHonorsEntryIgnoresAlongsideRules(t *testing.T) {
  original := "var legacy = 1\nJSON.stringify(legacy)\n"
  root := seedLintProject(t, original)
  seedLintConfig(t, root, map[string]any{
    "ignores": []string{"src/main.ts"},
    "format": map[string]any{
      "semi": true,
    },
    "rules": map[string]string{
      "no-var": "error",
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != original {
    t.Fatalf("ignored file was rewritten:\nwant %q\ngot  %q", original, string(got))
  }
}
