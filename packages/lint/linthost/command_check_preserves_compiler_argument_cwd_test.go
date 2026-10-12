package linthost

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestCommandCheckPreservesCompilerArgumentCwd verifies inherited compiler
// argument parsing at A while the Program and rule context remain selected B.
//
// 1. Create distinct A/B projects and A-relative compiler response bytes.
// 2. Run actual command preparation and direct native Program parsing.
// 3. Require selected paths/membership/root and explicit-channel controls.
//
// @evidence contracts/testing.md#behavioral-verification Actual check consumes the paired inherited response and reports B's no-var violation; direct loadProgram asserts upstream resolved output/root/config paths, B source membership and Program/rule identity using independently observed native directory equivalence for physical aliases.
// @evidence contracts/testing.md#independent-expectations Literal A-relative products and ../B root operands require A/products and B; authored B var syntax independently requires its no-var rule diagnostic.
// @evidence contracts/testing.md#distinguishing-cases Inherited paired response, explicit argv and explicit [] suppression, absent payload and same-cwd default distinguish compiler cwd transport from program/rule root. Direct parser assertions supplement actual command delivery rather than claiming to intercept command state.
// @evidence contracts/testing.md#execution-ownership This maintained Go unit invokes command and in-process upstream parser/Program boundaries against t.TempDir/t.Setenv inputs; no external compiler, native host build, installed consumer or watcher runs.
func TestCommandCheckPreservesCompilerArgumentCwd(t *testing.T) {
	root := t.TempDir()
	a, b := filepath.Join(root, "A"), filepath.Join(root, "B")
	for _, dir := range []string{a, b} {
		writeFile(t, filepath.Join(dir, "base.json"), `{"compilerOptions":{"module":"commonjs","target":"ES2022","rootDir":".","outDir":"configured"}}`)
		writeFile(t, filepath.Join(dir, "tsconfig.json"), `{"extends":"./base.json","files":["main.ts"]}`)
	}
	writeFile(t, filepath.Join(a, "main.ts"), "export const value = 1;\n")
	writeFile(t, filepath.Join(b, "main.ts"), "export var value = 1;\n")
	writeFile(t, filepath.Join(a, "args.rsp"), "--project ../B/tsconfig.json --outDir products --rootDir ../B\n")
	seedLintRules(t, b, map[string]string{"no-var": "error"})
	t.Setenv(tsgoArgsEnv, `["@args.rsp"]`)
	t.Setenv(tsgoArgsCwdEnv, a)
	args := []string{"check", "--cwd", b, "--plugins-json", lintManifest(t)}
	code, stdout, stderr := captureCommandOutput(t, func() int { return run(args) })
	if code != 2 || stdout != "" || !strings.Contains(stderr, "[no-var]") || !strings.Contains(stderr, "main.ts") {
		t.Fatalf("selected B rule did not run: %d / %q / %q", code, stdout, stderr)
	}
	for _, c := range []struct {
		name, raw, out string
	}{
		{"inherited pair", "", filepath.Join(a, "products")},
		{"explicit argv", `["--outDir","products"]`, filepath.Join(b, "products")},
		{"explicit empty", `[]`, filepath.Join(b, "configured")},
	} {
		t.Run(c.name, func(t *testing.T) {
			forwarded, err := decodeTsgoArgs(c.raw)
			if err != nil {
				t.Fatal(err)
			}
			prog, diags, err := loadProgram(b, "tsconfig.json", loadProgramOptions{tsgoArgs: forwarded, tsgoArgsCwd: decodeTsgoArgsCwd(c.raw, forwarded)})
			if err != nil || len(diags) != 0 || prog == nil {
				t.Fatalf("load: %v / %#v", err, diags)
			}
			defer prog.close()
			normalized := func(value string) string { return filepath.ToSlash(filepath.Clean(value)) }
			options := prog.parsed.CompilerOptions()
			if normalized(options.OutDir.AsString()) != normalized(c.out) || normalized(options.RootDir.AsString()) != normalized(b) || normalized(options.ConfigFilePath.AsString()) != normalized(filepath.Join(b, "tsconfig.json")) {
				t.Fatalf("wrong native options: out=%q root=%q config=%q", options.OutDir, options.RootDir, options.ConfigFilePath)
			}
			expectedRoot, err := os.Stat(b)
			if err != nil {
				t.Fatal(err)
			}
			physicalRoot, err := os.Stat(prog.identity.PhysicalProjectRoot)
			if err != nil {
				t.Fatal(err)
			}
			if prog.cwd != b || normalized(prog.tsProgram.GetCurrentDirectory().AsString()) != normalized(b) || prog.findSourceFile(filepath.Join(b, "main.ts")) == nil || prog.findSourceFile(filepath.Join(a, "main.ts")) != nil || !os.SameFile(expectedRoot, physicalRoot) {
				t.Fatalf("compiler argument base replaced Program/rule identity: cwd=%q TypeScriptCwd=%q physicalRoot=%q expectedB=%q Bsource=%t Asource=%t", prog.cwd, prog.tsProgram.GetCurrentDirectory(), prog.identity.PhysicalProjectRoot, b, prog.findSourceFile(filepath.Join(b, "main.ts")) != nil, prog.findSourceFile(filepath.Join(a, "main.ts")) != nil)
			}
		})
	}
	t.Setenv(tsgoArgsEnv, "")
	if decodeTsgoArgsCwd("", nil) != "" {
		t.Fatal("orphan cwd channel acquired authority")
	}
}
