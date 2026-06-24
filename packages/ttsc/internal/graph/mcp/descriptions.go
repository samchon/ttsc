package mcp

import (
  _ "embed"
  "strings"
)

// Tool and schema descriptions are embedded from Markdown files so prompt
// tuning stays reviewable text instead of long Go string literals.
//
//go:embed descriptions/query_nodes.md
var queryNodesDescriptionMarkdown string

//go:embed descriptions/query_nodes_query.md
var queryNodesQueryDescriptionMarkdown string

//go:embed descriptions/query_files.md
var queryFilesDescriptionMarkdown string

//go:embed descriptions/query_files_locations.md
var queryFilesLocationsDescriptionMarkdown string

//go:embed descriptions/query_diagnostics.md
var queryDiagnosticsDescriptionMarkdown string

//go:embed descriptions/query_diagnostics_files.md
var queryDiagnosticsFilesDescriptionMarkdown string

//go:embed descriptions/query_diagnostics_severity.md
var queryDiagnosticsSeverityDescriptionMarkdown string

var (
  queryNodesDescription               = strings.TrimSpace(queryNodesDescriptionMarkdown)
  queryNodesQueryDescription          = strings.TrimSpace(queryNodesQueryDescriptionMarkdown)
  queryFilesDescription               = strings.TrimSpace(queryFilesDescriptionMarkdown)
  queryFilesLocationsDescription      = strings.TrimSpace(queryFilesLocationsDescriptionMarkdown)
  queryDiagnosticsDescription         = strings.TrimSpace(queryDiagnosticsDescriptionMarkdown)
  queryDiagnosticsFilesDescription    = strings.TrimSpace(queryDiagnosticsFilesDescriptionMarkdown)
  queryDiagnosticsSeverityDescription = strings.TrimSpace(queryDiagnosticsSeverityDescriptionMarkdown)
)
