package mcp

import (
  "encoding/json"
  "os"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// injectedDiagnostic is the wire shape a plugin-aware host serializes for the
// graph to fuse. The prebuilt ttscgraph runs only the tsc semantic pass; the
// @ttsc/graph launcher, which can evaluate the project's lint.config and run
// ttsc's plugin-aware check, writes the project's @ttsc/lint rule violations and
// transform-plugin diagnostics here. Each carries the byte offset (start) the
// fusion attributes by, so an injected lint finding lands on the same node a tsc
// error would.
type injectedDiagnostic struct {
  File    string `json:"file"`
  Start   *int   `json:"start"`
  Line    int    `json:"line"`
  Column  int    `json:"column"`
  Code    int32  `json:"code"`
  Message string `json:"message"`
}

// ParseInjectedDiagnostics decodes the host-supplied diagnostics JSON into the
// driver shape the fusion consumes.
func ParseInjectedDiagnostics(data []byte) ([]driver.Diagnostic, error) {
  var in []injectedDiagnostic
  if err := json.Unmarshal(data, &in); err != nil {
    return nil, err
  }
  out := make([]driver.Diagnostic, 0, len(in))
  for _, d := range in {
    out = append(out, driver.Diagnostic{
      // Normalize to forward slashes: the launcher resolves the file with the
      // OS separator (backslashes on Windows), but tsgo's FileName() — which the
      // graph nodes and tsc diagnostics use — is always forward-slash, so an
      // un-normalized path would never match a node or a tsc twin and the whole
      // injected set would silently fail to fuse on Windows.
      File:    strings.ReplaceAll(d.File, "\\", "/"),
      Start:   d.Start,
      Line:    d.Line,
      Column:  d.Column,
      Code:    d.Code,
      Message: d.Message,
    })
  }
  return out, nil
}

// InjectedDiagnosticsProvider returns a DiagnosticProvider that contributes the
// diagnostics serialized at path. The path is set by the launcher only when the
// project has plugins whose diagnostics the prebuilt binary cannot compute
// itself; a missing or malformed file yields none rather than failing the
// server, so a project without plugins simply shows the tsc diagnostics alone.
func InjectedDiagnosticsProvider(path string) DiagnosticProvider {
  return func(*driver.Program) []driver.Diagnostic {
    data, err := os.ReadFile(path)
    if err != nil {
      return nil
    }
    diags, err := ParseInjectedDiagnostics(data)
    if err != nil {
      return nil
    }
    return diags
  }
}
