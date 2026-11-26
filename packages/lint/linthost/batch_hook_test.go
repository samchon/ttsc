package linthost

import (
  "bytes"
  "slices"
  "strings"
  "testing"
)

// TestBatchHookRunsOnOneShotCheckAndNotResidentPaths verifies linthost calls
// the compiler shim's BeginBatchOnce gate on its one-shot check path before
// Program creation and invokes the returned callback after binding and before
// diagnostics, while resident check-serve and lsp-serve paths never call it.
//
//  1. Run one-shot RunCheckWithIO on a project with a lint error; assert
//     beginBatchOnce runs and its returned programBound callback fires before
//     any diagnostics are written to stderr.
//  2. Run resident check-serve and resident lsp-serve Program acquisition;
//     assert beginBatchOnce is never called.
//
// @evidence contracts/testing.md#behavioral-verification Exercises real RunCheckWithIO, residentCheckState.run and residentProgramCache.acquire with a recording stub on the package-level beginBatchOnce seam, verifying pre-diagnostic callback timing and resident exclusion.
// @evidence contracts/testing.md#independent-expectations The begin-gate -> bound ordering before stderr diagnostics and zero calls on resident paths come directly from the batch hook contract and authored no-var fixture.
// @evidence contracts/testing.md#distinguishing-cases One-shot check contrasts resident check-serve and resident lsp-serve acquisition; TTSC_BATCH marker gating and once-per-process deduplication are owned by shim/compiler's batch_test.go.
// @evidence contracts/testing.md#execution-ownership Go discovers this whitebox linthost unit directly in package linthost. It owns one temporary project, restores beginBatchOnce via t.Cleanup and builds no native host.
func TestBatchHookRunsOnOneShotCheckAndNotResidentPaths(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1;\nJSON.stringify(legacy);\n")
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  manifest := lintManifest(t)

  t.Run("one-shot check calls gate and signals bound before diagnostics", func(t *testing.T) {
    var events []string
    var stdout, stderr bytes.Buffer
    installLinthostBatchGateStubForTest(t, func() func() {
      events = append(events, "begin-gate")
      return func() {
        if stderr.Len() != 0 {
          t.Errorf("diagnostics were already written before programBound: %q", stderr.String())
        }
        events = append(events, "bound")
      }
    })

    code := RunCheckWithIO([]string{"--cwd", root, "--plugins-json", manifest}, &stdout, &stderr)
    if code != 2 || !strings.Contains(stderr.String(), "[no-var]") {
      t.Fatalf("RunCheckWithIO: code=%d stderr=%q", code, stderr.String())
    }
    if want := []string{"begin-gate", "bound"}; !slices.Equal(events, want) {
      t.Fatalf("events after check = %v, want %v", events, want)
    }
  })

  t.Run("resident check-serve never calls gate", func(t *testing.T) {
    var gateCalls, boundCalls int
    installLinthostBatchGateStubForTest(t, func() func() {
      gateCalls++
      return func() { boundCalls++ }
    })

    base, err := parseSubcommandFlagsWithIO("check-serve", []string{"--cwd", root, "--plugins-json", manifest}, nil, nil)
    if err != nil {
      t.Fatal(err)
    }
    base.noEmit = true
    state := &residentCheckState{}
    defer state.close()

    result := state.run(base, false)
    if result.Status != 2 || result.Telemetry.ProgramLoads != 1 || !strings.Contains(result.Stderr, "[no-var]") {
      t.Fatalf("resident check-serve = %#v", result)
    }
    if gateCalls != 0 || boundCalls != 0 {
      t.Fatalf("resident check-serve called batch gate: gate=%d bound=%d", gateCalls, boundCalls)
    }
  })

  t.Run("resident lsp-serve acquire never calls gate", func(t *testing.T) {
    var gateCalls, boundCalls int
    installLinthostBatchGateStubForTest(t, func() func() {
      gateCalls++
      return func() { boundCalls++ }
    })

    cache := newResidentProgramCache()
    defer cache.invalidate()
    prog, diags, _, err := cache.acquire(&lspCommandOptions{
      cwd:         root,
      tsconfig:    "tsconfig.json",
      pluginsJSON: manifest,
    }, false)
    if err != nil || len(diags) != 0 || prog == nil {
      t.Fatalf("resident lsp-serve acquire: prog=%v diags=%v err=%v", prog, diags, err)
    }
    if gateCalls != 0 || boundCalls != 0 {
      t.Fatalf("resident lsp-serve called batch gate: gate=%d bound=%d", gateCalls, boundCalls)
    }
  })
}

func installLinthostBatchGateStubForTest(t *testing.T, stub func() func()) {
  t.Helper()
  saved := beginBatchOnce
  beginBatchOnce = stub
  t.Cleanup(func() {
    beginBatchOnce = saved
  })
}
