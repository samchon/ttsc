package ttsc_test

import (
  "bytes"
  "errors"
  "io"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityProgramReportAcknowledgesCompletion verifies check and build
// acknowledge a loaded Program's complete report, including an empty batch.
// Configuration diagnostics have no loaded Program and cannot suppress recovery.
//
//  1. Request a private completion token for valid, type-invalid and bad-config projects.
//  2. Invoke both public utility commands with invocation-owned output buffers.
//  3. Assert loaded reports precede exactly one token, early failures have none,
//     and a command without a token request preserves ordinary output.
//
// @evidence contracts/testing.md#behavioral-verification Calls real check and build entrypoints over authored projects and asserts actual diagnostic delivery, completion ordering and exit status; unconditional or error-only acknowledgement fails.
// @evidence contracts/testing.md#independent-expectations A string-to-number assignment requires TS2322, an unknown compiler option requires a configuration failure, and the protocol permits acknowledgement only after a loaded Program's full diagnostic batch.
// @evidence contracts/testing.md#distinguishing-cases Covers check and emitting build, error and empty batches, pre-Program configuration failure, failed and short diagnostic writes, and absent opt-in. Launcher filtering and partial-process crashes belong to TypeScript units and the transform-host E2E.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes utility functions in-process using private buffers and t.TempDir projects; it launches no product process or consumer installation.
func TestUtilityProgramReportAcknowledgesCompletion(t *testing.T) {
  const token = "ttsc:diagnostics-complete:unit"
  for _, command := range []string{"check", "build"} {
    for _, scenario := range []struct {
      name      string
      source    string
      options   string
      requested bool
      completed bool
      status    int
    }{
      {"type-error", `export const value: number = "bad";`, `"strict": true`, true, true, 2},
      {"empty-report", `export const value: number = 1;`, `"strict": true`, true, true, 0},
      {"config-error", `export const value: number = "bad";`, `"unknownCompilerOption": true`, true, false, 2},
      {"no-request", `export const value: number = "bad";`, `"strict": true`, false, false, 2},
      {"write-error", `export const value: number = "bad";`, `"strict": true`, true, false, 2},
      {"short-write", `export const value: number = "bad";`, `"strict": true`, true, false, 2},
    } {
      t.Run(command+"/"+scenario.name, func(t *testing.T) {
        request := ""
        if scenario.requested {
          request = token
        }
        t.Setenv("TTSC_DIAGNOSTICS_COMPLETION_TOKEN", request)
        root := t.TempDir()
        writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"target":"ES2022","module":"commonjs","outDir":"dist",`+scenario.options+`},"files":["index.ts"]}`)
        writeProjectFile(t, root, "index.ts", scenario.source)
        var stdout, stderr bytes.Buffer
        var writer io.Writer = &stderr
        if scenario.name == "write-error" || scenario.name == "short-write" {
          writer = &programReportWriter{output: &stderr, short: scenario.name == "short-write"}
        }
        args := []string{"--cwd", root}
        var status int
        if command == "check" {
          status = utility.RunCheckWithIO(args, &stdout, writer)
        } else {
          status = utility.RunBuildWithIO(args, &stdout, writer)
        }
        text := stderr.String()
        if status != scenario.status {
          t.Fatalf("status=%d, want %d; stderr=%s", status, scenario.status, text)
        }
        count := strings.Count(text, token)
        if scenario.completed && count != 1 || !scenario.completed && count != 0 {
          t.Fatalf("completion=%v, token count=%d; stderr=%s", scenario.completed, count, text)
        }
        if scenario.name == "type-error" || scenario.name == "no-request" {
          diagnostic := strings.Index(text, "TS2322")
          if diagnostic < 0 || scenario.completed && strings.Index(text, token) < diagnostic {
            t.Fatalf("diagnostic must precede acknowledgement: %s", text)
          }
        }
        if strings.Contains(stdout.String(), token) {
          t.Fatalf("completion leaked to stdout: %s", stdout.String())
        }
      })
    }
  }
}

// programReportWriter rejects the first transfer but accepts subsequent writes,
// so an erroneous completion acknowledgement remains observable.
type programReportWriter struct {
  output   *bytes.Buffer
  rejected bool
  short    bool
}

// Write supplies the io.Writer failure boundary used by the completion test.
func (w *programReportWriter) Write(data []byte) (int, error) {
  if !w.rejected {
    w.rejected = true
    if w.short {
      return 0, nil
    }
    return 0, errors.New("diagnostic stream failed")
  }
  return w.output.Write(data)
}
