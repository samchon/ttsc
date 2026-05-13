package ttsc_test

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityPipelineAppliesBannerAndStrip verifies the public utility sidecar
// path used by first-party Go plugins.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Build a real project containing source text for banner and strip plugins.
// 2. Run check, transform, and build through exported utility entrypoints.
// 3. Assert transformed source and emitted JavaScript reflect the plugin stack.
func TestUtilityPipelineAppliesBannerAndStrip(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: banner and strip both mutate source text before emit, so
  // the project includes a preamble target plus removable statements.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `debugger;
const value: number = 1;
console.log(value);
export { value };
`)
  plugins := `[{"name":"@ttsc/banner","config":{"text":"Utility Banner"}},{"name":"@ttsc/strip"}]`

  // Check assertion: RunCheck validates the same plugin configuration without
  // writing emitted files.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{"--cwd", root, "--plugins-json", plugins})
  })
  if code != 0 || out != "" || errOut != "" {
    t.Fatalf("RunCheck mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }

  // Transform assertion: RunTransform exposes the transformed TypeScript text
  // before JavaScript emit, which is where the banner preamble is visible.
  code, out, errOut = captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{"--cwd", root, "--plugins-json", plugins})
  })
  if code != 0 {
    t.Fatalf("RunTransform failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var transformed utilityTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &transformed); err != nil {
    t.Fatalf("RunTransform JSON decode failed: %v\nstdout=%s\nstderr=%s", err, out, errOut)
  }
  if !strings.Contains(transformed.TypeScript["index.ts"], "Utility Banner") {
    t.Fatalf("transformed source missing banner: %#v", transformed.TypeScript)
  }

  // Build assertion: RunBuild emits JavaScript through the same utility host
  // and should persist both the banner and stripped statement effects.
  code, out, errOut = captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{"--cwd", root, "--emit", "--verbose", "--plugins-json", plugins})
  })
  if code != 0 {
    t.Fatalf("RunBuild failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(out, "emitted=") {
    t.Fatalf("RunBuild verbose output missing emit summary: %q", out)
  }

  js, err := os.ReadFile(filepath.Join(root, "bin", "index.js"))
  if err != nil {
    t.Fatal(err)
  }
  text := string(js)
  if !strings.Contains(text, "Utility Banner") {
    t.Fatalf("emitted JavaScript missing banner:\n%s", text)
  }
  if strings.Contains(text, "debugger") || strings.Contains(text, "console.log") {
    t.Fatalf("strip plugin did not remove configured statements:\n%s", text)
  }
}
