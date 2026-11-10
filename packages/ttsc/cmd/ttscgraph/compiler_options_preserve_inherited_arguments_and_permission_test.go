package main

import (
  "flag"
  "io"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestCompilerOptionsPreserveInheritedArgumentsAndPermission verifies graph
// permission composes with the existing compiler argument transport.
//
// Relative response files keep their own cwd, and false must override true.
//
// 1. Parse omitted, enabled, disabled and repeated graph permission flags.
// 2. Require unchanged inherited tokens followed by the explicit assignment.
// 3. Reject malformed inherited transport without losing other compiler flags.
//
// @evidence contracts/testing.md#behavioral-verification Real Go flag parsing and graphCompilerOptions preserve omission, inherited argv/cwd and explicit assignment precedence; malformed inherited JSON returns an error.
// @evidence contracts/testing.md#independent-expectations Authored token arrays and cwd strings prescribe the exact forwarded values without compiler execution or implementation-derived snapshots.
// @evidence contracts/testing.md#distinguishing-cases Covers omission, true, false, repetition and malformed transport while retaining a relative response-file token and ordinary strict option.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes the command's portable option owner in-process; t.Setenv restores transport state and no compiler or mapper process starts.
func TestCompilerOptionsPreserveInheritedArgumentsAndPermission(t *testing.T) {
  t.Setenv(driver.TsgoArgsEnv, `["--strict","@relative.rsp","--runExternalCode","true"]`)
  t.Setenv(driver.TsgoArgsCwdEnv, "argument base")
  inherited := []string{"--strict", "@relative.rsp", "--runExternalCode", "true"}
  for _, test := range []struct {
    args       []string
    assignment string
  }{
    {nil, ""},
    {[]string{"--runExternalCode"}, "true"},
    {[]string{"--runExternalCode=false"}, "false"},
    {[]string{"--runExternalCode", "--runExternalCode=false"}, "false"},
  } {
    flags := flag.NewFlagSet("graph", flag.ContinueOnError)
    flags.SetOutput(io.Discard)
    permission := flags.Bool("runExternalCode", false, "")
    if err := flags.Parse(test.args); err != nil {
      t.Fatal(err)
    }
    options, err := graphCompilerOptions(flags, *permission)
    if err != nil {
      t.Fatal(err)
    }
    if test.assignment == "" {
      if options.TsgoArgs != nil || options.TsgoArgsCwd != "" {
        t.Errorf("omitted flag replaced inherited selection: %#v", options)
      }
      continue
    }
    want := append(slices.Clone(inherited), "--runExternalCode", test.assignment)
    if !slices.Equal(options.TsgoArgs, want) || options.TsgoArgsCwd != "argument base" {
      t.Errorf("permission %v: %#v", test.args, options)
    }
  }
  t.Setenv(driver.TsgoArgsEnv, "{")
  flags := flag.NewFlagSet("graph", flag.ContinueOnError)
  permission := flags.Bool("runExternalCode", false, "")
  if err := flags.Parse([]string{"--runExternalCode=false"}); err != nil {
    t.Fatal(err)
  }
  if _, err := graphCompilerOptions(flags, *permission); err == nil {
    t.Fatal("malformed inherited compiler arguments were discarded")
  }
}
