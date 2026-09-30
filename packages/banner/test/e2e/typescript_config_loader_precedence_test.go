package banner_test

import (
  "bytes"
  "encoding/json"
  "io"
  "os/exec"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/resolutioninputs"
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
// @evidence contracts/testing.md#execution-ownership This named E2E entry runs authored Go source generation in the test process and its real generated TypeScript/recorder modules through Node; it builds no per-case native artifact and replaces the old source-order unit assertion.
// @evidence contracts/e2e.md#necessary-boundary Generated code must remain executable and implement the export policy in the JavaScript runtime; source-string inspection and pure config-option units cannot detect an executable precedence regression.
// @evidence contracts/e2e.md#shared-execution The three positive fixtures share one recorder artifact and one Node lifetime; the invalid control has a separate lifetime because its actual failure handler exits the process and would hide positive results if combined.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique module filenames and literal config inputs separate each positive import without clearing caches; t.TempDir owns all files, synchronous command completion owns each child, and the negative fixture uses a fresh child with independent recorder state.
// @evidence contracts/e2e.md#preserved-coverage Behavioral default selection, banner-object guarding and nested unwrapping replace the old substring-order assertion with actual outputs and an invalid-export control; existing compiler/launcher and script-loader assertions are retained in their original owners.
func TestTypeScriptConfigLoaderPrecedence(t *testing.T) {
  root := t.TempDir()
  recorder := filepath.Join(root, "recorder.cjs")
  writeFile(t, recorder, resolutioninputs.Recorder)
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
    writeFile(t, filepath.Join(root, fixture.name), fixture.config)
    loader := filepath.Join(root, fixture.name+".mts")
    writeFile(t, loader, bannerTypeScriptConfigLoaderSource(mustJSON(t, "./"+fixture.name), mustJSON(t, recorder)))
    loaders = append(loaders, loader)
    expected[fixture.expected]++
  }
  wrapper := filepath.Join(root, "positive.mjs")
  writeFile(t, wrapper, `import { pathToFileURL } from "node:url"; for (const file of `+mustJSON(t, loaders)+`) await import(pathToFileURL(file).href);`)
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

  writeFile(t, filepath.Join(root, "invalid.mjs"), `export default { other: true };`)
  invalid := filepath.Join(root, "invalid.mts")
  writeFile(t, invalid, bannerTypeScriptConfigLoaderSource(`"./invalid.mjs"`, mustJSON(t, recorder)))
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
