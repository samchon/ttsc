package banner_test

import (
  "bytes"
  "crypto/sha256"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/resolutioninputs"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestTypeScriptConfigLoaderPrecedence verifies export precedence and package proofs.
//
// Source-substring ordering cannot establish the loader's behavior. This runs
// the actual generated TypeScript and embedded recorder in Node, with conflicting
// exported values making incorrect default selection or unwrapping observable.
// A fourth compatible loader owns actual package selection and cutoff proofs
// while the selected module mutates an unrelated directory beside the fixture.
// The real compiler/launcher transport remains in the other loader boundaries.
//
//  1. Generate loaders for export conflicts and a selected package that churns
//     an unrelated root sibling during evaluation.
//  2. Execute those loaders in one Node process and decode each actual envelope.
//  3. Execute an invalid-export control separately and require its error envelope.
//
// @evidence contracts/testing.md#behavioral-verification Actual bannerTypeScriptConfigLoaderSource and resolutioninputs.Recorder select the authored default/outer/nested texts and evaluate selection's installed module despite root-sibling mkdir/rmdir churn. Its actual envelope retains selected-module/manifest byte hashes and physical identities, both proof keys for every input and no selection candidate beyond the selected root. The invalid export retains its supported failure requirement.
// @evidence contracts/testing.md#independent-expectations Conflicting export literals define precedence. Authored package/module bytes independently define SHA-256; native Stat and SameFile identify the fixture root, selected inputs and physical proof targets even when the temporary root has an alias. A candidate's parent before node_modules/selection must identify the authored root, so absent candidates cannot escape the cutoff. Actual stdout is decoded without deriving expected results from loader source or recorder output.
// @evidence contracts/testing.md#distinguishing-cases Default/outer/nested precedence and invalid export remain; bare package selection contrasts the selected local package with irrelevant higher search roots changed during evaluation. Nil proofs for stable absent candidates are allowed but absent proof keys fail. This does not certify compiler emit, native TypeScript launcher transport or every plugin/config-format combination.
// @evidence contracts/testing.md#execution-ownership Generated loader modules and the embedded recorder run in the existing two real Node children: one shared positive cohort now contains four loaders, and one invalid control remains. Package selection adds no child, compiler Program, host or native artifact. The positive fixture's sibling is removed by its module and testing cleanup owns any remaining empty sibling.
func TestTypeScriptConfigLoaderPrecedence(t *testing.T) {
  root := t.TempDir()
  rootInfo, rootErr := os.Stat(root)
  if rootErr != nil {
    t.Fatal(rootErr)
  }
  shared.WriteFile(t, filepath.Join(root, "package.json"), `{"type":"module"}`)
  installed := filepath.Join(root, "node_modules", "selection")
  manifest := filepath.Join(installed, "package.json")
  manifestText := `{"main":"index.js","name":"selection"}`
  shared.WriteFile(t, manifest, manifestText)
  sibling := root + "-sibling"
  t.Cleanup(func() {
    if err := os.Remove(sibling); err != nil && !os.IsNotExist(err) {
      t.Errorf("cleanup sibling: %v", err)
    }
  })
  selectedModule := filepath.Join(installed, "index.js")
  moduleText := "const fs = require(\"node:fs\");\nfs.mkdirSync(" + mustJSON(t, sibling) + ");\nfs.rmdirSync(" + mustJSON(t, sibling) + ");\nmodule.exports = { text: \"INSTALLED SELECTION\" };\n"
  shared.WriteFile(t, selectedModule, moduleText)
  recorder := filepath.Join(root, "recorder.cjs")
  shared.WriteFile(t, recorder, resolutioninputs.Recorder)
  fixtures := []struct {
    name, config, expected string
  }{
    {"default.mjs", `export const text = "named"; export default { text: "default" };`, "default"},
    {"outer.cjs", `module.exports = { text: "outer", default: { text: "inner" } };`, "outer"},
    {"nested.cjs", `module.exports = { default: { default: { text: "nested" } } };`, "nested"},
    {"selection.mjs", `import selection from "selection"; export default selection;`, "INSTALLED SELECTION"},
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
      Inputs    []string           `json:"inputs"`
      Hashes    map[string]*string `json:"hashes"`
      Realpaths map[string]*string `json:"realpaths"`
      Value     struct {
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
    if result.Value.Text == "INSTALLED SELECTION" {
      for _, input := range result.Inputs {
        if _, exists := result.Hashes[input]; !exists {
          t.Errorf("selected-package input %s lost its hash proof", input)
        }
        if _, exists := result.Realpaths[input]; !exists {
          t.Errorf("selected-package input %s lost its physical proof", input)
        }
        spelling := filepath.ToSlash(input)
        if strings.Contains(spelling, "/node_modules/selection/") || strings.HasSuffix(spelling, "/node_modules/selection") {
          parent := filepath.FromSlash(spelling[:strings.LastIndex(spelling, "/node_modules/selection")])
          parentInfo, err := os.Stat(parent)
          if err != nil || !os.SameFile(rootInfo, parentInfo) {
            t.Errorf("selection candidate lies past the selected root: %s", input)
          }
        }
      }
      for file, text := range map[string]string{selectedModule: moduleText, manifest: manifestText} {
        authoredInfo, err := os.Stat(file)
        if err != nil {
          t.Fatal(err)
        }
        matched := false
        expectedHash := fmt.Sprintf("%x", sha256.Sum256([]byte(text)))
        for _, input := range result.Inputs {
          inputInfo, err := os.Stat(input)
          if err != nil || !os.SameFile(authoredInfo, inputInfo) {
            continue
          }
          matched = true
          hash, exists := result.Hashes[input]
          if !exists || hash == nil || *hash != expectedHash {
            t.Errorf("selected file %s input %s hash=%v, want authored byte hash %s", file, input, hash, expectedHash)
          }
          observed, exists := result.Realpaths[input]
          if !exists || observed == nil {
            t.Errorf("selected file %s input %s lost its physical identity", file, input)
            continue
          }
          physicalInfo, err := os.Stat(*observed)
          if err != nil || !os.SameFile(authoredInfo, physicalInfo) {
            t.Errorf("selected file %s physical=%s does not identify authored input: %v", file, *observed, err)
          }
        }
        if !matched {
          t.Errorf("actual selected file %s is not an input", file)
        }
      }
      if _, err := os.Stat(sibling); !os.IsNotExist(err) {
        t.Errorf("selected module did not remove its unrelated sibling: %v", err)
      }
    }
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
