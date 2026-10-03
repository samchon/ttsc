package driver_test

import (
  "context"
  "errors"
  "io"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRejectsValidatorWithoutRunner Verifies that RunLSPServer rejects a validator without its paired runner before invoking it.
//
// Otherwise valid Cwd and the untouched called flag isolate the incomplete dependency pair.
//
// 1. Supply a custom Validator without a custom Runner.
// 2. Call RunLSPServer with an otherwise valid Cwd.
// 3. Assert the incomplete pair is rejected before the validator runs.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer rejects a validator without its paired runner before invoking it.
// @evidence contracts/testing.md#independent-expectations Validator prerequisites must belong to their runner; a validator-only pair is invalid.
// @evidence contracts/testing.md#distinguishing-cases Otherwise valid Cwd and the untouched called flag isolate the incomplete dependency pair.
// @evidence contracts/testing.md#execution-ownership The direct Go server call exits at validation without launching a process. Go discovers TestLSPServerRejectsValidatorWithoutRunner under ./test/driver.
func TestLSPServerRejectsValidatorWithoutRunner(t *testing.T) {
  validatorCalled := false
  err := driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
    In:  strings.NewReader(""),
    Out: io.Discard,
    Err: io.Discard,
    Cwd: t.TempDir(),
    Upstream: driver.LSPUpstream{
      Validator: func(driver.LSPServerOptions) error {
        validatorCalled = true
        return nil
      },
    },
  })
  if !errors.Is(err, driver.ErrLSPUpstreamRunnerRequired) {
    t.Fatalf("expected ErrLSPUpstreamRunnerRequired, got %v", err)
  }
  if validatorCalled {
    t.Fatal("custom validator ran without a paired custom runner")
  }
}
