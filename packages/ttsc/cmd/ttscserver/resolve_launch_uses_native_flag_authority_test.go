package main

import (
  "bytes"
  "context"
  "encoding/json"
  "errors"
  "os"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestResolveLaunchUsesNativeFlagAuthority verifies preparation queries use the
// host's full native argument contract before project-dependent work.
//
// The literal expectations follow flag.FlagSet's documented one/two-dash forms,
// replacement assignments and stop rules, plus this command's metadata/default
// contract. Opaque paths and deliberately unreadable manifest transports ensure
// these queries never prepare plugins, consume manifests or start an LSP host.
//
// 1. Query valid replacement, spelling, termination, default and metadata cases.
// 2. Require exact effective project/binary values and explicit-config meaning.
// 3. Query malformed/unknown/transport refusals and a failed cwd default.
// 4. Require native status/diagnostic categories and untouched manifest state.
//
// @evidence contracts/testing.md#behavioral-verification Actual run enters the private query and returns parsed launch JSON or native invocation refusal; host and signal refusal seams guard accidental server startup, and inherited private manifest transports remain untouched.
// @evidence contracts/testing.md#independent-expectations Literal final assignments, documented FlagSet stop/spelling/value rules, native tsconfig default, environment binary fallback and zero/two statuses prescribe the expected values without deriving them from another invocation of the parser.
// @evidence contracts/testing.md#distinguishing-cases Repeated mixed equals/space and one/two-dash assignments, equal duplicates, terminator, first positional, dash-only positional, flag-looking string value, trimmed/blank values, default cwd/config/binary, all metadata aliases and invalid string/bool/duration/unknown/triple-dash/missing-stdio cases remain named subtests. A failed getwd has its own native refusal.
// @evidence contracts/testing.md#execution-ownership This Go unit runs the actual command parser/JSON writer in-process with restoring package writer/getwd/host/signal seams and t.Setenv. Paths are opaque data and no artifact build, filesystem project preparation, compiler or real server executes; dynamic subtests are owned by this selected Test declaration.
func TestResolveLaunchUsesNativeFlagAuthority(t *testing.T) {
  t.Setenv("TTSC_TSGO_BINARY", " /environment-tsgo ")
  t.Setenv("TTSC_LSP_PLUGINS_FILE", "must-not-be-read")
  t.Setenv("TTSC_LSP_PLUGINS_JSON", "must-not-be-decoded")
  previousGetwd, previousHost, previousNotify := getwd, runLSPServer, notifyContext
  getwd = func() (string, error) { return "/process-cwd", nil }
  runLSPServer = func(context.Context, lspserver.LSPServerOptions) error {
    t.Fatal("preparation query started an LSP host")
    return nil
  }
  notifyContext = func(context.Context, ...os.Signal) (context.Context, context.CancelFunc) {
    t.Fatal("preparation query installed signal handling")
    return context.Background(), func() {}
  }
  defer func() { getwd, runLSPServer, notifyContext = previousGetwd, previousHost, previousNotify }()

  for _, test := range []struct {
    name string
    args []string
    cwd string
    config string
    explicit bool
    tsgo string
  }{
    {"last assignments", []string{"--stdio", "--cwd", "/a", "-cwd=/b", "--tsconfig=first.json", "-tsconfig", "last.json", "--tsgo=/first", "-tsgo", "/last"}, "/b", "last.json", true, "/last"},
    {"equal duplicates", []string{"-stdio", "-cwd=/b", "--cwd", "/b", "-tsconfig=last.json", "--tsconfig=last.json"}, "/b", "last.json", true, "/environment-tsgo"},
    {"terminator", []string{"--stdio", "--cwd=/a", "--", "--cwd=/b", "--tsconfig=ignored.json", "--unknown"}, "/a", "tsconfig.json", false, "/environment-tsgo"},
    {"positional", []string{"--stdio", "--cwd=/a", "position", "--cwd=/b"}, "/a", "tsconfig.json", false, "/environment-tsgo"},
    {"dash positional", []string{"--stdio", "-", "--cwd=/b"}, "/process-cwd", "tsconfig.json", false, "/environment-tsgo"},
    {"flag-looking value", []string{"--stdio", "--cwd", "--literal-value"}, "--literal-value", "tsconfig.json", false, "/environment-tsgo"},
    {"trimmed values", []string{"--stdio", "--cwd= /b ", "--tsconfig= last.json ", "--tsgo= /last "}, "/b", "last.json", true, "/last"},
    {"blank replacements", []string{"--stdio", "--cwd=/a", "--cwd= ", "--tsconfig=first.json", "--tsconfig= ", "--tsgo=/first", "--tsgo= "}, "/process-cwd", "", true, "/environment-tsgo"},
    {"defaults", []string{"--stdio"}, "/process-cwd", "tsconfig.json", false, "/environment-tsgo"},
    {"later boolean override", []string{"--stdio=false", "-stdio=true", "--progress-delay=1s", "--clientProcessId=42"}, "/process-cwd", "tsconfig.json", false, "/environment-tsgo"},
  } {
    t.Run(test.name, func(t *testing.T) {
      var out, errOut bytes.Buffer
      withIO(t, &out, &errOut, nil, func() {
        if code := run(append([]string{"--ttsc-resolve-launch"}, test.args...)); code != 0 {
          t.Fatalf("query status %d: %s", code, errOut.String())
        }
      })
      var actual lspLaunchOptions
      if err := json.Unmarshal(out.Bytes(), &actual); err != nil {
        t.Fatal(err)
      }
      if !actual.LSP || actual.Cwd != test.cwd || actual.Tsconfig != test.config || actual.TsconfigExplicit != test.explicit || actual.TsgoBinary != test.tsgo {
        t.Fatalf("unexpected launch selection: %s", out.String())
      }
      if errOut.Len() != 0 {
        t.Fatalf("unexpected stderr: %s", errOut.String())
      }
    })
  }

  for _, head := range []string{"", "help", "-h", "--help", "version", "-v", "--version"} {
    t.Run("metadata "+head, func(t *testing.T) {
      args := []string{"--ttsc-resolve-launch"}
      if head != "" {
        args = append(args, head, "--stdio", "--unknown")
      }
      var out, errOut bytes.Buffer
      withIO(t, &out, &errOut, nil, func() {
        if code := run(args); code != 0 {
          t.Fatalf("metadata status %d: %s", code, errOut.String())
        }
      })
      var actual lspLaunchOptions
      if err := json.Unmarshal(out.Bytes(), &actual); err != nil {
        t.Fatal(err)
      }
      if actual.LSP || errOut.Len() != 0 {
        t.Fatalf("metadata prepared LSP: %s %s", out.String(), errOut.String())
      }
    })
  }

  for _, test := range []struct {
    name string
    args []string
    diagnostic string
  }{
    {"unknown", []string{"--stdio", "--cwd=/missing", "--unknown"}, "flag provided but not defined: -unknown"},
    {"missing string", []string{"--stdio", "--tsconfig"}, "flag needs an argument: -tsconfig"},
    {"invalid bool", []string{"--stdio=maybe"}, "invalid boolean value \"maybe\" for -stdio"},
    {"invalid duration", []string{"--stdio", "--progress-delay=invalid"}, "invalid value \"invalid\" for flag -progress-delay"},
    {"triple dash", []string{"--stdio", "---cwd=/a"}, "bad flag syntax"},
    {"missing stdio", []string{"--cwd=/a"}, "only --stdio transport is supported"},
    {"final false", []string{"--stdio", "-stdio=false"}, "only --stdio transport is supported"},
  } {
    t.Run(test.name, func(t *testing.T) {
      var out, errOut bytes.Buffer
      withIO(t, &out, &errOut, nil, func() {
        if code := run(append([]string{"--ttsc-resolve-launch"}, test.args...)); code != 2 {
          t.Fatalf("refusal status %d", code)
        }
      })
      if out.Len() != 0 || !strings.Contains(errOut.String(), test.diagnostic) {
        t.Fatalf("unexpected refusal stdout=%q stderr=%q", out.String(), errOut.String())
      }
    })
  }
  getwd = func() (string, error) { return "", errors.New("unavailable-cwd") }
  var out, errOut bytes.Buffer
  withIO(t, &out, &errOut, nil, func() {
    if code := run([]string{"--ttsc-resolve-launch", "--stdio"}); code != 2 {
      t.Fatalf("getwd refusal status %d", code)
    }
  })
  if out.Len() != 0 || !strings.Contains(errOut.String(), "could not resolve working directory: unavailable-cwd") {
    t.Fatalf("unexpected cwd refusal: %q %q", out.String(), errOut.String())
  }
  if os.Getenv("TTSC_LSP_PLUGINS_FILE") != "must-not-be-read" || os.Getenv("TTSC_LSP_PLUGINS_JSON") != "must-not-be-decoded" {
    t.Fatal("query consumed inherited manifest state")
  }
}
