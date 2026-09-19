package linthost

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandCheckLintsThePublishedRootFiles verifies check lints the root
// files the launcher publishes in TTSC_ROOT_FILES instead of the config's own
// file list.
//
// `ttsx` runs a file its project does not list, such as a script beside a
// tsconfig whose `include` names only `src`, and checks it with that project's
// options and plugins. The config is parsed where it lives and only its file
// list is replaced, so this host has to honor the replacement too: otherwise it
// lints the whole project instead of the script, reporting findings the run
// never reaches and missing the one it does. The twin run without the variable
// pins that an ordinary check still lints the config's own list.
//
// 1. Create a project whose `include` names `src`, with a no-var violation in
//    `src/main.ts` and another in a script outside it.
// 2. Run check with the script in TTSC_ROOT_FILES, then without it.
// 3. Assert each run reports exactly its own file.
func TestCommandCheckLintsThePublishedRootFiles(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), "var inside = 1;\nJSON.stringify(inside);\n")
  writeFile(t, filepath.Join(root, "scripts", "run.ts"), "var outside = 2;\nJSON.stringify(outside);\n")
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  payload, err := json.Marshal([]string{filepath.Join(root, "scripts", "run.ts")})
  if err != nil {
    t.Fatal(err)
  }

  check := func() (int, string) {
    code, _, stderr := captureCommandOutput(t, func() int {
      return run([]string{
        "check",
        "--cwd", root,
        "--plugins-json", lintManifest(t),
      })
    })
    return code, stderr
  }

  t.Setenv(rootFilesEnv, string(payload))
  code, stderr := check()
  if code != 2 || !strings.Contains(stderr, "run.ts") || strings.Contains(stderr, "main.ts") {
    t.Fatalf("the published root was not the linted file: code=%d stderr=%q", code, stderr)
  }

  t.Setenv(rootFilesEnv, "")
  code, stderr = check()
  if code != 2 || !strings.Contains(stderr, "main.ts") || strings.Contains(stderr, "run.ts") {
    t.Fatalf("the config's own list was not the linted file: code=%d stderr=%q", code, stderr)
  }
}
