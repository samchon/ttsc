package ttsc_test

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestTransformConfigFailureRetainsRecoveryGraph verifies native transform and
// check envelopes preserve a rejected config's actual recovery observations.
//
// The adapter needs these paths even when no compiler Program exists.
//
//  1. Run the utility transform against a missing extended config.
//  2. Read the same failed check's private observation result.
//  3. Require failure status, no source output and the missing-path predicate.
//
// @evidence contracts/testing.md#behavioral-verification Actual RunTransformWithIO and RunCheckWithIO publish failed-load recovery graphs for the same config error without creating source output or returning success.
// @evidence contracts/testing.md#independent-expectations Literal missing.json requires a false FileExists observation; status 2, empty TypeScript and explicit incomplete check metadata independently constrain the response.
// @evidence contracts/testing.md#distinguishing-cases Transform stdout versus check artifact, nil Program config failure versus the existing loaded-Program resolution failure, and both targets distinguish metadata transport from compiler success.
// @evidence contracts/testing.md#execution-ownership The utility Go suite invokes the maintained APIs in process with owned streams and one temporary project/artifact; no binary build, package installation or subprocess is required.
func TestTransformConfigFailureRetainsRecoveryGraph(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"extends":"./missing.json","files":["main.ts"]}`)
  writeProjectFile(t, root, "main.ts", "export const value = 1;\n")
  var stdout, stderr bytes.Buffer
  status := utility.RunTransformWithIO([]string{"--cwd", root}, &stdout, &stderr)
  var transformed struct {
    TypeScript map[string]string      `json:"typescript"`
    Graph      *driver.TransformGraph `json:"graph"`
    Complete   *bool                  `json:"observationsComplete"`
  }
  if err := json.Unmarshal(stdout.Bytes(), &transformed); err != nil {
    t.Fatal(err)
  }
  if status != 2 || len(transformed.TypeScript) != 0 || transformed.Graph == nil || !slices.Contains(transformed.Graph.ResolutionInputs, "missing.json") {
    t.Fatalf("transform failure metadata: status=%d output=%s error=%s", status, &stdout, &stderr)
  }
  if transformed.Complete == nil || *transformed.Complete {
    t.Fatalf("transform failed load claimed completeness: %s", &stdout)
  }
  observations := filepath.Join(root, "check.json")
  stdout.Reset()
  stderr.Reset()
  status = utility.RunCheckWithIO([]string{"--cwd", root, "--check-observations-json", observations}, &stdout, &stderr)
  data, err := os.ReadFile(observations)
  if err != nil {
    t.Fatal(err)
  }
  var checked struct {
    Graph    *driver.TransformGraph `json:"graph"`
    Complete *bool                  `json:"observationsComplete"`
  }
  if err := json.Unmarshal(data, &checked); err != nil {
    t.Fatal(err)
  }
  if status != 2 || checked.Complete == nil || *checked.Complete || checked.Graph == nil {
    t.Fatalf("check failure metadata: %s", data)
  }
  missing := checked.Graph.InputObservations["missing.json"].FileExists
  if missing == nil || *missing {
    t.Fatalf("missing recovery predicate: %s", data)
  }
}
