package linthost

import (
  "path/filepath"
  "testing"
)

// TestParseSubcommandFlagsAcceptsCommonFlagCombinations verifies command option parsing.
//
// check and build share parseSubcommandFlags before loading a project. The
// parser should accept the normal host-forwarded combination of cwd, tsconfig,
// plugin JSON, emit mode, verbosity, quiet mode, and outDir.
//
// This scenario calls the parser directly so flag semantics are covered without
// invoking tsgo project loading or emitting files.
//
// 1. Create a temporary cwd and pass common value and boolean flags.
// 2. Parse the flags through the shared subcommand parser.
// 3. Assert values, booleans, and cwd normalization are preserved.
//
// @evidence contracts/testing.md#behavioral-verification parseSubcommandFlags preserves cwd, relative tsconfig, plugin JSON, outDir, emit/quiet/verbose booleans and the semantic-config environment path in one actual build-option parse.
// @evidence contracts/testing.md#independent-expectations Literal input tokens and environment value supply all expected fields; filepath.Abs independently normalizes the authored temporary cwd. noEmit remains false because only emit was passed.
// @evidence contracts/testing.md#distinguishing-cases Separate value flags and bare booleans coexist with the semantic-config environment input, while a relative tsconfig remains relative rather than becoming the semantic path. Conflicting flag rejection has separate command/parser tests.
// @evidence contracts/testing.md#execution-ownership The actual option parser runs in-process without loading a compiler Program, emitting files, building native hosts or installing consumers. The temporary cwd names an input origin, not a repository-presence assertion.
func TestParseSubcommandFlagsAcceptsCommonFlagCombinations(t *testing.T) {
  root := t.TempDir()
  semanticConfig := filepath.Join(root, "semantic", "tsconfig.json")
  t.Setenv(semanticConfigPathEnv, semanticConfig)
  opts, err := parseSubcommandFlags("build", []string{
    "--cwd", root,
    "--tsconfig", "configs/tsconfig.json",
    "--plugins-json", "[]",
    "--emit",
    "--quiet",
    "--verbose",
    "--outDir", "generated",
  })
  if err != nil {
    t.Fatalf("parseSubcommandFlags: %v", err)
  }
  wantCwd, err := filepath.Abs(root)
  if err != nil {
    t.Fatalf("Abs: %v", err)
  }
  if opts.cwd != wantCwd {
    t.Fatalf("cwd mismatch: want %s, got %s", wantCwd, opts.cwd)
  }
  if opts.tsconfig != "configs/tsconfig.json" || opts.pluginsJSON != "[]" || opts.outDir != "generated" {
    t.Fatalf("value flag mismatch: %+v", opts)
  }
  if opts.semanticConfigPath != semanticConfig {
    t.Fatalf("semantic config path mismatch: want %s, got %s", semanticConfig, opts.semanticConfigPath)
  }
  if !opts.emit || opts.noEmit || !opts.quiet || !opts.verbose {
    t.Fatalf("boolean flag mismatch: %+v", opts)
  }
}
