package ttsc_test

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestCLIAPITransformUsesCurrentDirectory verifies API commands resolve cwd
// from the process when `--cwd` is omitted.
//
// Most API adapter tests pass an explicit cwd override. This one runs a built
// command from the fixture project so the adapter must use os.Getwd through its
// normal current-directory branch.
//
// 1. Create a no-emit project in a temporary directory.
// 2. Execute `api-transform` from that directory without `--cwd`.
// 3. Assert the JSON result includes the project-relative source key.
func TestCLIAPITransformUsesCurrentDirectory(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value: number = 1;
`)

  code, out, errOut := runBuiltNativeCommandInDir(t, root, "api-transform")
  if code != 0 {
    t.Fatalf("api-transform from cwd failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var transformed apiTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &transformed); err != nil {
    t.Fatalf("api-transform JSON decode failed: %v\n%s", err, out)
  }
  if !strings.Contains(transformed.TypeScript["index.ts"], "value: number") {
    t.Fatalf("api-transform did not return cwd project source: %#v", transformed.TypeScript)
  }
}
