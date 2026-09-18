package ttsc_test

import (
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strconv"
  "strings"
  "testing"
)

type apiDiagnostic struct {
  Category    string `json:"category"`
  MessageText string `json:"messageText"`
}

type apiCompileResult struct {
  Diagnostics []apiDiagnostic   `json:"diagnostics,omitempty"`
  Output      map[string]string `json:"output"`
}

type apiTransformResult struct {
  Diagnostics []apiDiagnostic   `json:"diagnostics,omitempty"`
  TypeScript  map[string]string `json:"typescript"`
}

type utilityTransformResult struct {
  HostInputHashes    map[string]*string          `json:"hostInputHashes,omitempty"`
  HostInputRealpaths map[string]*string          `json:"hostInputRealpaths,omitempty"`
  HostInputs         []string                    `json:"hostInputs,omitempty"`
  SourceMaps         map[string]utilitySourceMap `json:"sourceMaps,omitempty"`
  TypeScript         map[string]string           `json:"typescript"`
}

// utilitySourceMap is the version 3 source map the transform envelope carries
// per printed file.
type utilitySourceMap struct {
  File           string    `json:"file"`
  Mappings       string    `json:"mappings"`
  Sources        []string  `json:"sources"`
  SourcesContent []*string `json:"sourcesContent"`
  Version        int       `json:"version"`
}

// sourceMapSegment is one decoded mapping: a generated position and the
// source position it maps to.
type sourceMapSegment struct {
  GeneratedLine, GeneratedColumn, Source, SourceLine, SourceColumn int
}

// decodeSourceMapMappings decodes a version 3 `mappings` string into its
// segments that carry a source position.
func decodeSourceMapMappings(t *testing.T, mappings string) []sourceMapSegment {
  t.Helper()
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  var segments []sourceMapSegment
  source, sourceLine, sourceColumn := 0, 0, 0
  for line, text := range strings.Split(mappings, ";") {
    column := 0
    for _, encoded := range strings.Split(text, ",") {
      if encoded == "" {
        continue
      }
      var fields []int
      value, shift := 0, 0
      for _, char := range encoded {
        digit := strings.IndexRune(alphabet, char)
        if digit < 0 {
          t.Fatalf("invalid base64 VLQ %q in %q", char, mappings)
        }
        value += (digit & 31) << shift
        if digit&32 != 0 {
          shift += 5
          continue
        }
        if value&1 != 0 {
          fields = append(fields, -(value >> 1))
        } else {
          fields = append(fields, value>>1)
        }
        value, shift = 0, 0
      }
      column += fields[0]
      if len(fields) < 4 {
        continue
      }
      source += fields[1]
      sourceLine += fields[2]
      sourceColumn += fields[3]
      segments = append(segments, sourceMapSegment{line, column, source, sourceLine, sourceColumn})
    }
  }
  return segments
}

// packageRoot returns the `packages/ttsc` module root from this black-box test
// package. Command tests run from that directory so `go run ./cmd/ttsc` uses
// the same module graph as a developer running the native host by hand.
func packageRoot(t *testing.T) string {
  t.Helper()
  _, file, _, ok := runtime.Caller(0)
  if !ok {
    t.Fatal("could not resolve test helper path")
  }
  return filepath.Dir(filepath.Dir(filepath.Dir(file)))
}

// writeProjectFile materializes one project-shaped fixture file. The tests in
// this package intentionally build real tsconfig projects instead of mocking
// compiler internals, so each scenario owns its whole temporary project tree.
func writeProjectFile(t *testing.T, root, name, contents string) {
  t.Helper()
  file := filepath.Join(root, filepath.FromSlash(name))
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(contents), 0o644); err != nil {
    t.Fatal(err)
  }
}

// runNativeCommand executes the Go ttsc command exactly through its CLI entry
// point. This keeps command-frontdoor tests black-box: only exit code, stdout,
// stderr, and generated project files are observed.
func runNativeCommand(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  goArgs := []string{"run"}
  if coverDir := os.Getenv("TTSC_NATIVE_COMMAND_COVERDIR"); coverDir != "" {
    if err := os.MkdirAll(coverDir, 0o755); err != nil {
      t.Fatal(err)
    }
    goArgs = append(goArgs, "-cover", "-coverpkg=./cmd/ttsc,./driver,./utility")
  }
  cmd := exec.Command("go", append(append(goArgs, "./cmd/ttsc"), args...)...)
  cmd.Dir = packageRoot(t)
  if coverDir := os.Getenv("TTSC_NATIVE_COMMAND_COVERDIR"); coverDir != "" {
    cmd.Env = append(os.Environ(), "GOCOVERDIR="+coverDir)
  }
  out, err := cmd.Output()
  stderr := ""
  if exit, ok := err.(*exec.ExitError); ok {
    stderr = string(exit.Stderr)
    if status, ok := goRunExitStatus(stderr); ok {
      return status, string(out), stderr
    }
    return exit.ExitCode(), string(out), stderr
  }
  if err != nil {
    t.Fatalf("go run ./cmd/ttsc failed before exit code: %v", err)
  }
  return 0, string(out), stderr
}

// goRunExitStatus recovers the wrapped program exit code from `go run`.
// The Go tool exits with status 1 for any non-zero program status and appends
// `exit status N` to stderr, so command-frontdoor tests need this small unwrap.
func goRunExitStatus(stderr string) (int, bool) {
  for _, line := range strings.Split(strings.TrimSpace(stderr), "\n") {
    line = strings.TrimSpace(line)
    if !strings.HasPrefix(line, "exit status ") {
      continue
    }
    value := strings.TrimPrefix(line, "exit status ")
    status, err := strconv.Atoi(value)
    if err != nil {
      return 0, false
    }
    return status, true
  }
  return 0, false
}

// captureUtilityOutput redirects process stdout/stderr around utility package
// entrypoints. The utility host intentionally writes to os.Stdout/os.Stderr
// because it is a command-sidecar API; the test captures those real streams.
func captureUtilityOutput(t *testing.T, fn func() int) (int, string, string) {
  t.Helper()
  prevOut, prevErr := os.Stdout, os.Stderr
  outReader, outWriter, err := os.Pipe()
  if err != nil {
    t.Fatal(err)
  }
  errReader, errWriter, err := os.Pipe()
  if err != nil {
    t.Fatal(err)
  }
  os.Stdout = outWriter
  os.Stderr = errWriter
  code := fn()
  if err := outWriter.Close(); err != nil {
    t.Fatal(err)
  }
  if err := errWriter.Close(); err != nil {
    t.Fatal(err)
  }
  os.Stdout = prevOut
  os.Stderr = prevErr
  out, err := io.ReadAll(outReader)
  if err != nil {
    t.Fatal(err)
  }
  errOut, err := io.ReadAll(errReader)
  if err != nil {
    t.Fatal(err)
  }
  return code, string(out), string(errOut)
}
