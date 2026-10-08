package main

import (
	"path/filepath"
	"reflect"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestCompilerArgumentCwdPreparation verifies decoded argv origin at all
// three real native frontdoor preparation operations.
//
// 1. Set paired inherited arguments and their original parsing directory.
// 2. Prepare build, api-compile and api-transform with each explicit state.
// 3. Assert explicit argv, deferred nil inheritance and original load policies.
//
// @evidence contracts/testing.md#behavioral-verification Actual build, api-compile and api-transform preparations preserve nil deferred inheritance versus explicitly decoded argv, empty cwd and their original force-emit policies; driver loading owns the inherited argument/cwd pair.
// @evidence contracts/testing.md#independent-expectations Authored explicit JSON payloads independently establish literal slices, including nonnil empty argv. An absent command payload remains nil even when inherited environment exists.
// @evidence contracts/testing.md#distinguishing-cases All three frontdoors cover inherited, explicit nonempty, explicit [] and absent payload, keeping explicit empty distinct from nil inherited argv.
// @evidence contracts/testing.md#execution-ownership Pure command preparation executes in this Go unit process with temporary cwd and t.Setenv restoration, without Program acquisition, native host launch or installation.
func TestCompilerArgumentCwdPreparation(t *testing.T) {
	root := t.TempDir()
	a := filepath.Join(root, "A")
	t.Setenv(driver.TsgoArgsCwdEnv, a)
	for _, c := range []struct {
		name, inherited, explicit, cwd string
		argv                           []string
	}{
		{"inherited", `["--strict"]`, "", "", nil},
		{"explicit", `["--strict"]`, `["--target","es2022"]`, "", []string{"--target", "es2022"}},
		{"explicit empty", `["--strict"]`, `[]`, "", []string{}},
		{"absent payload", "", "", "", nil},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Setenv(driver.TsgoArgsEnv, c.inherited)
			args := []string{"--cwd", root}
			if c.explicit != "" {
				args = append(args, "--tsgo-args", c.explicit)
			}
			build, buildStatus := prepareBuildInvocation(args)
			compile, compileStatus := prepareAPICompileInvocation(args)
			transform, transformStatus := prepareAPITransformInvocation(args)
			if buildStatus != 0 || compileStatus != 0 || transformStatus != 0 {
				t.Fatalf("preparation statuses: %d/%d/%d", buildStatus, compileStatus, transformStatus)
			}
			if build.options.ForceEmit || build.options.ForceNoEmit || !compile.options.ForceEmit || compile.options.ForceNoEmit || transform.options.ForceEmit || !transform.options.ForceNoEmit {
				t.Fatal("command preparation changed its original emit policy")
			}
			for _, options := range []driver.LoadProgramOptions{build.options, compile.options, transform.options} {
				if options.TsgoArgsCwd != c.cwd || !reflect.DeepEqual(options.TsgoArgs, c.argv) {
					t.Fatalf("wrong origin: %#v", options)
				}
			}
		})
	}
}
