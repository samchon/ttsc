package main

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
func TestParseSubcommandFlagsAcceptsCommonFlagCombinations(t *testing.T) {
  root := t.TempDir()
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
  if !opts.emit || opts.noEmit || !opts.quiet || !opts.verbose {
    t.Fatalf("boolean flag mismatch: %+v", opts)
  }
}
