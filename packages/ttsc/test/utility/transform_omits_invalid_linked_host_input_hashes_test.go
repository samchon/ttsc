package ttsc_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

type invalidHostInputHashPlugin struct {
  input string
}

func (plugin invalidHostInputHashPlugin) SourcePreamble(ctx driver.PluginContext) (string, error) {
  ctx.ReportHostInputHash(plugin.input, stringPointer(strings.Repeat("a", 64)))
  ctx.ReportHostInputHash(plugin.input, stringPointer("NOT-A-SHA256"))
  ctx.ReportHostInputHash(plugin.input, stringPointer(strings.Repeat("a", 64)))
  ctx.ReportHostInputRealpath(plugin.input, stringPointer(filepath.Join(filepath.Dir(plugin.input), "selected")))
  // This spelling would resolve to the same target if the driver silently
  // anchored it at ctx.Cwd. The public contract requires an absolute identity,
  // so it must invalidate the earlier observation instead.
  ctx.ReportHostInputRealpath(plugin.input, stringPointer("selected"))
  ctx.ReportHostInputRealpath(plugin.input, stringPointer(filepath.Join(filepath.Dir(plugin.input), "selected")))
  return "", nil
}

// TestUtilityTransformOmitsInvalidLinkedHostInputHashes verifies the public Go
// reporting seam cannot publish malformed fingerprint or identity evidence.
//
// Third-party linked plugins call this API directly. An invalid value must keep
// the path as a watch input while withholding proof, so JavaScript adapters
// fall back conservatively instead of trusting non-SHA metadata.
//
//  1. Register a linked plugin that reports valid, malformed, then valid proof.
//  2. Run the real utility transform entrypoint.
//  3. Assert the path remains and both kinds of proof stay omitted.
//
// @evidence contracts/testing.md#behavioral-verification Malformed fingerprint and identity values reported through the Go seam keep the path as an input but withhold both kinds of proof.
// @evidence contracts/testing.md#independent-expectations The valid, malformed and valid sequence uses literal SHA-shaped and non-SHA strings.
// @evidence contracts/testing.md#distinguishing-cases Malformed values between two valid reports show that an invalid proof does not pass and a later valid proof cannot repair it.
// @evidence contracts/testing.md#execution-ownership TestUtilityTransformOmitsInvalidLinkedHostInputHashes is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityTransformOmitsInvalidLinkedHostInputHashes(t *testing.T) {
  resetLinkedPluginRegistry()
  root := t.TempDir()
  input := filepath.Join(root, "banner.config.cjs")
  driver.RegisterPlugin(invalidHostInputHashPlugin{input: input})
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")

  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunTransform([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"invalid","stage":"transform","config":{}}]`,
    })
  })
  if code != 0 || errOut != "" {
    t.Fatalf("RunTransform mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var result utilityTransformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &result); err != nil {
    t.Fatal(err)
  }
  if len(result.HostInputs) != 1 || result.HostInputs[0] != input {
    t.Fatalf("host inputs mismatch: %#v", result.HostInputs)
  }
  if _, ok := result.HostInputHashes[input]; ok {
    t.Fatalf("invalid hash must be omitted: %#v", result.HostInputHashes)
  }
  if _, ok := result.HostInputRealpaths[input]; ok {
    t.Fatalf("invalid realpath must be omitted: %#v", result.HostInputRealpaths)
  }
}
