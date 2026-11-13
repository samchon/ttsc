package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// TestCheckObservationsRecordBrowserslistEnvironmentReads verifies the
// variables the browserslist port reads are published as inputs of the check
// result (samchon/ttsc#1855).
//
// `unicorn/no-unnecessary-polyfills` picks its target browsers from
// BROWSERSLIST, BROWSERSLIST_ENV and NODE_ENV, so they decide its diagnostics.
// A consumer that reuses a stored check result refuses it when a listed value
// changed; an unlisted one would let it replay the verdict of another section.
//
//  1. Author a package.json with production and development sections.
//  2. Resolve its config through the rule's loader, then publish observations.
//  3. Assert each variable the loader consulted is listed, set or unset.
//
// @evidence contracts/testing.md#behavioral-verification The production loader reads a real package.json and the production writer publishes the observation file this process would hand to ttsc; the decoded environmentInputs are observed directly.
// @evidence contracts/testing.md#independent-expectations Upstream browserslist consults BROWSERSLIST and BROWSERSLIST_CONFIG before discovery, then BROWSERSLIST_ENV and NODE_ENV to pick a section, so those four names are expected independently of the ledger.
// @evidence contracts/testing.md#distinguishing-cases An unset variable recorded as absent and a set one recorded with a value, both under the section the loader returned, separate reads from non-reads.
// @evidence contracts/testing.md#execution-ownership Direct in-process calls over a temporary directory; no Program, compiler or Node process runs. The ledger is process-wide by design, so values another test read first are not asserted.
func TestCheckObservationsRecordBrowserslistEnvironmentReads(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "package.json"), `{
  "browserslist": {
    "production": ["chrome 100"],
    "development": ["firefox 100"]
  }
}`)
  t.Setenv("BROWSERSLIST", "")
  t.Setenv("BROWSERSLIST_CONFIG", "")
  t.Setenv("BROWSERSLIST_ENV", "")
  t.Setenv("NODE_ENV", "development")
  if err := os.Unsetenv("BROWSERSLIST_ENV"); err != nil {
    t.Fatal(err)
  }
  queries, found, err := browserslistLoadConfig(browserslistOpts{path: root})
  if err != nil || !found || len(queries) != 1 {
    t.Fatalf("loader returned %v, %v, %v", queries, found, err)
  }

  observations := filepath.Join(root, "observations.json")
  var p *program
  if err := p.writeCheckObservations(observations); err != nil {
    t.Fatal(err)
  }
  data, err := os.ReadFile(observations)
  if err != nil {
    t.Fatal(err)
  }
  var decoded struct {
    EnvironmentInputs map[string]*string `json:"environmentInputs"`
  }
  if err := json.Unmarshal(data, &decoded); err != nil {
    t.Fatal(err)
  }
  for _, name := range []string{"BROWSERSLIST", "BROWSERSLIST_CONFIG", "BROWSERSLIST_ENV", "NODE_ENV"} {
    if _, listed := decoded.EnvironmentInputs[name]; !listed {
      t.Errorf("%s is not listed: %s", name, data)
    }
  }
}
