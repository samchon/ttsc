package lspserver

import "testing"

// TestExternalWatchedChangeRetainsProgram checks the retain-or-reload admission
// predicate on fifteen authored URI/change-kind pairs. No Program is constructed,
// retained, reloaded, or incrementally updated in this direct predicate unit.
//
// Project-input globs may overlap source files even though Markdown and
// OpenAPI are the common case, but a JSON path may also be a resolveJsonModule
// source. JSON create/delete changes possible Program topology, while in-place
// JSON edits and data-only reference topology preserve the current root graph,
// except package metadata whose content participates in module resolution.
//
//  1. Retain changed Markdown and Swagger inputs.
//  2. Retain an in-place TypeScript edit for incremental Program update.
//  3. Reload package metadata, created/deleted modules, and project configs.
//
// @evidence contracts/testing.md#behavioral-verification Compares fifteen direct predicate results with literal booleans for selected data/source/JSON/package/config changes and invalid URI/type premises. The results select retain-or-reload policy; actual Program lifetime, root population, event delivery, and incremental refresh are not observed.
// @evidence contracts/testing.md#independent-expectations The expected retain-or-reload decision is a literal per event kind.
// @evidence contracts/testing.md#distinguishing-cases A JSON path that can be a resolveJsonModule source is the boundary between data and Program topology.
// @evidence contracts/testing.md#execution-ownership Directly supplies URI strings and optional integer kinds to externalWatchedChangeRetainsProgram in this process. It substitutes no seam, creates no native fixture, loads no Program, resolves no sidecar, and starts no product process or editor connection.
func TestExternalWatchedChangeRetainsProgram(t *testing.T) {
  changed := fileChangeTypeChanged
  created := fileChangeTypeCreated
  deleted := fileChangeTypeDeleted
  cases := []struct {
    uri        string
    changeType *int
    want       bool
  }{
    {uri: "file:///project/docs/spec.md", changeType: &changed, want: true},
    {uri: "file:///project/api/openapi.json", changeType: &changed, want: true},
    {uri: "file:///project/package.json", changeType: &changed, want: false},
    {uri: "file:///project/PACKAGE.JSON", changeType: &changed, want: false},
    {uri: "file:///project/api/openapi.json", changeType: &created, want: false},
    {uri: "file:///project/api/openapi.json", changeType: &deleted, want: false},
    {uri: "file:///project/api/openapi.JSON", changeType: &created, want: false},
    {uri: "file:///project/api/openapi.yaml", changeType: &deleted, want: true},
    {uri: "file:///project/src/main.ts", changeType: &changed, want: true},
    {uri: "file:///project/src/main.ts", changeType: &created, want: false},
    {uri: "file:///project/src/main.ts", changeType: &deleted, want: false},
    {uri: "file:///project/tsconfig.json", changeType: &changed, want: false},
    {uri: "https://example.com/openapi.json", changeType: &changed, want: false},
    {uri: "", changeType: &changed, want: false},
    {uri: "file:///project/docs/spec.md", changeType: nil, want: false},
  }
  for _, tc := range cases {
    if got := externalWatchedChangeRetainsProgram(tc.uri, tc.changeType); got != tc.want {
      t.Fatalf(
        "externalWatchedChangeRetainsProgram(%q, %v) = %v, want %v",
        tc.uri,
        tc.changeType,
        got,
        tc.want,
      )
    }
  }
}
