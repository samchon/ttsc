package ttsc_test

import (
  "bytes"
  "crypto/sha256"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "os"
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
// @evidence contracts/testing.md#behavioral-verification Calls real check and build entrypoints and checks delivered diagnostics, receipt ordering, actual PID, exact command fingerprint and status; unconditional, partial or incorrectly owned acknowledgement fails.
// @evidence contracts/testing.md#independent-expectations TypeScript requires TS2322 for the authored assignment and failure for an unknown option. The receipt PID is independently os.Getpid; its expected command hash is SHA-256 over the authored command and arguments with literal NUL boundaries, without calling the production fingerprint helper.
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
      {"prefixed-report", `export const value: number = 1;`, `"strict": true`, true, true, 0},
      {"no-request-prefix", `export const value: number = 1;`, `"strict": true`, false, false, 0},
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
        if scenario.name == "prefixed-report" || scenario.name == "no-request-prefix" {
          stderr.WriteString("progress-without-newline")
        }
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
        if scenario.name == "no-request-prefix" && text != "progress-without-newline" {
          t.Fatalf("ordinary streaming output changed: %q", text)
        }
        if status != scenario.status {
          t.Fatalf("status=%d, want %d; stderr=%s", status, scenario.status, text)
        }
        count := strings.Count(text, token)
        if scenario.completed && count != 1 || !scenario.completed && count != 0 {
          t.Fatalf("completion=%v, token count=%d; stderr=%s", scenario.completed, count, text)
        }
        if scenario.completed {
          var receipt struct {
            PID     int    `json:"pid"`
            Command string `json:"command"`
          }
          for _, line := range strings.Split(text, "\n") {
            if payload, found := strings.CutPrefix(line, token+" "); found {
              if err := json.Unmarshal([]byte(payload), &receipt); err != nil {
                t.Fatal(err)
              }
            }
          }
          input := command + "\x00--cwd\x00" + root + "\x00"
          for _, name := range []string{"TTSC_TSGO_ARGS", "TTSC_TSGO_ARGS_CWD", "TTSC_SEMANTIC_CONFIG_PATH", "TTSC_PLUGIN_CONFIG_DIR", "TTSC_COMPILATION_SNAPSHOT", "TTSC_LINKED_PLUGINS_JSON"} {
            input += os.Getenv(name) + "\x00"
          }
          expected := fmt.Sprintf("%x", sha256.Sum256([]byte(input)))
          if receipt.PID != os.Getpid() || receipt.Command != expected {
            t.Fatalf("receipt=%+v, want pid=%d command=%s", receipt, os.Getpid(), expected)
          }
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
