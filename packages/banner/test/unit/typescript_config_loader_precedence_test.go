package banner_test

import (
  "bytes"
  "encoding/json"
  "io"
  "os/exec"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/resolutioninputs"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestTypeScriptConfigLoaderPrecedence verifies generated loader export precedence.
//
// Source-substring ordering cannot establish the loader's behavior. This runs
// the actual generated TypeScript and embedded recorder in Node, with conflicting
// exported values making incorrect default selection or unwrapping observable.
// The real compiler/launcher transport remains in the other loader boundaries.
//
// 1. Generate loaders for ESM named/default and CJS outer/nested conflicts.
// 2. Execute those loaders in one Node process and decode each actual envelope.
// 3. Execute an invalid-export control separately and require its error envelope.
//
// @evidence contracts/testing.md#behavioral-verification The actual bannerTypeScriptConfigLoaderSource output executes with the actual resolutioninputs.Recorder; decoded envelopes must select default, outer and nested text, while an invalid export must fail with the supported object requirement.
// @evidence contracts/testing.md#independent-expectations Deliberately conflicting named/default and outer/inner literal texts determine expected precedence independently of generated source; JSON decoding reads real stdout and never derives expected results from loader substrings.
// @evidence contracts/testing.md#distinguishing-cases ESM default competes with a named text, a CJS banner object competes with its nested default, nested defaults require unwrapping, and an object without text is rejected; this does not independently verify compiler emit or launcher argument transport.
// @evidence contracts/testing.md#execution-ownership The function generates loader source with bannerTypeScriptConfigLoaderSource in the test process and runs the generated modules with the embedded resolutioninputs recorder in real node children (one for the three positive fixtures, one for the invalid fixture); it builds no native artifact.
func TestTypeScriptConfigLoaderPrecedence(t *testing.T) {
  root := t.TempDir()
  recorder := filepath.Join(root, "recorder.cjs")
  shared.WriteFile(t, recorder, resolutioninputs.Recorder)
  fixtures := []struct {
    name, config, expected string
  }{
    {"default.mjs", `export const text = "named"; export default { text: "default" };`, "default"},
    {"outer.cjs", `module.exports = { text: "outer", default: { text: "inner" } };`, "outer"},
    {"nested.cjs", `module.exports = { default: { default: { text: "nested" } } };`, "nested"},
  }
  var loaders []string
  expected := map[string]int{}
  for _, fixture := range fixtures {
    shared.WriteFile(t, filepath.Join(root, fixture.name), fixture.config)
    loader := filepath.Join(root, fixture.name+".mts")
    shared.WriteFile(t, loader, bannerTypeScriptConfigLoaderSource(mustJSON(t, "./"+fixture.name), mustJSON(t, recorder)))
    loaders = append(loaders, loader)
    expected[fixture.expected]++
  }
  wrapper := filepath.Join(root, "positive.mjs")
  shared.WriteFile(t, wrapper, `import { pathToFileURL } from "node:url"; for (const file of `+mustJSON(t, loaders)+`) await import(pathToFileURL(file).href);`)
  command := exec.Command("node", "--disable-warning=ExperimentalWarning", "--experimental-strip-types", wrapper)
  var stdout, stderr bytes.Buffer
  command.Stdout, command.Stderr = &stdout, &stderr
  if err := command.Run(); err != nil || stderr.Len() != 0 {
    t.Fatalf("generated positive loaders failed: err=%v stdout=%q stderr=%q", err, stdout.String(), stderr.String())
  }
  decoder := json.NewDecoder(&stdout)
  actual := map[string]int{}
  for {
    var result struct {
      Value struct {
        Text string `json:"text"`
      } `json:"value"`
    }
    err := decoder.Decode(&result)
    if err == io.EOF {
      break
    }
    if err != nil {
      t.Fatalf("invalid generated envelope: %v", err)
    }
    actual[result.Value.Text]++
  }
  if len(actual) != len(expected) {
    t.Fatalf("generated precedence population: actual=%v expected=%v", actual, expected)
  }
  for text, count := range expected {
    if actual[text] != count {
      t.Fatalf("generated precedence for %q: got %d want %d", text, actual[text], count)
    }
  }

  shared.WriteFile(t, filepath.Join(root, "invalid.mjs"), `export default { other: true };`)
  invalid := filepath.Join(root, "invalid.mts")
  shared.WriteFile(t, invalid, bannerTypeScriptConfigLoaderSource(`"./invalid.mjs"`, mustJSON(t, recorder)))
  command = exec.Command("node", "--disable-warning=ExperimentalWarning", "--experimental-strip-types", invalid)
  stdout.Reset()
  stderr.Reset()
  command.Stdout, command.Stderr = &stdout, &stderr
  err := command.Run()
  exit, ok := err.(*exec.ExitError)
  if !ok || exit.ExitCode() != 1 {
    t.Fatalf("invalid export status: %v", err)
  }
  var failure struct {
    Message string `json:"__ttscLoaderError"`
  }
  if err := json.Unmarshal(stdout.Bytes(), &failure); err != nil {
    t.Fatalf("invalid export envelope: %v stdout=%q", err, stdout.String())
  }
  if failure.Message != `config file must export an object with a non-empty "text" string` {
    t.Fatalf("invalid export message: %q", failure.Message)
  }
}
