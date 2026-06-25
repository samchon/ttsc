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

//go:embed descriptions/query_exports.md
var queryExportsDescriptionMarkdown string

//go:embed descriptions/query_exports_query.md
var queryExportsQueryDescriptionMarkdown string

//go:embed descriptions/query_exports_limit.md
var queryExportsLimitDescriptionMarkdown string

//go:embed descriptions/query_exports_offset.md
var queryExportsOffsetDescriptionMarkdown string

//go:embed descriptions/query_nodes_query.md
var queryNodesQueryDescriptionMarkdown string

//go:embed descriptions/query_nodes_mode.md
var queryNodesModeDescriptionMarkdown string

//go:embed descriptions/expand_nodes.md
var expandNodesDescriptionMarkdown string

//go:embed descriptions/expand_nodes_ids.md
var expandNodesIDsDescriptionMarkdown string

//go:embed descriptions/expand_nodes_mode.md
var expandNodesModeDescriptionMarkdown string

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
  queryExportsDescription             = strings.TrimSpace(queryExportsDescriptionMarkdown)
  queryExportsQueryDescription        = strings.TrimSpace(queryExportsQueryDescriptionMarkdown)
  queryExportsLimitDescription        = strings.TrimSpace(queryExportsLimitDescriptionMarkdown)
  queryExportsOffsetDescription       = strings.TrimSpace(queryExportsOffsetDescriptionMarkdown)
  queryNodesQueryDescription          = strings.TrimSpace(queryNodesQueryDescriptionMarkdown)
  queryNodesModeDescription           = strings.TrimSpace(queryNodesModeDescriptionMarkdown)
  expandNodesDescription              = strings.TrimSpace(expandNodesDescriptionMarkdown)
  expandNodesIDsDescription           = strings.TrimSpace(expandNodesIDsDescriptionMarkdown)
  expandNodesModeDescription          = strings.TrimSpace(expandNodesModeDescriptionMarkdown)
  queryFilesDescription               = strings.TrimSpace(queryFilesDescriptionMarkdown)
  queryFilesLocationsDescription      = strings.TrimSpace(queryFilesLocationsDescriptionMarkdown)
  queryDiagnosticsDescription         = strings.TrimSpace(queryDiagnosticsDescriptionMarkdown)
  queryDiagnosticsFilesDescription    = strings.TrimSpace(queryDiagnosticsFilesDescriptionMarkdown)
  queryDiagnosticsSeverityDescription = strings.TrimSpace(queryDiagnosticsSeverityDescriptionMarkdown)
)
