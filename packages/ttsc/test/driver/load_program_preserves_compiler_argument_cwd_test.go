package driver_test

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadProgramPreservesCompilerArgumentCwd verifies upstream argument
// parsing from the selected Program root, including inherited/explicit state.
//
// 1. Author A/B configs, inherited B options and an A-relative response.
// 2. Load B through actual upstream parsing with separate and ordinary bases.
// 3. Assert native resolved paths, B membership and Program root for each case.
//
// @evidence contracts/testing.md#behavioral-verification Direct LoadProgram asserts native OutDir/RootDir/ConfigFilePath, selected B source membership and Program cwd after actual response and inherited config parsing.
// @evidence contracts/testing.md#independent-expectations Authored A-relative products and ../B operands require A/products and B root, while the inherited B config requires B/configured when no overlay applies.
// @evidence contracts/testing.md#distinguishing-cases Explicit distinct and relative argument bases, inherited paired channels, explicit argv suppression of inherited cwd, explicit empty argv, absent payload and ordinary same-cwd loads distinguish transport ownership from Program selection.
// @evidence contracts/testing.md#execution-ownership This owning Go unit loads and closes in-process Programs with t.TempDir and t.Setenv; it builds or launches no product host, installs no consumer and emits no files.
func TestLoadProgramPreservesCompilerArgumentCwd(t *testing.T) {
	resetLinkedPluginRegistry()
	defer resetLinkedPluginRegistry()
	probe := &linkedPluginProbe{}
	driver.RegisterPlugin(probe)
	root := t.TempDir()
	a, b := filepath.Join(root, "A"), filepath.Join(root, "B")
	for _, dir := range []string{a, b} {
		writeProjectFile(t, dir, "tsconfig.json", `{"extends":"./base.json","files":["main.ts"]}`)
		writeProjectFile(t, dir, "base.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","rootDir":".","outDir":"configured"}}`)
		writeProjectFile(t, dir, "main.ts", "export const value = 1;\n")
	}
	writeProjectFile(t, a, "args.rsp", "--project ../B/tsconfig.json --outDir products --rootDir ../B\n")
	payload, err := json.Marshal([]string{"@args.rsp"})
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv(driver.LinkedPluginsEnv, `[{"name":"cwd-probe","stage":"transform","config":{}}]`)
	t.Setenv(driver.TsgoArgsEnv, string(payload))
	t.Setenv(driver.TsgoArgsCwdEnv, a)
	cases := []struct {
		name    string
		options driver.LoadProgramOptions
		outDir  string
	}{
		{"explicit separate base", driver.LoadProgramOptions{TsgoArgs: []string{"@args.rsp"}, TsgoArgsCwd: a}, filepath.Join(a, "products")},
		{"relative separate base", driver.LoadProgramOptions{TsgoArgs: []string{"@args.rsp"}, TsgoArgsCwd: "../A"}, filepath.Join(a, "products")},
		{"inherited pair", driver.LoadProgramOptions{}, filepath.Join(a, "products")},
		{"explicit argv ignores inherited base", driver.LoadProgramOptions{TsgoArgs: []string{"--outDir", "products"}}, filepath.Join(b, "products")},
		{"explicit empty ignores pair", driver.LoadProgramOptions{TsgoArgs: []string{}}, filepath.Join(b, "configured")},
		{"same cwd", driver.LoadProgramOptions{TsgoArgs: []string{"--outDir", "products"}, TsgoArgsCwd: b}, filepath.Join(b, "products")},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			prog, diags, err := driver.LoadProgram(b, "tsconfig.json", c.options)
			if err != nil || len(diags) != 0 || prog == nil {
				t.Fatalf("load: %v / %#v", err, diags)
			}
			defer prog.Close()
			before := probe.applied
			if err := prog.ApplyLinkedPlugins(); err != nil {
				t.Fatal(err)
			}
			if probe.applied != before+1 {
				t.Fatal("linked plugin did not execute")
			}
			ctx := probe.contexts[len(probe.contexts)-1]
			if filepath.Clean(ctx.Cwd) != b || ctx.Tsconfig != "tsconfig.json" {
				t.Fatalf("wrong plugin context: %#v", ctx)
			}
			opts := prog.ParsedConfig.ParsedConfig.CompilerOptions
			normalized := func(value string) string { return filepath.ToSlash(filepath.Clean(value)) }
			if normalized(opts.OutDir.AsString()) != normalized(c.outDir) || normalized(opts.RootDir.AsString()) != normalized(b) || normalized(opts.ConfigFilePath.AsString()) != normalized(filepath.Join(b, "tsconfig.json")) {
				t.Fatalf("wrong parsed paths: out=%q root=%q config=%q", opts.OutDir, opts.RootDir, opts.ConfigFilePath)
			}
			if normalized(prog.TSProgram.GetCurrentDirectory().AsString()) != normalized(b) || prog.SourceFile(filepath.Join(b, "main.ts")) == nil || prog.SourceFile(filepath.Join(a, "main.ts")) != nil {
				t.Fatal("argument base replaced selected Program root or membership")
			}
		})
	}
	t.Setenv(driver.TsgoArgsEnv, "")
	prog, diags, err := driver.LoadProgram(b, "tsconfig.json", driver.LoadProgramOptions{})
	if err != nil || len(diags) != 0 || prog == nil {
		t.Fatalf("absent payload: %v / %#v", err, diags)
	}
	defer prog.Close()
	if filepath.Clean(prog.ParsedConfig.ParsedConfig.CompilerOptions.OutDir.AsString()) != filepath.Join(b, "configured") {
		t.Fatal("cwd companion applied without a payload")
	}
}
