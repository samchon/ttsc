package ttsc_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestTransformSubcommandEmitsRelativeKeyedEnvelope guards regression #3 beyond
// the single-file preamble case: a multi-source project must export *every*
// in-project file under a cwd-relative slash key, and the returned typescript
// map must be non-empty so the JS launcher never sees a "no output" envelope.
//
// It also pins the outside-cwd fallback: a source file referenced from outside
// the project root (here the cwd is a subdirectory and one `files` entry lives
// in the parent) cannot be made relative without escaping cwd, so its key must
// fall back to the slash-normalized absolute path rather than a `../` key.
//
// Layout:
//
//  root/ext.ts          (outside cwd -> absolute slash key)
//  root/proj/           (== cwd)
//  root/proj/tsconfig.json  files: ["a.ts","b.ts","../ext.ts"]
//  root/proj/a.ts
//  root/proj/b.ts
//
// No linked plugin is needed: the transform subcommand prints the project text
// regardless, and that is exactly the path that must not collapse to empty.
func TestTransformSubcommandEmitsRelativeKeyedEnvelope(t *testing.T) {
  resetLinkedPluginRegistry()
  root := t.TempDir()
  cwd := filepath.Join(root, "proj")
  writeProjectFile(t, root, "ext.ts", "export const ext: number = 7;\n")
  writeProjectFile(t, cwd, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "strict": true },
  "files": ["a.ts", "b.ts", "../ext.ts"]
}
`)
  writeProjectFile(t, cwd, "a.ts", "export const a: number = 1;\n")
  writeProjectFile(t, cwd, "b.ts", "export const b: number = 2;\n")

  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{"--cwd", cwd})
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunTransform mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }

  var result utilityTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &result); err != nil {
    t.Fatalf("envelope is not valid JSON: %v\nstdout=%q", err, out)
  }
  // "no output" guard: the envelope must carry actual source files.
  if len(result.TypeScript) == 0 {
    t.Fatalf("transform returned an empty typescript map (no output): %q", out)
  }

  // Both in-cwd files must appear under bare relative slash keys.
  for _, want := range []string{"a.ts", "b.ts"} {
    text, ok := result.TypeScript[want]
    if !ok {
      t.Fatalf("missing relative key %q in envelope keys %v", want, keysOf(result.TypeScript))
    }
    if strings.TrimSpace(text) == "" {
      t.Fatalf("relative key %q mapped to empty TypeScript", want)
    }
    if strings.HasPrefix(want, "..") || filepath.IsAbs(want) {
      t.Fatalf("in-cwd key %q should be a bare relative path", want)
    }
  }
  if !strings.Contains(result.TypeScript["a.ts"], "export const a") {
    t.Fatalf("a.ts text not preserved: %q", result.TypeScript["a.ts"])
  }

  // The outside-cwd file must fall back to an absolute slash key, never a
  // `../`-escaping relative key.
  absExt := filepath.ToSlash(filepath.Join(root, "ext.ts"))
  text, ok := result.TypeScript[absExt]
  if !ok {
    t.Fatalf("outside-cwd file missing absolute key %q in keys %v", absExt, keysOf(result.TypeScript))
  }
  if !strings.Contains(text, "export const ext") {
    t.Fatalf("ext.ts text not preserved under absolute key: %q", text)
  }
  for k := range result.TypeScript {
    if strings.HasPrefix(k, "..") {
      t.Fatalf("envelope key %q escapes cwd; outside files must use absolute slash keys", k)
    }
  }
}

// keysOf returns the keys of a string map for clearer failure messages.
func keysOf(m map[string]string) []string {
  out := make([]string, 0, len(m))
  for k := range m {
    out = append(out, k)
  }
  return out
}
