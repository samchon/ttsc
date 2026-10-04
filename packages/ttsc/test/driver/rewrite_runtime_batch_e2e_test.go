package driver_test

import (
  "fmt"
  "path/filepath"
  "reflect"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteRuntimeBatch Verifies nine declaration-owned rewrites through
// actual CommonJS and ES module loading with independent literal export values.
//
// Eight compatible CommonJS cases share one Program; nodenext requires the
// separate ES module Program. The original raw esModuleInterop:false input is
// preserved and asserted in the direct helper-decoy unit. Pinned TypeScript-Go
// always enables interop, so that removed option does not justify another
// runtime producer.
// Eight require loads and one import share one Node process, each with its own
// catch and original test identity. The five units retain structural emission
// assertions; their runtime values are owned by the named cases below.
// Emitted text alone cannot establish that Node loads the interop bindings or
// executes the protected decoy calls correctly; these actual module loads can.
//
// suffix_0_bare_root removes an ambient call; suffix_1, suffix_2, suffix_3 and
// suffix_16 preserve the original collision depths and literal replacement names.
// Namespace preserves the bare-binding import input and replacement value.
// OwnedRequire preserves plugin:kept plus ordered first/second replacements.
// HelperDecoy preserves plugin:kept plus rewritten-import with the shared effective interop behavior.
// RetainedESM preserves decoy:kept plus rewritten-esm under actual import loading.
//
// 1. Copy the static Go-owned inputs and load each immutable option group once.
// 2. Register the original rewrites for all nine cases and emit each group once.
// 3. Load eight CommonJS outputs and one ESM output through one actual Node process.
// 4. Report each original test identity independently against its literal export map.
//
// @evidence contracts/testing.md#behavioral-verification Direct LoadProgram and EmitAll produce the actual nine fixtures; Node require/import consumes them and nine named Go subcases require exact export maps or report their own producer/load failure.
// @evidence contracts/testing.md#independent-expectations Literal rewritten-suffix names, rewritten-namespace, ordered rewritten-first/second, plugin:kept, rewritten-import, decoy:kept and rewritten-esm come from the authored input/replacement contract and are never passed to Node as expected output.
// @evidence contracts/testing.md#distinguishing-cases Bare root, collision depths 1/2/3/16, bare namespace, source-owned require, helper-shaped decoy and retained ESM import preserve all original runtime distinctions; decoy exports must remain unchanged beside replacements.
// @evidence contracts/testing.md#execution-ownership This untagged Go unit calls the owning compiler library directly and uses Node only as an independent emitted-value oracle, without installing a consumer, building a native host or invoking product protocol. Anonymous subcases preserve original failure names but are not separately addressable Evidence declarations; TestDriverRewriteRuntimeBatch is their selectable owner.
//
// Additional implementation review grounds follow. The selected public case
// answers the testing and E2E chapters above; its private helpers remain
// review-only because Go Evidence addresses exported declarations.
//
// Portability: OS-neutral implementation: filepath.Join preserves native fixture and output paths under TempDir; the private consumer helper supplies argv separately and converts ESM paths to file URLs without shell quoting or OS branches.
// Performance: Efficient algorithms: Nine source targets are registered once and each of two option groups is emitted once; result comparison scans each small export map without duplicate module loads.
// Performance: Reuse equivalent work: Eight CommonJS cases use the same effective interop and immutable runtime compiler options with isolated source modules, so one Program serves them. The raw false parse distinction stays in the unit; the genuinely different ESM module format and resolution require the second Program. One Node process shares startup across all nine independent module paths.
// Performance: Bound retention and release resources: Each Program closes immediately after its group's emission, including ordinary failure paths, with idempotent deferred cleanup guarding panic; one TempDir owns copied fixtures/output, and the helper bounds and waits for the single Node process.
func TestDriverRewriteRuntimeBatch(t *testing.T) {
  cases := []struct {
    name         string
    group        string
    source       string
    replacements []string
    expected     map[string]string
    producerErr  error
  }{
    {name: "TestDriverRewriteDerivesEmittedAliasesWithoutSuffixCeiling/suffix_0_bare_root", group: "commonjs", source: "suffix_0_bare_root", replacements: []string{"rewritten-suffix_0_bare_root"}, expected: map[string]string{"value": "rewritten-suffix_0_bare_root"}},
    {name: "TestDriverRewriteDerivesEmittedAliasesWithoutSuffixCeiling/suffix_1", group: "commonjs", source: "suffix_1", replacements: []string{"rewritten-suffix_1"}, expected: map[string]string{"value": "rewritten-suffix_1"}},
    {name: "TestDriverRewriteDerivesEmittedAliasesWithoutSuffixCeiling/suffix_2", group: "commonjs", source: "suffix_2", replacements: []string{"rewritten-suffix_2"}, expected: map[string]string{"value": "rewritten-suffix_2"}},
    {name: "TestDriverRewriteDerivesEmittedAliasesWithoutSuffixCeiling/suffix_3", group: "commonjs", source: "suffix_3", replacements: []string{"rewritten-suffix_3"}, expected: map[string]string{"value": "rewritten-suffix_3"}},
    {name: "TestDriverRewriteDerivesEmittedAliasesWithoutSuffixCeiling/suffix_16", group: "commonjs", source: "suffix_16", replacements: []string{"rewritten-suffix_16"}, expected: map[string]string{"value": "rewritten-suffix_16"}},
    {name: "TestDriverRewriteDerivesNamespaceImportBareBinding", group: "commonjs", source: "namespace", replacements: []string{"rewritten-namespace"}, expected: map[string]string{"value": "rewritten-namespace"}},
    {name: "TestDriverRewriteDerivesAliasFromOwnedRequireDeclaration", group: "commonjs", source: "owned-require", replacements: []string{"rewritten-first", "rewritten-second"}, expected: map[string]string{"decoy": "plugin:kept", "first": "rewritten-first", "second": "rewritten-second"}},
    {name: "TestDriverRewriteExcludesSourceOwnedHelperDeclaration", group: "commonjs", source: "helper-decoy", replacements: []string{"rewritten-import"}, expected: map[string]string{"decoy": "plugin:kept", "value": "rewritten-import"}},
    {name: "TestDriverRewritePrefersRetainedESMImportOverRequireDecoy", group: "esm", replacements: []string{"rewritten-esm"}, expected: map[string]string{"decoy": "decoy:kept", "value": "rewritten-esm"}},
  }
  root := t.TempDir()
  copyErr := copyRewriteRuntimeFixtures(root)
  for _, group := range []string{"commonjs", "esm"} {
    groupErr := copyErr
    if groupErr == nil {
      projectRoot := filepath.Join(root, group)
      // Keep actual producer calls visible: exactly one Program and emit per group.
      program, diagnostics, err := driver.LoadProgram(projectRoot, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
      groupErr = err
      if groupErr == nil && len(diagnostics) != 0 {
        groupErr = fmt.Errorf("config diagnostics: %#v", diagnostics)
      }
      if groupErr == nil && program == nil {
        groupErr = fmt.Errorf("LoadProgram returned no Program for %s", group)
      }
      if program != nil {
        // Release on panic as well as at group completion; Close is idempotent.
        defer program.Close()
        if groupErr == nil {
          rewrites := driver.NewRewriteSet()
          for i := range cases {
            test := &cases[i]
            if test.group != group {
              continue
            }
            source := program.SourceFile(filepath.Join(projectRoot, test.source, "index.ts"))
            if source == nil {
              test.producerErr = fmt.Errorf("SourceFile did not find %s/index.ts", test.source)
              continue
            }
            for _, replacement := range test.replacements {
              rewrites.Add(driver.Rewrite{File: source, RootName: "plugin", Method: "make", Replacement: fmt.Sprintf("%q", replacement), ConsumeParens: true})
            }
          }
          _, diagnostics, err := program.EmitAll(rewrites, nil)
          groupErr = err
          if groupErr == nil && len(diagnostics) != 0 {
            groupErr = fmt.Errorf("emit diagnostics: %#v", diagnostics)
          }
        }
        program.Close()
      }
    }
    for i := range cases {
      if cases[i].group == group && groupErr != nil {
        cases[i].producerErr = groupErr
      }
    }
  }
  inputs := make([]rewriteRuntimeInput, 0, len(cases))
  for _, test := range cases {
    if test.producerErr == nil {
      inputs = append(inputs, rewriteRuntimeInput{Name: test.name, File: filepath.Join(root, test.group, "bin", test.source, "index.js"), ESM: test.group == "esm"})
    }
  }
  var results map[string]rewriteRuntimeResult
  var nodeErr error
  if len(inputs) != 0 {
    results, nodeErr = runRewriteRuntimeBatch(root, inputs)
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      if test.producerErr != nil {
        t.Fatalf("%s producer: %v", test.group, test.producerErr)
      }
      if nodeErr != nil {
        t.Fatal(nodeErr)
      }
      result, exists := results[test.name]
      if !exists {
        t.Fatal("missing named Node result")
      }
      if result.Error != "" {
        t.Fatalf("module load: %s", result.Error)
      }
      if !reflect.DeepEqual(result.Value, test.expected) {
        t.Fatalf("runtime exports = %#v, want %#v", result.Value, test.expected)
      }
    })
  }
}
