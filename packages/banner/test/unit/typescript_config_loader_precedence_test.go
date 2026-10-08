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
// Two mapped-import loaders contrast stable absence with a nearer scoped
// package created by a supported resolve hook after Node selects the far copy.
// The real compiler/launcher transport remains in the other loader boundaries.
//
//  1. Generate loaders for export conflicts and a selected package that churns
//     an unrelated root sibling during evaluation.
//  2. Execute those loaders in one Node process and decode each actual envelope.
//  3. Execute an invalid-export control separately and require its error envelope.
//
// @evidence contracts/testing.md#behavioral-verification Actual bannerTypeScriptConfigLoaderSource and resolutioninputs.Recorder select the authored precedence and bare-package values. Supported preinstalled hooks create a nearer scoped mapped target after Node selects FAR: its actual envelope keeps the changed candidates without reusable hash/physical proof, while stable mapped absence keeps null proofs. Existing bare selection retains authored hashes, physical identities and selected-root cutoff despite unrelated sibling churn; invalid export still fails.
// @evidence contracts/testing.md#independent-expectations Conflicting export literals define precedence. Authored bytes independently define SHA-256; native Stat/SameFile identify selected inputs and root boundaries. An independent temporary public resolve hook supplies actual require.resolve coverage, so mapped-envelope completeness is not guessed from a Node version. Changed NEAR must lose proof while FAR's literal answer survives. Actual stdout is decoded without deriving expectations from generated loader text.
// @evidence contracts/testing.md#distinguishing-cases Default/outer/nested precedence and invalid export remain; bare package selection contrasts the selected local package with irrelevant higher search roots. Mapped scoped stable/created targets differ only by the phase-window mutation, which must preserve FAR's answer but withdraw NEAR proof. This does not certify compiler emit, native launcher transport or every config format.
// @evidence contracts/testing.md#execution-ownership Generated loaders and the actual embedded recorder run in the existing two Node children: six compatible loaders share one positive cohort and one invalid control remains. Public hooks belong to that isolated cohort's process lifetime. No new child, compiler Program, product host or native artifact is added; testing owns fresh roots and remaining sibling cleanup.
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
  mapped := map[string]struct {
    near, far, module string
    changed           bool
  }{}
  mappedRoot, mappedRootErr := filepath.EvalSymlinks(root)
  if mappedRootErr != nil {
    t.Fatal(mappedRootErr)
  }
  var windows []map[string]any
  for _, changed := range []bool{false, true} {
    label := "MAPPED STABLE"
    if changed {
      label = "MAPPED CREATED"
    }
    directory := filepath.Join(mappedRoot, strings.ReplaceAll(label, " ", "-"))
    app := filepath.Join(directory, "app")
    config := filepath.Join(app, "config.mjs")
    shared.WriteFile(t, filepath.Join(app, "package.json"), `{"type":"module","imports":{"#dep":"@scope/pkg"}}`)
    shared.WriteFile(t, config, `import value from "#dep"; export default value;`)
    near := filepath.Join(app, "node_modules", "@scope", "pkg")
    if err := os.MkdirAll(filepath.Dir(near), 0o755); err != nil {
      t.Fatal(err)
    }
    far := filepath.Join(directory, "node_modules", "@scope", "pkg")
    text := "module.exports = { text: " + mustJSON(t, label) + " };"
    shared.WriteFile(t, filepath.Join(far, "package.json"), `{"main":"index.cjs"}`)
    shared.WriteFile(t, filepath.Join(far, "index.cjs"), text)
    loader := filepath.Join(app, "loader.mts")
    shared.WriteFile(t, loader, bannerTypeScriptConfigLoaderSource(`"./config.mjs"`, mustJSON(t, recorder)))
    loaders = append(loaders, loader)
    expected[label]++
    mapped[label] = struct {
      near, far, module string
      changed           bool
    }{near, far, text, changed}
    windows = append(windows, map[string]any{"config": config, "near": near, "changed": changed})
  }
  wrapper := filepath.Join(root, "positive.mjs")
  capabilityReceipt := filepath.Join(root, "resolve-capability.json")
  shared.WriteFile(t, wrapper, `import fs from "node:fs";
import path from "node:path";
import { createRequire, registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
let requireResolveObserved = false;
const sentinel = "ttsc-config-loader-capability-probe";
const probe = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier !== sentinel) return nextResolve(specifier, context);
  requireResolveObserved = true;
  return { shortCircuit: true, url: pathToFileURL(process.execPath).href };
}});
try { createRequire(import.meta.url).resolve(sentinel); } catch {}
finally { probe.deregister(); }
fs.writeFileSync(`+mustJSON(t, capabilityReceipt)+`, JSON.stringify(requireResolveObserved));
const windows = `+mustJSON(t, windows)+`;
registerHooks({ resolve(specifier, context, nextResolve) {
  const selected = nextResolve(specifier, context);
  const window = windows.find(item => specifier === "#dep" && context.parentURL === pathToFileURL(item.config).href);
  if (window?.changed) {
    window.changed = false;
    fs.mkdirSync(window.near);
    fs.writeFileSync(path.join(window.near, "package.json"), '{"main":"index.cjs"}');
    fs.writeFileSync(path.join(window.near, "index.cjs"), 'module.exports = { text: "NEAR" };');
  }
  return selected;
}});
for (const file of `+mustJSON(t, loaders)+`) await import(pathToFileURL(file).href);`)
  command := exec.Command("node", "--disable-warning=ExperimentalWarning", "--experimental-strip-types", wrapper)
  var stdout, stderr bytes.Buffer
  command.Stdout, command.Stderr = &stdout, &stderr
  if err := command.Run(); err != nil || stderr.Len() != 0 {
    t.Fatalf("generated positive loaders failed: err=%v stdout=%q stderr=%q", err, stdout.String(), stderr.String())
  }
  capabilityBytes, capabilityErr := os.ReadFile(capabilityReceipt)
  var requireResolveObserved bool
  if capabilityErr != nil || json.Unmarshal(capabilityBytes, &requireResolveObserved) != nil {
    t.Fatalf("missing actual require.resolve hook capability: %v", capabilityErr)
  }
  decoder := json.NewDecoder(&stdout)
  actual := map[string]int{}
  for {
    var result struct {
      Inputs    []string           `json:"inputs"`
      Complete  bool               `json:"complete"`
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
    if window, exists := mapped[result.Value.Text]; exists {
      if result.Complete != requireResolveObserved {
        t.Errorf("mapped loader %s completeness=%v differs from actual public require.resolve hook capability=%v", result.Value.Text, result.Complete, requireResolveObserved)
      }
      for _, name := range []string{"package.json", "index.cjs"} {
        file := filepath.Join(window.near, name)
        inputFound := false
        for _, input := range result.Inputs {
          if filepath.Clean(input) == filepath.Clean(file) {
            inputFound = true
          }
        }
        if !inputFound {
          t.Errorf("mapped loader omitted nearer candidate %s", file)
        }
        hash, hashPresent := result.Hashes[file]
        physical, physicalPresent := result.Realpaths[file]
        if window.changed {
          if hashPresent || physicalPresent {
            t.Errorf("mapped loader refreshed changed candidate %s: hash=%v physical=%v", file, hash, physical)
          }
        } else if !hashPresent || !physicalPresent || hash != nil || physical != nil {
          t.Errorf("stable mapped absence lost its null proofs: %s", file)
        }
      }
      file := filepath.Join(window.far, "index.cjs")
      hash := result.Hashes[file]
      expectedHash := fmt.Sprintf("%x", sha256.Sum256([]byte(window.module)))
      if hash == nil || *hash != expectedHash {
        t.Errorf("mapped loader selected-module proof %s does not match authored FAR bytes", file)
      }
    }
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
