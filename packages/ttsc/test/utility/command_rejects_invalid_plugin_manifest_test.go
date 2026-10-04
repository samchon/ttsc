package ttsc_test

import (
  "bytes"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityCommandRejectsInvalidPluginManifest Verifies all project command
// routes preserve malformed manifest rejection before compiler loading.
//
// The shared dispatcher passes argv and writers into the real WithIO hosts.
// A lone opening brace must fail in their manifest parser before Program
// acquisition, so no project fixture or compiled plugin is needed.
//
// 1. Call build, transform and check for each package identity with JSON {.
// 2. Require status 2, empty stdout and the literal manifest-error prefix.
//
// @evidence contracts/testing.md#behavioral-verification RunCommandWithIO reaches each real build, transform and check owner and retains status 2, empty stdout and invalid --plugins-json stderr for the authored incomplete JSON.
// @evidence contracts/testing.md#independent-expectations A lone opening brace is incomplete JSON independently of the implementation; literal usage status and diagnostic prefix preserve the original E2E assertions without depending on JSON parser wording.
// @evidence contracts/testing.md#distinguishing-cases All three host routes run for all three package identities with identical malformed manifest argv; successful linked compilation, emitted output and E2E survival are outside this direct rejection case.
// @evidence contracts/testing.md#execution-ownership Go TestUtilityCommandRejectsInvalidPluginManifest under test/utility calls shared actual dispatch and real WithIO hosts using buffers; parsePluginEntries rejects before setLinkedPluginManifest or LoadProgram, with no producer, child or fixture.
func TestUtilityCommandRejectsInvalidPluginManifest(t *testing.T) {
  for _, name := range []string{"@ttsc/banner", "@ttsc/paths", "@ttsc/strip"} {
    for _, command := range []string{"build", "transform", "check"} {
      t.Run(name+"/"+command, func(t *testing.T) {
        var stdout, stderr bytes.Buffer
        code := utility.RunCommandWithIO(name, "0.0.1", []string{command, "--plugins-json={"}, &stdout, &stderr)
        if code != 2 || stdout.String() != "" || !strings.Contains(stderr.String(), "ttsc utility: invalid --plugins-json") {
          t.Fatalf("manifest mismatch: code=%d stdout=%q stderr=%q", code, stdout.String(), stderr.String())
        }
      })
    }
  }
}
