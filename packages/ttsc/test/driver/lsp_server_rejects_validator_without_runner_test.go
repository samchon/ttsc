package driver_test

import (
  "context"
  "errors"
  "io"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRejectsValidatorWithoutRunner verifies that an invocation cannot
// replace the production validator while retaining the production runner.
//
// A validator describes the prerequisites of its paired runner. Accepting one
// without the other would let a custom validator bypass the default runner's
// absolute TsgoBinary contract.
//
// 1. Supply a custom Validator without a custom Runner.
// 2. Call RunLSPServer with an otherwise valid Cwd.
// 3. Assert the incomplete pair is rejected before the validator runs.
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
