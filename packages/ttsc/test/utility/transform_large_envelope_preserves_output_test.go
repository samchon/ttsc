package ttsc_test

import (
  "encoding/json"
  "os"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestTransformLargeEnvelopePreservesOutput verifies command-stream capture
// retains a complete large transform output through concurrent pipe capture.
//
// 1. Transform an authored 128KiB literal string.
// 2. Decode the complete actual command envelope and require the whole payload.
// 3. Require process streams restored, then run a separate small request.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual RunTransform through the process-stream capture helper, decodes its JSON envelope, checks the full authored source payload and verifies stdout/stderr identity after each request.
// @evidence contracts/testing.md#independent-expectations Literal repeated payload bytes and index.ts are authored before transformation; complete payload containment, successful status and empty stderr are not derived from emitted output.
// @evidence contracts/testing.md#distinguishing-cases A 128KiB string exercises the concurrently draining capture helper, then a small separate request detects stale stream ownership or leaked output. Native pipe capacity and actual backpressure are not measured here.
// @evidence contracts/testing.md#execution-ownership This direct utility Go unit calls the maintained command wrapper and in-process compiler over disposable inputs with no CLI child. The capture helper owns concurrent reads and descriptor cleanup; the fixture registry and manifest environment are reset for this entry.
func TestTransformLargeEnvelopePreservesOutput(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, "")
  for _, payload := range []string{strings.Repeat("x", 128*1024), "small"} {
    root := t.TempDir()
    writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"target":"es2020","module":"commonjs"},"files":["index.ts"]}`)
    writeProjectFile(t, root, "index.ts", "export const payload = \""+payload+"\";\n")
    stdout, stderr := os.Stdout, os.Stderr
    code, out, errOut := captureUtilityOutput(t, func() int {
      return utility.RunTransform([]string{"--cwd", root, "--plugins-json", "[]"})
    })
    if os.Stdout != stdout || os.Stderr != stderr {
      t.Fatal("transform capture did not restore process streams")
    }
    if code != 0 || errOut != "" {
      t.Fatalf("transform: status=%d stderr=%q", code, errOut)
    }
    var document utilityTransformResult
    if err := json.Unmarshal([]byte(out), &document); err != nil {
      t.Fatalf("incomplete envelope: %v", err)
    }
    if !strings.Contains(document.TypeScript["index.ts"], "\""+payload+"\"") {
      t.Fatalf("transform lost the authored %d-byte payload", len(payload))
    }
  }
}
