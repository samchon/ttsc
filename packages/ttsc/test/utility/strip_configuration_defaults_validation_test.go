package ttsc_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityStripConfigurationDefaultsAndValidation verifies default strip
// behavior and the main configuration error branches.
//
// Empty strip config expands to the package defaults, while malformed call and
// statement patterns must fail before AST mutation begins. This package-level
// utility test observes those branches through the public sidecar entrypoints.
//
// The transformed source assertion proves the default call and statement
// patterns are active, while the command errors prove bad patterns still stop
// configuration before a project can emit.
//
// 1. Transform a project with empty strip config and verify default removals.
// 2. Configure an unsupported statement pattern and assert a config error.
// 3. Configure a middle wildcard call pattern and assert a config error.
func TestUtilityStripConfigurationDefaultsAndValidation(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `declare const assert: { equal(a: unknown, b: unknown): void };
console.log("drop");
assert.equal(1, 1);
console.info("keep");
debugger;
`)

  code, stdout, stderr := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"@ttsc/strip","config":{}}]`,
    })
  })
  if code != 0 {
    t.Fatalf("RunTransform failed: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var transformed utilityTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &transformed); err != nil {
    t.Fatalf("RunTransform JSON decode failed: %v\nstdout=%s\nstderr=%s", err, stdout, stderr)
  }
  text := transformed.TypeScript["index.ts"]
  for _, forbidden := range []string{"console.log", "assert.equal", "debugger"} {
    if strings.Contains(text, forbidden) {
      t.Fatalf("default strip config left %s in transformed source:\n%s", forbidden, text)
    }
  }
  if !strings.Contains(text, "console.info") {
    t.Fatalf("default strip config matched too broadly:\n%s", text)
  }

  code, stdout, stderr = captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"@ttsc/strip","config":{"statements":["debugger","with"]}}]`,
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unsupported statement pattern") {
    t.Fatalf("unsupported statement mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }

  code, stdout, stderr = captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"@ttsc/strip","config":{"calls":["assert.*.deep"]}}]`,
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "wildcard is only supported") {
    t.Fatalf("middle wildcard mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
