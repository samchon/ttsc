package banner_test

import (
  "errors"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestTypeScriptConfigLoaderPreparationReportsIOFailures verifies loader preparation admission.
//
// File preparation owns the decision to admit a loader only after dependency
// linking and all three writes succeed. Invocation-owned I/O inputs exercise
// those decisions without replacing foreign globals or launching a compiler.
// The native adapters and executable loader remain verified by the E2E cases.
//
// 1. Fail linking, recorder writing, loader writing and tsconfig writing separately.
// 2. Verify the original error context and that later writes are not attempted.
// 3. Verify success returns both filenames after all preparation effects complete.
//
// @evidence contracts/testing.md#behavioral-verification The actual prepareBannerTypeScriptConfigLoader must propagate link failure, label recorder/loader failures as write config loader and tsconfig failure as write config loader tsconfig, return no admitted paths on failure and complete three ordered writes on success.
// @evidence contracts/testing.md#independent-expectations Literal stage names and original diagnostic contexts define the expected protocol independently of the implementation; invocation-owned callbacks report supplied success or failure and count observable calls, rather than replacing a product global.
// @evidence contracts/testing.md#distinguishing-cases Separate link, first-write, second-write and third-write failures prove short-circuit admission and preserve the original three error assertions; successful preparation is the adjacent control and no callback establishes actual kernel linking or runtime evaluation.
// @evidence contracts/testing.md#execution-ownership This named Go source unit calls the actual owning preparation operation directly through the utility unit overlay; the callbacks model its explicit I/O input outcomes, while native adapters and generated-code execution remain in TestTypeScriptConfigLoader and TestTypeScriptConfigLoaderPrecedence.
func TestTypeScriptConfigLoaderPreparationReportsIOFailures(t *testing.T) {
  root := t.TempDir()
  config := filepath.Join(root, "banner.config.ts")
  for _, scenario := range []struct {
    name string
    failWrite int
    linkFailure bool
    expected string
    writes int
  }{
    {"link", 0, true, "link failed", 0},
    {"recorder", 1, false, "write config loader", 1},
    {"loader", 2, false, "write config loader", 2},
    {"tsconfig", 3, false, "write config loader tsconfig", 3},
    {"success", 0, false, "", 3},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      directory := t.TempDir()
      writes, links := 0, 0
      loader, tsconfig, err := bannerPrepareTypeScriptConfigLoader(
        directory, config,
        func(destination, source string) error {
          links++
          if destination != directory || source != root {
            t.Fatalf("link input: destination=%q source=%q", destination, source)
          }
          if scenario.linkFailure {
            return errors.New("link failed")
          }
          return nil
        },
        func(name string, data []byte, mode os.FileMode) error {
          writes++
          names := []string{"ttsc-resolution-inputs.cjs", "loader.mts", "tsconfig.json"}
          if writes > len(names) || name != filepath.Join(directory, names[writes-1]) || len(data) == 0 || mode != 0o644 {
            t.Fatalf("write input: call=%d name=%q bytes=%d mode=%v", writes, name, len(data), mode)
          }
          if writes == scenario.failWrite {
            return errors.New("file write failed")
          }
          return os.WriteFile(name, data, mode)
        },
      )
      if links != 1 || writes != scenario.writes {
        t.Fatalf("preparation effects: links=%d writes=%d want=1/%d", links, writes, scenario.writes)
      }
      if scenario.expected != "" {
        if err == nil || !strings.Contains(err.Error(), scenario.expected) || loader != "" || tsconfig != "" {
          t.Fatalf("preparation failure: err=%v loader=%q tsconfig=%q", err, loader, tsconfig)
        }
      } else if err != nil || loader != filepath.Join(directory, "loader.mts") || tsconfig != filepath.Join(directory, "tsconfig.json") {
        t.Fatalf("preparation success: err=%v loader=%q tsconfig=%q", err, loader, tsconfig)
      }
    })
  }
}
