//go:build js && wasm

package host_test

import (
  "reflect"
  "sort"
  "strings"
  "syscall/js"
  "testing"
)

// TestPluginDispatchForwardsScalarOptionsAsFlags verifies that api.plugin turns
// its options object into the CLI-shaped argument vector the plugin documents.
//
// Numbers are the branch that can silently corrupt a value: formatting a float
// with the default verb spells 1234567 as "1.234567e+06", which no plugin flag
// parser reads back as the integer the caller passed.
//
// 1. Dispatch to a plugin that echoes its command and arguments, passing strings,
//    integers on both sides of the exponent threshold, a fraction, a negative,
//    true, false and undefined.
// 2. Dispatch to an unregistered name.
// 3. Assert the command and the sorted flags equal the literals the contract
//    specifies, name and command are not forwarded, and an unknown name is code 2.
//
// @evidence contracts/testing.md#behavioral-verification Calls api.plugin on the exposed js/wasm API and compares the command, the exit code, stderr and the forwarded flag list with literals, so a wrong number format, a forwarded name or command key, or a lost flag fails.
// @evidence contracts/testing.md#independent-expectations The expected flags are the documented translation (string and number as --key=value, true as --key, false and undefined omitted); 1234567 and 100000000 are written out in full because a plugin flag parser reads integers, not exponent notation.
// @evidence contracts/testing.md#distinguishing-cases Strings, integers on both sides of the exponent threshold, a fraction, a negative, true, false and undefined each have a separate flag outcome, and an unregistered name is the failure case with code 2.
// @evidence contracts/testing.md#execution-ownership Runs through the real syscall/js dispatch in the js/wasm test binary, which is the only place buildPluginArgv can execute; the plugin double only echoes what Run received.
func TestPluginDispatchForwardsScalarOptionsAsFlags(t *testing.T) {
  api := startSharedAPI(t)

  value := awaitPromise(t, api.Call("plugin", js.ValueOf(map[string]any{
    "name":     "argv-echo",
    "command":  "run",
    "cwd":      "/work",
    "tsconfig": "a.json",
    "label":    "x y",
    "count":    1234567,
    "big":      100000000,
    "ratio":    0.5,
    "negative": -3,
    "on":       true,
    "off":      false,
    "unset":    js.Undefined(),
  })))
  if code := value.Get("code").Int(); code != 7 {
    t.Fatalf("code = %d, want the plugin's exit code 7", code)
  }
  if stderr := value.Get("stderr").String(); stderr != "echoed" {
    t.Fatalf("stderr = %q, want %q", stderr, "echoed")
  }
  lines := strings.Split(strings.TrimSuffix(value.Get("stdout").String(), "\n"), "\n")
  if lines[0] != "run" {
    t.Fatalf("command = %q, want %q", lines[0], "run")
  }
  flags := lines[1:]
  sort.Strings(flags)
  want := []string{
    "--big=100000000",
    "--count=1234567",
    "--cwd=/work",
    "--label=x y",
    "--negative=-3",
    "--on",
    "--ratio=0.5",
    "--tsconfig=a.json",
  }
  if !reflect.DeepEqual(flags, want) {
    t.Fatalf("flags = %q, want %q", flags, want)
  }

  unknown := awaitPromise(t, api.Call("plugin", js.ValueOf(map[string]any{
    "name":    "missing",
    "command": "run",
  })))
  if code := unknown.Get("code").Int(); code != 2 {
    t.Fatalf("unknown plugin code = %d, want 2", code)
  }
  if !strings.Contains(unknown.Get("stderr").String(), `unknown plugin "missing"`) {
    t.Fatalf("unknown plugin stderr = %q", unknown.Get("stderr").String())
  }
}
