package main

import (
  "strings"
  "testing"

  "golang.org/x/tools/go/packages"
)

// TestPackageLoadAdmissionRejectsIncompleteResults verifies incomplete loader
// observations cannot authorize the generator's output phase.
//
// The real pre-write validator receives authored loader result records, so the
// cases distinguish admission policy without substituting for package loading.
//
//  1. Construct complete, missing, duplicate and errored package populations.
//  2. Invoke the same admission operation that guards generation.
//  3. Assert success or every independently expected diagnostic fragment.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production-used validator and checks success or complete diagnostic messages for accepted and rejected populations, including an error on a later package before generation may write earlier outputs.
// @evidence contracts/testing.md#independent-expectations Literal requested import identities and loader error records define the population contract independently of generator output.
// @evidence contracts/testing.md#distinguishing-cases Covers complete reversed-order results, empty and partial loads, unexpected and duplicate identities, nil entries and a later package error; each invalid observation must reject the whole population.
// @evidence contracts/testing.md#execution-ownership This tools/gen_shims source unit invokes the admission operation in one Go process with authored policy inputs; it loads no foreign package, writes no output and starts no native producer.
func TestPackageLoadAdmissionRejectsIncompleteResults(t *testing.T) {
  if err := validateShimPackages(nil, nil); err == nil {
    t.Fatal("empty generation population was admitted")
  }
  first, second := "example.com/internal/first", "example.com/internal/second"
  requested := []string{first, second}
  for _, test := range []struct {
    name string
    loaded []*packages.Package
    messages []string
  }{
    {"complete", []*packages.Package{{PkgPath: second}, {PkgPath: first}}, nil},
    {"empty", nil, []string{"missing package " + first, "missing package " + second}},
    {"partial", []*packages.Package{{PkgPath: first}}, []string{"missing package " + second}},
    {"unexpected", []*packages.Package{{PkgPath: first}, {PkgPath: "other"}}, []string{"unexpected package other", "missing package " + second}},
    {"duplicate", []*packages.Package{{PkgPath: first}, {PkgPath: first}, {PkgPath: second}}, []string{"loaded 2 times"}},
    {"nil", []*packages.Package{nil, {PkgPath: second}}, []string{"nil package result", "missing package " + first}},
    {"late error", []*packages.Package{{PkgPath: first}, {PkgPath: second, Errors: []packages.Error{{Msg: "authored module failure"}}}}, []string{"authored module failure"}},
  } {
    t.Run(test.name, func(t *testing.T) {
      err := validateShimPackages(test.loaded, requested)
      if test.messages == nil {
        if err != nil {
          t.Fatal(err)
        }
        return
      }
      if err == nil {
        t.Fatal("incomplete load was admitted")
      }
      for _, message := range test.messages {
        if !strings.Contains(err.Error(), message) {
          t.Errorf("missing %q in %v", message, err)
        }
      }
    })
  }
}
