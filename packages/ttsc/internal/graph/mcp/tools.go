package mcp

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"os"
	"path/filepath"
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
	"github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// queryFilesEnabled reports whether the query_files tool is advertised and
// callable. On by default; set TTSC_GRAPH_NO_FILES to drop it, so a benchmark can
// measure the query_nodes-only surface (query_files goes unused for relationship
// and call-flow questions, where the fuzzy query_nodes is the workhorse).
func queryFilesEnabled() bool {
	return os.Getenv("TTSC_GRAPH_NO_FILES") == ""
}

// toolsListResult advertises the tool surface: query_exports orients the agent
// around the public surface, query_nodes answers relationship questions,
// query_files outlines files, and query_diagnostics is the focused "what is
// broken" tool.
func toolsListResult() any {
	tools := []any{
		map[string]any{
			"name":         "query_exports",
			"description":  queryExportsDescription,
			"outputSchema": queryExportsOutputSchema(),
			"inputSchema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query": map[string]any{
						"type":        "string",
						"description": queryExportsQueryDescription,
					},
					"limit": map[string]any{
						"type":        "integer",
						"minimum":     0,
						"maximum":     maxExportLimit,
						"default":     defaultExportLimit,
						"description": queryExportsLimitDescription,
					},
					"page": map[string]any{
						"type":        "integer",
						"minimum":     1,
						"default":     1,
						"description": queryExportsPageDescription,
					},
				},
				"required": []any{},
			},
		},
		map[string]any{
			"name":         "query_nodes",
			"description":  queryNodesDescription,
			"outputSchema": queryNodesOutputSchema(),
			"inputSchema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query": map[string]any{
						"type":        "string",
						"description": queryNodesQueryDescription,
					},
					"match": map[string]any{
						"type":        "string",
						"enum":        []any{"auto", "exact", "fuzzy"},
						"default":     "auto",
						"description": "Match strategy. Use exact for a known symbol name, handle, or file path; use fuzzy for discovery.",
					},
				},
				"required": []any{"query"},
			},
		},
		map[string]any{
			"name":         "query_path",
			"description":  queryPathDescription,
			"outputSchema": queryPathOutputSchema(),
			"inputSchema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"from": map[string]any{
						"type":        "string",
						"minLength":   1,
						"description": queryPathFromDescription,
					},
					"to": map[string]any{
						"type":        "string",
						"minLength":   1,
						"description": queryPathToDescription,
					},
					"via": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string", "minLength": 1},
						"description": queryPathViaDescription,
					},
				},
				"required": []any{"from", "to"},
			},
		},
		map[string]any{
			"name":         "expand_nodes",
			"description":  expandNodesDescription,
			"outputSchema": expandNodesOutputSchema(),
			"inputSchema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"ids": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string"},
						"description": expandNodesIDsDescription,
					},
					"mode": map[string]any{
						"type":        "string",
						"enum":        []any{"source", "flow"},
						"default":     "source",
						"description": expandNodesModeDescription,
					},
				},
				"required": []any{"ids"},
			},
		},
	}
	if queryFilesEnabled() {
		tools = append(tools, map[string]any{
			"name":         "query_files",
			"description":  queryFilesDescription,
			"outputSchema": queryFilesOutputSchema(),
			"inputSchema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"locations": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string"},
						"description": queryFilesLocationsDescription,
					},
				},
				"required": []any{"locations"},
			},
		})
	}
	tools = append(tools, map[string]any{
		"name":         "query_diagnostics",
		"description":  queryDiagnosticsDescription,
		"outputSchema": queryDiagnosticsOutputSchema(),
		"inputSchema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"files": map[string]any{
					"type":        "array",
					"items":       map[string]any{"type": "string"},
					"description": queryDiagnosticsFilesDescription,
				},
				"severity": map[string]any{
					"type":        "string",
					"enum":        []any{"error", "warning", "all"},
					"default":     "error",
					"description": queryDiagnosticsSeverityDescription,
				},
			},
			"required": []any{},
		},
	})
	return map[string]any{"tools": tools}
}

func objectOutputSchema(properties map[string]any, required []any) map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"properties":           properties,
		"required":             required,
	}
}

func schemaString(description string) map[string]any {
	return map[string]any{"type": "string", "description": description}
}

func schemaStringEnum(description string, values ...string) map[string]any {
	enum := make([]any, 0, len(values))
	for _, value := range values {
		enum = append(enum, value)
	}
	return map[string]any{"type": "string", "enum": enum, "description": description}
}

func schemaNodeKind(description string) map[string]any {
	return schemaStringEnum(description,
		string(graph.NodeFunction),
		string(graph.NodeClass),
		string(graph.NodeInterface),
		string(graph.NodeTypeAlias),
		string(graph.NodeEnum),
		string(graph.NodeVariable),
		string(graph.NodeMethod),
	)
}

func schemaEdgeKind(description string) map[string]any {
	return schemaStringEnum(description,
		string(graph.EdgeHeritage),
		string(graph.EdgeValueCall),
		string(graph.EdgeValueAccess),
		string(graph.EdgeTypeRef),
	)
}

func schemaRuntimeEdgeKind(description string) map[string]any {
	return schemaStringEnum(description,
		string(graph.EdgeValueCall),
		string(graph.EdgeValueAccess),
	)
}

func schemaSourceState(description string) map[string]any {
	return schemaStringEnum(description,
		string(sourceStateIncluded),
		string(sourceStateUnavailable),
	)
}

func schemaDiagnosticOrigin(description string) map[string]any {
	return schemaStringEnum(description,
		string(diagnosticOriginTSC),
		string(diagnosticOriginPlugin),
	)
}

func schemaDiagnosticSeverity(description string) map[string]any {
	return schemaStringEnum(description,
		string(diagnosticSeverityError),
		string(diagnosticSeverityWarning),
	)
}

func schemaInteger(description string) map[string]any {
	return map[string]any{"type": "integer", "minimum": 0, "description": description}
}

func schemaRef(description string, ref string) map[string]any {
	return map[string]any{"$ref": ref, "description": description}
}

func schemaArrayRef(description string, ref string) map[string]any {
	return map[string]any{"type": "array", "items": map[string]any{"$ref": ref}, "description": description}
}

func schemaArrayString(description string) map[string]any {
	return map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": description}
}

func graphIndexDefs() map[string]any {
	return map[string]any{
		"QueryNodeRef": objectOutputSchema(map[string]any{
			"handle":   schemaString("Stable handle for exact follow-up tools."),
			"kind":     schemaNodeKind("Declaration kind."),
			"name":     schemaString("Symbol name."),
			"file":     schemaString("Project-relative file."),
			"line":     schemaInteger("Declaration line."),
			"external": map[string]any{"type": "boolean", "description": "Whether this symbol is outside the project program."},
		}, []any{"handle", "kind", "name", "file", "line", "external"}),
		"QueryGraphNode": objectOutputSchema(map[string]any{
			"handle":      schemaString("Stable handle for exact follow-up tools."),
			"kind":        schemaNodeKind("Declaration kind."),
			"name":        schemaString("Symbol name."),
			"file":        schemaString("Project-relative file."),
			"line":        schemaInteger("Declaration line."),
			"external":    map[string]any{"type": "boolean", "description": "Whether this symbol is outside the project program."},
			"edges":       schemaRef("Adjacent graph relationships in search mode.", "#/$defs/QueryNodeEdges"),
			"diagnostics": schemaRef("Diagnostic counts attached to this declaration in search mode.", "#/$defs/QueryDiagnosticsSummary"),
			"blastRadius": schemaRef("Reverse dependency count for change-risk orientation in search mode.", "#/$defs/QueryBlastRadius"),
		}, []any{"handle", "kind", "name", "file", "line", "external"}),
		"QueryNodeEdges": objectOutputSchema(map[string]any{
			"outgoing":        schemaArrayRef("Edges from this node to dependencies.", "#/$defs/QueryEdgeRef"),
			"incoming":        schemaArrayRef("Edges from dependents into this node.", "#/$defs/QueryEdgeRef"),
			"omittedOutgoing": schemaInteger("Omitted outgoing edge count after the per-node cap."),
			"omittedIncoming": schemaInteger("Omitted incoming edge count after the per-node cap."),
		}, []any{"outgoing", "incoming", "omittedOutgoing", "omittedIncoming"}),
		"QueryEdgeRef": objectOutputSchema(map[string]any{
			"kind": schemaEdgeKind("Relationship kind."),
			"node": schemaRef("Neighbor node.", "#/$defs/QueryNodeRef"),
			"use":  schemaRef("Source use location for value edges when known.", "#/$defs/QueryLocation"),
		}, []any{"kind", "node"}),
		"QueryLocation": objectOutputSchema(map[string]any{
			"file": schemaString("Project-relative file."),
			"line": schemaInteger("One-based line number."),
		}, []any{"file", "line"}),
		"QueryDiagnosticsSummary": objectOutputSchema(map[string]any{
			"total":    schemaInteger("Total diagnostics attached to this node."),
			"errors":   schemaInteger("Error count."),
			"warnings": schemaInteger("Warning count."),
		}, []any{"total", "errors", "warnings"}),
		"QueryBlastRadius": objectOutputSchema(map[string]any{
			"dependents":           schemaInteger("Transitive dependent count."),
			"dependentsWithErrors": schemaInteger("Transitive dependents that currently have diagnostics."),
		}, []any{"dependents", "dependentsWithErrors"}),
		"QueryFlow": objectOutputSchema(map[string]any{
			"evidence": schemaArrayRef("Selected value-flow edges between returned node handles.", "#/$defs/QueryFlowEdge"),
		}, []any{"evidence"}),
		"QueryFlowEdge": objectOutputSchema(map[string]any{
			"fromHandle": schemaString("Source node handle from the returned nodes."),
			"toHandle":   schemaString("Target node handle from the returned nodes."),
			"kind":       schemaRuntimeEdgeKind("Runtime edge kind."),
			"use":        schemaRef("Source use location when known.", "#/$defs/QueryLocation"),
		}, []any{"fromHandle", "toHandle", "kind"}),
	}
}

func pathIndexDefs() map[string]any {
	return map[string]any{
		"QueryPathNode": objectOutputSchema(map[string]any{
			"handle": schemaString("Stable handle for exact follow-up tools."),
			"kind":   schemaNodeKind("Declaration kind."),
			"name":   schemaString("Symbol name."),
			"file":   schemaString("Project-relative file."),
			"line":   schemaInteger("Declaration line."),
		}, []any{"handle", "kind", "name", "file", "line"}),
		"QueryPathEdge": objectOutputSchema(map[string]any{
			"fromHandle": schemaString("Source node handle from nodes."),
			"toHandle":   schemaString("Target node handle from nodes."),
			"kind":       schemaRuntimeEdgeKind("Runtime edge kind."),
			"use":        schemaRef("Source use location when known.", "#/$defs/QueryLocation"),
		}, []any{"fromHandle", "toHandle", "kind"}),
		"QueryLocation": objectOutputSchema(map[string]any{
			"file": schemaString("Project-relative file."),
			"line": schemaInteger("One-based line number."),
		}, []any{"file", "line"}),
		"QueryPathCallee": objectOutputSchema(map[string]any{
			"fromHandle": schemaString("Path node handle that calls this declaration."),
			"handle":     schemaString("Stable handle for exact follow-up tools."),
			"kind":       schemaNodeKind("Declaration kind."),
			"name":       schemaString("Symbol name."),
			"file":       schemaString("Project-relative file."),
			"line":       schemaInteger("Declaration line."),
		}, []any{"fromHandle", "handle", "kind", "name", "file", "line"}),
	}
}

func queryExportsOutputSchema() map[string]any {
	properties := map[string]any{}
	properties["page"] = schemaRef("Compact page metadata with no derived duplicates.", "#/$defs/QueryExportsPage")
	properties["exports"] = schemaArrayRef("Exported symbols on the current page.", "#/$defs/QueryExportSymbol")
	schema := objectOutputSchema(properties, []any{"page", "exports"})
	schema["$defs"] = map[string]any{
		"QueryExportsPage": objectOutputSchema(map[string]any{
			"totalRecords": schemaInteger("Number of records after filtering."),
			"totalPages":   schemaInteger("Number of available pages after filtering."),
		}, []any{"totalRecords", "totalPages"}),
		"QueryExportSymbol": objectOutputSchema(map[string]any{
			"name":       schemaString("Declared symbol name."),
			"exportedAs": schemaArrayString("Export aliases when they differ from name."),
			"kind":       schemaNodeKind("Declaration kind."),
			"file":       schemaString("Project-relative source file."),
			"line":       schemaInteger("Declaration line in file."),
			"handle":     schemaString("Stable graph handle for exact follow-up tools."),
		}, []any{"name", "kind", "file", "line", "handle"}),
	}
	return schema
}

func queryNodesOutputSchema() map[string]any {
	properties := map[string]any{}
	properties["totalMatches"] = schemaInteger("Number of matched nodes before result shaping.")
	properties["message"] = schemaString("Optional status when no match or partial handling needs explanation.")
	properties["nodes"] = schemaArrayRef("Matched graph nodes as index records, not source bodies.", "#/$defs/QueryGraphNode")
	schema := objectOutputSchema(properties, []any{"totalMatches", "nodes"})
	schema["$defs"] = graphIndexDefs()
	return schema
}

func queryPathOutputSchema() map[string]any {
	properties := map[string]any{}
	properties["message"] = schemaString("Optional status when no path or partial handling needs explanation.")
	properties["nodes"] = schemaArrayRef("Path nodes in order.", "#/$defs/QueryPathNode")
	properties["edges"] = schemaArrayRef("Selected runtime edges between consecutive path nodes.", "#/$defs/QueryPathEdge")
	properties["callees"] = schemaArrayRef("Off-path declarations the path nodes call, as index records for one-batch expansion.", "#/$defs/QueryPathCallee")
	schema := objectOutputSchema(properties, []any{"nodes", "edges"})
	schema["$defs"] = pathIndexDefs()
	return schema
}

func expandNodesOutputSchema() map[string]any {
	properties := map[string]any{}
	properties["missing"] = schemaArrayString("Handles that did not resolve.")
	properties["message"] = schemaString("Optional status message.")
	properties["nodes"] = schemaArrayRef("Expanded declarations.", "#/$defs/ExpandedNode")
	properties["flow"] = schemaRef("Runtime-flow evidence when mode is flow.", "#/$defs/QueryFlow")
	schema := objectOutputSchema(properties, []any{"missing", "nodes"})
	defs := graphIndexDefs()
	defs["ExpandedNode"] = objectOutputSchema(map[string]any{
		"handle":      schemaString("Stable graph handle."),
		"kind":        schemaNodeKind("Declaration kind."),
		"name":        schemaString("Symbol name."),
		"file":        schemaString("Project-relative file."),
		"line":        schemaInteger("Declaration line."),
		"external":    map[string]any{"type": "boolean", "description": "Whether this declaration is external."},
		"sourceState": schemaSourceState("Whether source was included or unavailable."),
		"source":      schemaRef("Declaration source, only from expand_nodes.", "#/$defs/ExpandedSource"),
		"diagnostics": schemaRef("Diagnostic counts attached to this declaration.", "#/$defs/QueryDiagnosticsSummary"),
	}, []any{"handle", "kind", "name", "file", "line", "external", "sourceState", "diagnostics"})
	defs["ExpandedSource"] = objectOutputSchema(map[string]any{
		"startLine":    schemaInteger("First line number of lines."),
		"lines":        schemaArrayString("Source lines."),
		"truncated":    map[string]any{"type": "boolean", "description": "Whether the declaration source was truncated."},
		"omittedLines": schemaInteger("Omitted line count when truncated."),
	}, []any{"startLine", "lines", "truncated", "omittedLines"})
	schema["$defs"] = defs
	return schema
}

func queryFilesOutputSchema() map[string]any {
	properties := map[string]any{}
	properties["locations"] = schemaArrayRef("One record per requested location.", "#/$defs/FileLocation")
	schema := objectOutputSchema(properties, []any{"locations"})
	schema["$defs"] = map[string]any{
		"FileLocation": objectOutputSchema(map[string]any{
			"message": schemaString("Optional no-match or ambiguity message."),
			"files":   schemaArrayRef("Matched files.", "#/$defs/FileIndex"),
		}, []any{"files"}),
		"FileIndex": objectOutputSchema(map[string]any{
			"file":             schemaString("Project-relative file."),
			"declarations":     schemaArrayRef("Declarations in this file.", "#/$defs/FileDeclaration"),
			"reaches":          schemaArrayString("Adjacent files reached by declarations in this file."),
			"reachedBy":        schemaArrayString("Adjacent files that reach declarations in this file."),
			"omittedReaches":   schemaInteger("Omitted outgoing adjacent file count."),
			"omittedReachedBy": schemaInteger("Omitted incoming adjacent file count."),
		}, []any{"file", "declarations", "reaches", "reachedBy", "omittedReaches", "omittedReachedBy"}),
		"FileDeclaration": objectOutputSchema(map[string]any{
			"handle":   schemaString("Stable graph handle."),
			"kind":     schemaNodeKind("Declaration kind."),
			"name":     schemaString("Symbol name."),
			"line":     schemaInteger("Declaration line."),
			"external": map[string]any{"type": "boolean", "description": "Whether this declaration is external."},
		}, []any{"handle", "kind", "name", "line", "external"}),
	}
	return schema
}

func queryDiagnosticsOutputSchema() map[string]any {
	properties := map[string]any{}
	properties["total"] = schemaInteger("Total matching diagnostics.")
	properties["truncated"] = map[string]any{"type": "boolean", "description": "Whether project-wide output was capped."}
	properties["files"] = schemaArrayRef("Diagnostics grouped by file.", "#/$defs/DiagnosticsFile")
	schema := objectOutputSchema(properties, []any{"total", "truncated", "files"})
	schema["$defs"] = map[string]any{
		"DiagnosticsFile": objectOutputSchema(map[string]any{
			"file":        schemaString("Project-relative file, or the unresolved query when no file matched."),
			"message":     schemaString("Optional no-match or ambiguity message."),
			"diagnostics": schemaArrayRef("Matching diagnostics.", "#/$defs/DiagnosticEntry"),
		}, []any{"file", "diagnostics"}),
		"DiagnosticEntry": objectOutputSchema(map[string]any{
			"line":      schemaInteger("One-based line number."),
			"column":    schemaInteger("One-based column number."),
			"code":      schemaInteger("Numeric TypeScript code for compiler diagnostics."),
			"codeLabel": schemaString("Display code such as TS2322."),
			"origin":    schemaDiagnosticOrigin("Diagnostic origin."),
			"severity":  schemaDiagnosticSeverity("Diagnostic severity."),
			"message":   schemaString("Diagnostic message."),
		}, []any{"line", "column", "origin", "severity", "message"}),
	}
	return schema
}

// clip bounds a client-supplied string before it is echoed into an error or
// "no match" message, so a pathological multi-megabyte name or query cannot turn
// a small request into an equally large response on a shared daemon.
func clip(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

// callTool routes a tools/call request to the named tool.
func (s *Server) callTool(params json.RawMessage) (any, *rpcError) {
	var call struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(params, &call); err != nil {
		return nil, &rpcError{Code: codeInvalidParams, Message: "invalid tools/call params"}
	}
	switch call.Name {
	case "query_exports":
		return s.queryExports(call.Arguments)
	case "query_nodes":
		return s.queryNodes(call.Arguments)
	case "query_path":
		return s.queryPath(call.Arguments)
	case "expand_nodes":
		return s.expandNodes(call.Arguments)
	case "query_files":
		if !queryFilesEnabled() {
			return nil, &rpcError{Code: codeInvalidParams, Message: "unknown tool: query_files"}
		}
		return s.queryFiles(call.Arguments)
	case "query_diagnostics":
		return s.queryDiagnostics(call.Arguments)
	default:
		return nil, &rpcError{Code: codeInvalidParams, Message: "unknown tool: " + clip(call.Name, 80)}
	}
}

type pageResult struct {
	TotalRecords int `json:"totalRecords"`
	TotalPages   int `json:"totalPages"`
}

type sourceState string

const (
	sourceStateIncluded    sourceState = "included"
	sourceStateUnavailable sourceState = "unavailable"
)

type diagnosticOrigin string

const (
	diagnosticOriginTSC    diagnosticOrigin = "tsc"
	diagnosticOriginPlugin diagnosticOrigin = "plugin"
)

type diagnosticSeverity string

const (
	diagnosticSeverityError   diagnosticSeverity = "error"
	diagnosticSeverityWarning diagnosticSeverity = "warning"
)

type diagnosticSeverityFilter string

const (
	diagnosticSeverityFilterError   diagnosticSeverityFilter = "error"
	diagnosticSeverityFilterWarning diagnosticSeverityFilter = "warning"
	diagnosticSeverityFilterAll     diagnosticSeverityFilter = "all"
)

type nodeMatchMode string

const (
	nodeMatchModeAuto  nodeMatchMode = "auto"
	nodeMatchModeExact nodeMatchMode = "exact"
	nodeMatchModeFuzzy nodeMatchMode = "fuzzy"
)

type expandMode string

const (
	expandModeSource expandMode = "source"
	expandModeFlow   expandMode = "flow"
)

type exportSymbolResult struct {
	Name       string         `json:"name"`
	ExportedAs []string       `json:"exportedAs,omitempty"`
	Kind       graph.NodeKind `json:"kind"`
	File       string         `json:"file"`
	Line       int            `json:"line"`
	Handle     string         `json:"handle"`
}

type queryExportsResult struct {
	Page    pageResult           `json:"page"`
	Exports []exportSymbolResult `json:"exports"`
}

type nodeRefResult struct {
	Handle   string         `json:"handle"`
	Kind     graph.NodeKind `json:"kind"`
	Name     string         `json:"name"`
	File     string         `json:"file"`
	Line     int            `json:"line"`
	External bool           `json:"external"`
}

type sourceResult struct {
	StartLine    int      `json:"startLine"`
	Lines        []string `json:"lines"`
	Truncated    bool     `json:"truncated"`
	OmittedLines int      `json:"omittedLines"`
}

type edgeResult struct {
	Kind graph.EdgeKind  `json:"kind"`
	Node nodeRefResult   `json:"node"`
	Use  *locationResult `json:"use,omitempty"`
}

type nodeEdgesResult struct {
	Outgoing        []edgeResult `json:"outgoing"`
	Incoming        []edgeResult `json:"incoming"`
	OmittedOutgoing int          `json:"omittedOutgoing"`
	OmittedIncoming int          `json:"omittedIncoming"`
}

type diagnosticsSummaryResult struct {
	Total    int `json:"total"`
	Errors   int `json:"errors"`
	Warnings int `json:"warnings"`
}

type diagnosticResult struct {
	Line      int                `json:"line"`
	Column    int                `json:"column"`
	Code      *int               `json:"code,omitempty"`
	CodeLabel string             `json:"codeLabel,omitempty"`
	Origin    diagnosticOrigin   `json:"origin"`
	Severity  diagnosticSeverity `json:"severity"`
	Message   string             `json:"message"`
}

type blastRadiusResult struct {
	Dependents           int `json:"dependents"`
	DependentsWithErrors int `json:"dependentsWithErrors"`
}

type graphNodeResult struct {
	nodeRefResult
	Edges       *nodeEdgesResult          `json:"edges,omitempty"`
	Diagnostics *diagnosticsSummaryResult `json:"diagnostics,omitempty"`
	BlastRadius *blastRadiusResult        `json:"blastRadius,omitempty"`
}

type flowEdgeResult struct {
	FromHandle string          `json:"fromHandle"`
	ToHandle   string          `json:"toHandle"`
	Kind       graph.EdgeKind  `json:"kind"`
	Use        *locationResult `json:"use,omitempty"`
}

type flowResult struct {
	Evidence []flowEdgeResult `json:"evidence"`
}

type expandedNodeResult struct {
	nodeRefResult
	SourceState sourceState              `json:"sourceState"`
	Source      *sourceResult            `json:"source,omitempty"`
	Diagnostics diagnosticsSummaryResult `json:"diagnostics"`
}

type queryNodesResult struct {
	TotalMatches int               `json:"totalMatches"`
	Message      string            `json:"message,omitempty"`
	Nodes        []graphNodeResult `json:"nodes"`
}

type queryPathResult struct {
	Message string             `json:"message,omitempty"`
	Nodes   []pathNodeResult   `json:"nodes"`
	Edges   []flowEdgeResult   `json:"edges"`
	Callees []pathCalleeResult `json:"callees,omitempty"`
}

type pathNodeResult struct {
	Handle string         `json:"handle"`
	Kind   graph.NodeKind `json:"kind"`
	Name   string         `json:"name"`
	File   string         `json:"file"`
	Line   int            `json:"line"`
}

type pathCalleeResult struct {
	FromHandle string         `json:"fromHandle"`
	Handle     string         `json:"handle"`
	Kind       graph.NodeKind `json:"kind"`
	Name       string         `json:"name"`
	File       string         `json:"file"`
	Line       int            `json:"line"`
}

type expandNodesResult struct {
	Missing []string             `json:"missing"`
	Message string               `json:"message,omitempty"`
	Nodes   []expandedNodeResult `json:"nodes"`
	Flow    *flowResult          `json:"flow,omitempty"`
}

type fileDeclarationResult struct {
	Handle   string         `json:"handle"`
	Kind     graph.NodeKind `json:"kind"`
	Name     string         `json:"name"`
	Line     int            `json:"line"`
	External bool           `json:"external"`
}

type fileResult struct {
	File             string                  `json:"file"`
	Declarations     []fileDeclarationResult `json:"declarations"`
	Reaches          []string                `json:"reaches"`
	ReachedBy        []string                `json:"reachedBy"`
	OmittedReaches   int                     `json:"omittedReaches"`
	OmittedReachedBy int                     `json:"omittedReachedBy"`
}

type fileLocationResult struct {
	Files   []fileResult `json:"files"`
	Message string       `json:"message,omitempty"`
}

type queryFilesResult struct {
	Locations []fileLocationResult `json:"locations"`
}

type diagnosticsFileResult struct {
	File        string             `json:"file"`
	Diagnostics []diagnosticResult `json:"diagnostics"`
	Message     string             `json:"message,omitempty"`
}

type queryDiagnosticsResult struct {
	Total     int                     `json:"total"`
	Truncated bool                    `json:"truncated"`
	Files     []diagnosticsFileResult `json:"files"`
}

type locationResult struct {
	File string `json:"file"`
	Line int    `json:"line"`
}

func structuredToolResult(value any, summary string) any {
	if summary == "" {
		summary = "structured result"
	}
	return map[string]any{
		"structuredContent": value,
		"content":           []any{map[string]any{"type": "text", "text": summary}},
	}
}

// textResult remains only for defensive internal fallbacks; public tool paths
// return typed objects through structuredToolResult.
func (s *Server) exportResult(entries []exportEntry, offset int, limit int) queryExportsResult {
	total := len(entries)
	if offset > total {
		offset = total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	exports := make([]exportSymbolResult, 0, end-offset)
	for i := offset; i < end; i++ {
		entry := entries[i]
		exports = append(exports, exportSymbolResult{
			Name:       entry.name,
			ExportedAs: exportedAliases(entry),
			Kind:       entry.kind,
			File:       entry.file,
			Line:       entry.line,
			Handle:     entry.handle,
		})
	}
	totalPages := 0
	if limit > 0 && total > 0 {
		totalPages = (total + limit - 1) / limit
	}
	return queryExportsResult{
		Page: pageResult{
			TotalRecords: total,
			TotalPages:   totalPages,
		},
		Exports: exports,
	}
}

func exportedAliases(entry exportEntry) []string {
	aliases := make([]string, 0, len(entry.aliasNames))
	for _, name := range entry.aliasNames {
		if name != "" && name != entry.name {
			aliases = append(aliases, name)
		}
	}
	if len(aliases) == 0 {
		return nil
	}
	return aliases
}

func (s *Server) queryNodesResult(matches []*graph.Node) queryNodesResult {
	return queryNodesResult{
		TotalMatches: len(matches),
		Nodes:        s.graphNodeResults(matches, true),
	}
}

func (s *Server) graphNodeResults(nodes []*graph.Node, includeGraphDetails bool) []graphNodeResult {
	out := make([]graphNodeResult, 0, len(nodes))
	for _, node := range nodes {
		out = append(out, s.graphNodeResult(node, includeGraphDetails))
	}
	return out
}

func (s *Server) graphNodeResult(node *graph.Node, includeGraphDetails bool) graphNodeResult {
	result := graphNodeResult{
		nodeRefResult: s.nodeRef(node),
	}
	if includeGraphDetails {
		edges := s.nodeEdges(node)
		diagnostics := diagnosticsSummary(s.nodeDiagnostics(node))
		blastRadius := s.blastRadius(node)
		result.Edges = &edges
		result.Diagnostics = &diagnostics
		result.BlastRadius = &blastRadius
	}
	return result
}

func (s *Server) expandedNodeResults(nodes []*graph.Node, sourceLines int) []expandedNodeResult {
	out := make([]expandedNodeResult, 0, len(nodes))
	for _, node := range nodes {
		result := expandedNodeResult{
			nodeRefResult: s.nodeRef(node),
			SourceState:   sourceStateUnavailable,
			Diagnostics:   diagnosticsSummary(s.nodeDiagnostics(node)),
		}
		if source := s.sourceResult(node, sourceLines); source != nil {
			result.Source = source
			result.SourceState = sourceStateIncluded
		}
		out = append(out, result)
	}
	return out
}

func diagnosticsSummary(diags []fusedDiagnostic) diagnosticsSummaryResult {
	result := diagnosticsSummaryResult{Total: len(diags)}
	for _, diag := range diags {
		if diag.IsError() {
			result.Errors++
		} else {
			result.Warnings++
		}
	}
	return result
}

func (s *Server) nodeRef(node *graph.Node) nodeRefResult {
	if node == nil {
		return nodeRefResult{}
	}
	return nodeRefResult{
		Handle:   nodeHandle(node.ID),
		Kind:     node.Kind,
		Name:     node.Name,
		File:     s.relFile(node.File),
		Line:     s.declLine(node),
		External: node.External,
	}
}

func (s *Server) sourceResult(node *graph.Node, limit int) *sourceResult {
	source, startLine, _ := s.nodeSourceRange(node)
	if source == "" {
		return nil
	}
	lines := strings.Split(source, "\n")
	result := &sourceResult{StartLine: startLine, Lines: lines}
	if limit >= 0 && len(lines) > limit {
		result.Lines = append([]string(nil), lines[:limit]...)
		result.Truncated = true
		result.OmittedLines = len(lines) - limit
	}
	return result
}

func (s *Server) nodeEdges(node *graph.Node) nodeEdgesResult {
	out := nodeEdgesResult{}
	for _, edge := range s.graph.Edges {
		switch {
		case edge.From == node.ID:
			if to := s.graph.Nodes[edge.To]; to != nil {
				if len(out.Outgoing) < maxEdgesPerDirection {
					out.Outgoing = append(out.Outgoing, s.edgeResult(edge, to))
				} else {
					out.OmittedOutgoing++
				}
			}
		case edge.To == node.ID:
			if from := s.graph.Nodes[edge.From]; from != nil {
				if len(out.Incoming) < maxEdgesPerDirection {
					out.Incoming = append(out.Incoming, s.edgeResult(edge, from))
				} else {
					out.OmittedIncoming++
				}
			}
		}
	}
	return out
}

func (s *Server) edgeResult(edge *graph.Edge, neighbor *graph.Node) edgeResult {
	return edgeResult{
		Kind: edge.Kind,
		Node: s.nodeRef(neighbor),
		Use:  s.edgeUseLocation(edge),
	}
}

func (s *Server) edgeUseLocation(edge *graph.Edge) *locationResult {
	if edge == nil {
		return nil
	}
	line := s.edgeUseLine(edge)
	if line == 0 {
		return nil
	}
	from := s.graph.Nodes[edge.From]
	if from == nil {
		return nil
	}
	return &locationResult{File: s.relFile(from.File), Line: line}
}

func (s *Server) diagnosticResults(diags []fusedDiagnostic) []diagnosticResult {
	sortDiagnostics(diags)
	out := make([]diagnosticResult, 0, len(diags))
	for _, diag := range diags {
		out = append(out, s.diagnosticResult(diag))
	}
	return out
}

func (s *Server) diagnosticResult(diag fusedDiagnostic) diagnosticResult {
	origin := diagnosticOriginPlugin
	var code *int
	codeLabel := ""
	if diag.fromTsc {
		origin = diagnosticOriginTSC
		value := int(diag.Code)
		code = &value
		codeLabel = fmt.Sprintf("TS%d", diag.Code)
	}
	severity := diagnosticSeverityWarning
	if diag.IsError() {
		severity = diagnosticSeverityError
	}
	return diagnosticResult{
		Line:      diag.Line,
		Column:    diag.Column,
		Code:      code,
		CodeLabel: codeLabel,
		Origin:    origin,
		Severity:  severity,
		Message:   diag.Message,
	}
}

func (s *Server) blastRadius(node *graph.Node) blastRadiusResult {
	deps := s.dependents(node)
	broken := 0
	for id := range deps {
		if len(s.diagsByNode[id]) > 0 {
			broken++
		}
	}
	return blastRadiusResult{Dependents: len(deps), DependentsWithErrors: broken}
}

func (s *Server) flowResult(nodes []*graph.Node, query string) *flowResult {
	included := make(map[string]bool, len(nodes))
	order := make(map[string]int, len(nodes))
	for i, node := range nodes {
		if node == nil {
			continue
		}
		included[node.ID] = true
		order[node.ID] = i
	}
	type rankedEdge struct {
		edge *graph.Edge
		line int
	}
	ranked := make([]rankedEdge, 0)
	for _, node := range nodes {
		if node == nil {
			continue
		}
		for _, edge := range s.graph.Edges {
			if edge.From != node.ID || (edge.Kind != graph.EdgeValueCall && edge.Kind != graph.EdgeValueAccess) {
				continue
			}
			if s.graph.Nodes[edge.To] == nil {
				continue
			}
			if !included[edge.To] {
				continue
			}
			ranked = append(ranked, rankedEdge{edge: edge, line: s.edgeUseLine(edge)})
		}
	}
	sort.SliceStable(ranked, func(i, j int) bool {
		leftFrom := order[ranked[i].edge.From]
		rightFrom := order[ranked[j].edge.From]
		if leftFrom != rightFrom {
			return leftFrom < rightFrom
		}
		leftTo := order[ranked[i].edge.To]
		rightTo := order[ranked[j].edge.To]
		if leftTo != rightTo {
			return leftTo < rightTo
		}
		if ranked[i].line != ranked[j].line {
			return ranked[i].line < ranked[j].line
		}
		return ranked[i].edge.From+ranked[i].edge.To < ranked[j].edge.From+ranked[j].edge.To
	})
	evidence := make([]flowEdgeResult, 0)
	seenEdges := map[string]bool{}
	for _, item := range ranked {
		edge := item.edge
		key := edge.From + "\x00" + edge.To + "\x00" + string(edge.Kind)
		if seenEdges[key] {
			continue
		}
		seenEdges[key] = true
		from := s.graph.Nodes[edge.From]
		to := s.graph.Nodes[edge.To]
		if from == nil || to == nil {
			continue
		}
		evidence = append(evidence, flowEdgeResult{
			FromHandle: nodeHandle(from.ID),
			ToHandle:   nodeHandle(to.ID),
			Kind:       edge.Kind,
			Use:        s.edgeUseLocation(edge),
		})
		if len(evidence) >= maxFlowEvidenceEdges {
			break
		}
	}
	return &flowResult{Evidence: evidence}
}

func (s *Server) queryFilesResult(locations []string) queryFilesResult {
	out := queryFilesResult{
		Locations: make([]fileLocationResult, 0, len(locations)),
	}
	for _, loc := range locations {
		item := fileLocationResult{}
		files := s.resolveFile(loc)
		if len(files) == 0 {
			item.Message = fmt.Sprintf("No project source file matches %q.", loc)
			out.Locations = append(out.Locations, item)
			continue
		}
		sort.Strings(files)
		item.Files = make([]fileResult, 0, len(files))
		for _, file := range files {
			item.Files = append(item.Files, s.fileResult(file))
		}
		out.Locations = append(out.Locations, item)
	}
	return out
}

func (s *Server) fileResult(file string) fileResult {
	ids := make(map[string]bool)
	nodes := make([]*graph.Node, 0)
	for _, node := range s.graph.Nodes {
		if node.File == file {
			ids[node.ID] = true
			nodes = append(nodes, node)
		}
	}
	sort.Slice(nodes, func(i, j int) bool { return s.declLine(nodes[i]) < s.declLine(nodes[j]) })
	declarations := make([]fileDeclarationResult, 0, len(nodes))
	for _, node := range nodes {
		ref := s.nodeRef(node)
		declarations = append(declarations, fileDeclarationResult{
			Handle:   ref.Handle,
			Kind:     ref.Kind,
			Name:     ref.Name,
			Line:     ref.Line,
			External: ref.External,
		})
	}
	reaches := map[string]bool{}
	reachedBy := map[string]bool{}
	for _, edge := range s.graph.Edges {
		fromIn, toIn := ids[edge.From], ids[edge.To]
		if fromIn && !toIn {
			if to := s.graph.Nodes[edge.To]; to != nil && to.File != "" {
				reaches[s.relFile(to.File)] = true
			}
		}
		if toIn && !fromIn {
			if from := s.graph.Nodes[edge.From]; from != nil && from.File != "" {
				reachedBy[s.relFile(from.File)] = true
			}
		}
	}
	reachList, omittedReaches := limitedSortedStrings(reaches, maxAdjacentFiles)
	reachedByList, omittedReachedBy := limitedSortedStrings(reachedBy, maxAdjacentFiles)
	return fileResult{
		File:             s.relFile(file),
		Declarations:     declarations,
		Reaches:          reachList,
		ReachedBy:        reachedByList,
		OmittedReaches:   omittedReaches,
		OmittedReachedBy: omittedReachedBy,
	}
}

func limitedSortedStrings(set map[string]bool, limit int) ([]string, int) {
	values := make([]string, 0, len(set))
	for value := range set {
		values = append(values, value)
	}
	sort.Strings(values)
	if len(values) <= limit {
		return values, 0
	}
	return values[:limit], len(values) - limit
}

func (s *Server) queryDiagnosticsFilesResult(locations []string, severity diagnosticSeverityFilter) queryDiagnosticsResult {
	result := queryDiagnosticsResult{
		Files: make([]diagnosticsFileResult, 0, len(locations)),
	}
	for _, loc := range locations {
		fileResult := s.diagnosticsForLocation(loc, severity)
		result.Total += len(fileResult.Diagnostics)
		result.Files = append(result.Files, fileResult)
	}
	return result
}

func (s *Server) diagnosticsForLocation(loc string, severity diagnosticSeverityFilter) diagnosticsFileResult {
	matches := s.resolveFile(loc)
	switch len(matches) {
	case 0:
		return diagnosticsFileResult{File: loc, Diagnostics: []diagnosticResult{}, Message: fmt.Sprintf("No project source file matches %q.", loc)}
	case 1:
	default:
		candidates := make([]string, 0, len(matches))
		for _, match := range matches {
			candidates = append(candidates, s.relFile(match))
		}
		sort.Strings(candidates)
		return diagnosticsFileResult{File: loc, Diagnostics: []diagnosticResult{}, Message: fmt.Sprintf("%q matches %d files: %s", loc, len(matches), strings.Join(candidates, ", "))}
	}
	path := matches[0]
	found := make([]fusedDiagnostic, 0)
	for _, diag := range s.diags {
		if diag.File == path && severityMatches(diag, severity) {
			found = append(found, diag)
		}
	}
	return diagnosticsFileResult{
		File:        s.relFile(path),
		Diagnostics: s.diagnosticResults(found),
	}
}

func (s *Server) projectDiagnosticsResult(severity diagnosticSeverityFilter) queryDiagnosticsResult {
	byFile := make(map[string][]fusedDiagnostic)
	total := 0
	for _, diag := range s.diags {
		if !severityMatches(diag, severity) {
			continue
		}
		byFile[diag.File] = append(byFile[diag.File], diag)
		total++
	}
	files := make([]string, 0, len(byFile))
	for file := range byFile {
		files = append(files, file)
	}
	sort.Strings(files)
	result := queryDiagnosticsResult{
		Total: total,
		Files: make([]diagnosticsFileResult, 0, len(files)),
	}
	shown := 0
	for _, file := range files {
		if shown >= maxProjectDiagnostics {
			result.Truncated = true
			break
		}
		found := byFile[file]
		sortDiagnostics(found)
		remaining := maxProjectDiagnostics - shown
		if len(found) > remaining {
			found = found[:remaining]
			result.Truncated = true
		}
		diagnostics := s.diagnosticResults(found)
		shown += len(diagnostics)
		result.Files = append(result.Files, diagnosticsFileResult{
			File:        s.relFile(file),
			Diagnostics: diagnostics,
		})
	}
	return result
}

func diagnosticsShown(files []diagnosticsFileResult) int {
	total := 0
	for _, file := range files {
		total += len(file.Diagnostics)
	}
	return total
}

// maxEdgesPerDirection caps the incoming/outgoing edges listed per node so a
// central symbol does not dump hundreds of relationships into the response.
const maxEdgesPerDirection = 12

const (
	defaultExportLimit = 100
	maxExportLimit     = 10000
)

type exportEntry struct {
	name       string
	aliasNames []string
	kind       graph.NodeKind
	file       string
	line       int
	handle     string
}

type exportInfo struct {
	names []string
}

// queryExports is the project-orientation tool: it lists compiler-known exported
// symbols with enough coordinates for the agent to choose exact graph queries.
// It deliberately omits source bodies and git-ignored generated files.
func (s *Server) queryExports(args json.RawMessage) (any, *rpcError) {
	var in struct {
		Query string `json:"query"`
		Limit *int   `json:"limit"`
		Page  int    `json:"page"`
	}
	if len(args) != 0 {
		if err := json.Unmarshal(args, &in); err != nil {
			return nil, &rpcError{Code: codeInvalidParams, Message: "query_exports: invalid arguments"}
		}
	}
	limit := defaultExportLimit
	if in.Limit != nil {
		limit = *in.Limit
	}
	if limit < 0 || limit > maxExportLimit {
		return nil, &rpcError{Code: codeInvalidParams, Message: fmt.Sprintf("query_exports limit must be between 0 and %d", maxExportLimit)}
	}
	if in.Page < 0 {
		return nil, &rpcError{Code: codeInvalidParams, Message: "query_exports page must be >= 1"}
	}
	page := in.Page
	if page == 0 {
		page = 1
	}
	offset := (page - 1) * max(1, limit)
	if err := s.ensureLoaded(); err != nil {
		return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
	}
	s.refreshIfStale()
	entries := s.exportEntries(in.Query)
	result := s.exportResult(entries, offset, limit)
	return structuredToolResult(result, fmt.Sprintf("query_exports returned %d exports", len(result.Exports))), nil
}

// queryNodes answers a relationship question: one broad fuzzy query returns the
// matched declarations with their edges, diagnostics counts, and blast radius.
// Source bodies stay behind expand_nodes handles.
func (s *Server) queryNodes(args json.RawMessage) (any, *rpcError) {
	var in struct {
		Query string        `json:"query"`
		Match nodeMatchMode `json:"match"`
	}
	if err := json.Unmarshal(args, &in); err != nil || strings.TrimSpace(in.Query) == "" {
		return nil, &rpcError{Code: codeInvalidParams, Message: "query_nodes requires a non-empty 'query'"}
	}
	match := nodeMatchMode(strings.TrimSpace(string(in.Match)))
	if match == "" {
		match = nodeMatchModeAuto
	}
	if match != nodeMatchModeAuto && match != nodeMatchModeExact && match != nodeMatchModeFuzzy {
		return nil, &rpcError{Code: codeInvalidParams, Message: "query_nodes match must be auto, exact, or fuzzy"}
	}
	if err := s.ensureLoaded(); err != nil {
		return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
	}
	s.refreshIfStale()
	s.refreshDiagnostics()
	matches := s.matchNodesWithStrategy(in.Query, match)
	if len(matches) == 0 {
		result := queryNodesResult{
			TotalMatches: 0,
			Message:      fmt.Sprintf("No graph nodes match %q.", clip(in.Query, 200)),
			Nodes:        []graphNodeResult{},
		}
		return structuredToolResult(result, result.Message), nil
	}
	result := s.queryNodesResult(matches)
	return structuredToolResult(result, fmt.Sprintf("query_nodes returned %d nodes", len(result.Nodes))), nil
}

// queryPath answers an exact A-to-B runtime-flow question. It resolves the
// caller-provided anchors and stitches each ordered segment through the resident
// in-memory graph, returning only path coordinates and selected edge evidence.
func (s *Server) queryPath(args json.RawMessage) (any, *rpcError) {
	var in struct {
		From string   `json:"from"`
		To   string   `json:"to"`
		Via  []string `json:"via"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return nil, &rpcError{Code: codeInvalidParams, Message: "query_path: invalid arguments"}
	}
	from := cleanPathAnchor(in.From)
	to := cleanPathAnchor(in.To)
	if from == "" || to == "" {
		return nil, &rpcError{Code: codeInvalidParams, Message: "query_path requires non-empty 'from' and 'to'"}
	}
	anchors := []string{from}
	for _, item := range in.Via {
		if anchor := cleanPathAnchor(item); anchor != "" {
			anchors = append(anchors, anchor)
		}
	}
	anchors = append(anchors, to)
	if err := s.ensureLoaded(); err != nil {
		return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
	}
	s.refreshIfStale()
	groups := make([][]*graph.Node, 0, len(anchors))
	missing := make([]string, 0)
	for _, anchor := range anchors {
		candidates := s.pathAnchorCandidates(anchor)
		if len(candidates) == 0 {
			missing = append(missing, anchor)
		}
		groups = append(groups, candidates)
	}
	if len(missing) > 0 {
		result := queryPathResult{
			Message: fmt.Sprintf("%d path anchor(s) did not resolve to graph nodes.", len(missing)),
			Nodes:   []pathNodeResult{},
			Edges:   []flowEdgeResult{},
		}
		return structuredToolResult(result, result.Message), nil
	}
	path, ok := s.pathThroughAnchors(groups, strings.Join(anchors, " "))
	if !ok {
		result := queryPathResult{
			Message: "No runtime value-flow path connects the requested anchors in order.",
			Nodes:   []pathNodeResult{},
			Edges:   []flowEdgeResult{},
		}
		return structuredToolResult(result, result.Message), nil
	}
	result := queryPathResult{
		Nodes:   s.pathNodeRefs(path),
		Edges:   s.pathEdgeResults(path),
		Callees: s.pathCalleeResults(path),
	}
	return structuredToolResult(result, fmt.Sprintf("query_path returned %d nodes", len(result.Nodes))), nil
}

func cleanPathAnchor(value string) string {
	value = strings.TrimSpace(value)
	value = strings.Trim(value, "`")
	value = strings.TrimSuffix(value, "()")
	return strings.TrimSpace(value)
}

const maxPathAnchorCandidates = 24

func (s *Server) pathAnchorCandidates(anchor string) []*graph.Node {
	raw := cleanPathAnchor(anchor)
	ref := normalizeNodeRef(raw)
	lower := strings.ToLower(raw)
	type candidate struct {
		node  *graph.Node
		score int
	}
	candidates := make([]candidate, 0)
	seen := map[string]bool{}
	for _, node := range s.graph.Nodes {
		if node == nil || seen[node.ID] || node.External || s.ignored[node.File] || !flowNodeEligible(node) {
			continue
		}
		name := strings.ToLower(node.Name)
		member := strings.ToLower(memberName(node.Name))
		score := 0
		switch {
		case node.ID == ref:
			score = 1000
		case nodeHandle(node.ID) == ref:
			score = 1000
		case node.Name == raw:
			score = 950
		case name == lower:
			score = 900
		case s.relFile(node.File) == raw || node.File == raw:
			score = 700
		case member == lower && flowMemberAnchorEligible(node):
			score = 500
		}
		if score == 0 {
			continue
		}
		seen[node.ID] = true
		candidates = append(candidates, candidate{node: node, score: score})
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].score != candidates[j].score {
			return candidates[i].score > candidates[j].score
		}
		left := candidates[i].node
		right := candidates[j].node
		if left.File != right.File {
			return left.File < right.File
		}
		if s.declLine(left) != s.declLine(right) {
			return s.declLine(left) < s.declLine(right)
		}
		return left.Name < right.Name
	})
	if len(candidates) > maxPathAnchorCandidates {
		candidates = candidates[:maxPathAnchorCandidates]
	}
	out := make([]*graph.Node, 0, len(candidates))
	for _, candidate := range candidates {
		out = append(out, candidate.node)
	}
	return out
}

type queryPathState struct {
	path []string
	cost int
}

func (s *Server) pathThroughAnchors(groups [][]*graph.Node, query string) ([]*graph.Node, bool) {
	if len(groups) == 0 || len(groups[0]) == 0 {
		return nil, false
	}
	tokens := queryTokens(query)
	words := queryWords(query)
	states := map[string]queryPathState{}
	for i, node := range groups[0] {
		if node == nil {
			continue
		}
		states[node.ID] = queryPathState{path: []string{node.ID}, cost: i}
	}
	for groupIndex := 1; groupIndex < len(groups); groupIndex++ {
		nextStates := map[string]queryPathState{}
		for fromID, state := range states {
			for candidateIndex, target := range groups[groupIndex] {
				if target == nil {
					continue
				}
				segment := s.shortestFlowPath(fromID, target.ID, tokens, words)
				if len(segment) == 0 {
					continue
				}
				combined := append(append([]string(nil), state.path...), segment[1:]...)
				cost := state.cost + len(segment)*100 + candidateIndex
				if prev, ok := nextStates[target.ID]; !ok || cost < prev.cost || (cost == prev.cost && pathKey(combined) < pathKey(prev.path)) {
					nextStates[target.ID] = queryPathState{path: combined, cost: cost}
				}
			}
		}
		if len(nextStates) == 0 {
			return nil, false
		}
		states = nextStates
	}
	var best queryPathState
	ok := false
	for _, state := range states {
		if !ok || state.cost < best.cost || (state.cost == best.cost && pathKey(state.path) < pathKey(best.path)) {
			best = state
			ok = true
		}
	}
	if !ok {
		return nil, false
	}
	out := make([]*graph.Node, 0, len(best.path))
	for _, id := range best.path {
		node := s.graph.Nodes[id]
		if node != nil {
			out = append(out, node)
		}
	}
	return out, len(out) > 0
}

func pathKey(path []string) string {
	return strings.Join(path, "\x00")
}

func (s *Server) pathNodeRefs(nodes []*graph.Node) []pathNodeResult {
	out := make([]pathNodeResult, 0, len(nodes))
	for _, node := range nodes {
		out = append(out, pathNodeResult{
			Handle: nodeHandle(node.ID),
			Kind:   node.Kind,
			Name:   node.Name,
			File:   s.relFile(node.File),
			Line:   s.declLine(node),
		})
	}
	return out
}

func (s *Server) pathEdgeResults(nodes []*graph.Node) []flowEdgeResult {
	if len(nodes) < 2 {
		return nil
	}
	out := make([]flowEdgeResult, 0, len(nodes)-1)
	for i := 1; i < len(nodes); i++ {
		from := nodes[i-1]
		to := nodes[i]
		edge := s.runtimeEdgeBetween(from.ID, to.ID)
		if edge == nil {
			continue
		}
		out = append(out, flowEdgeResult{
			FromHandle: nodeHandle(from.ID),
			ToHandle:   nodeHandle(to.ID),
			Kind:       edge.Kind,
			Use:        s.edgeUseLocation(edge),
		})
	}
	return out
}

// pathCalleeResults lists the off-path methods and functions that the path nodes
// call, as index records tagged with the calling path-node handle. They are the
// helpers each step reaches into (for example the alias or join-type helpers a
// builder method calls), so the caller can expand the whole neighborhood in one
// batch instead of discovering their handles with a separate query. Only value
// calls are followed, not property reads; targets already on the path, external,
// or git-ignored are skipped, and each callee is listed once.
func (s *Server) pathCalleeResults(nodes []*graph.Node) []pathCalleeResult {
	onPath := make(map[string]bool, len(nodes))
	for _, node := range nodes {
		onPath[node.ID] = true
	}
	out := make([]pathCalleeResult, 0)
	seen := map[string]bool{}
	for _, from := range nodes {
		targets := make([]*graph.Node, 0)
		for _, edge := range s.graph.Edges {
			if edge.From != from.ID || edge.Kind != graph.EdgeValueCall {
				continue
			}
			if onPath[edge.To] || seen[edge.To] {
				continue
			}
			to := s.graph.Nodes[edge.To]
			if to == nil || to.External || s.ignored[to.File] || !flowNodeEligible(to) {
				continue
			}
			seen[edge.To] = true
			targets = append(targets, to)
		}
		sort.SliceStable(targets, func(i, j int) bool {
			if targets[i].File != targets[j].File {
				return targets[i].File < targets[j].File
			}
			if s.declLine(targets[i]) != s.declLine(targets[j]) {
				return s.declLine(targets[i]) < s.declLine(targets[j])
			}
			return targets[i].Name < targets[j].Name
		})
		for _, to := range targets {
			out = append(out, pathCalleeResult{
				FromHandle: nodeHandle(from.ID),
				Handle:     nodeHandle(to.ID),
				Kind:       to.Kind,
				Name:       to.Name,
				File:       s.relFile(to.File),
				Line:       s.declLine(to),
			})
		}
	}
	return out
}

func (s *Server) runtimeEdgeBetween(fromID string, toID string) *graph.Edge {
	for _, edge := range s.graph.Edges {
		if edge.From == fromID && edge.To == toID && (edge.Kind == graph.EdgeValueCall || edge.Kind == graph.EdgeValueAccess) {
			return edge
		}
	}
	return nil
}

func (s *Server) shouldAutoFlow(query string, matches []*graph.Node) bool {
	if os.Getenv("TTSC_GRAPH_CALLPATH") == "0" || len(matches) == 0 {
		return false
	}
	if isSingleSymbolQuery(query) {
		return false
	}
	if hasDottedIdentifierWithContext(query) {
		return true
	}
	return s.matchesShareCallPath(matches)
}

func isSingleSymbolQuery(query string) bool {
	q := strings.TrimSpace(query)
	q = strings.Trim(q, "`")
	q = strings.TrimSuffix(q, "()")
	if q == "" {
		return false
	}
	for _, r := range q {
		if (r >= 'a' && r <= 'z') ||
			(r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') ||
			r == '_' || r == '$' || r == '.' {
			continue
		}
		return false
	}
	return true
}

func hasDottedIdentifierWithContext(query string) bool {
	if !strings.ContainsAny(query, " \t\r\n") {
		return false
	}
	fields := strings.FieldsFunc(query, func(r rune) bool {
		return !((r >= 'a' && r <= 'z') ||
			(r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') ||
			r == '_' || r == '$' || r == '.')
	})
	for _, field := range fields {
		if dot := strings.IndexByte(field, '.'); dot > 0 && dot < len(field)-1 {
			return true
		}
	}
	return false
}

func (s *Server) matchesShareCallPath(matches []*graph.Node) bool {
	target := make(map[string]bool, len(matches))
	for _, node := range matches {
		if node != nil {
			target[node.ID] = true
		}
	}
	for _, node := range matches {
		if node == nil {
			continue
		}
		seen := map[string]bool{node.ID: true}
		queue := []string{node.ID}
		for depth := 0; depth < 4 && len(queue) > 0; depth++ {
			nextQueue := make([]string, 0)
			for _, cur := range queue {
				next := append([]string(nil), s.forwardCallAdj[cur]...)
				next = append(next, s.implementorsAdj[cur]...)
				for _, to := range next {
					if seen[to] {
						continue
					}
					if target[to] {
						return true
					}
					seen[to] = true
					nextQueue = append(nextQueue, to)
				}
			}
			queue = nextQueue
		}
	}
	return false
}

func (s *Server) exportEntries(query string) []exportEntry {
	exported := s.exportedNodeSources()
	tokens := queryTokens(query)
	whole := strings.ToLower(strings.TrimSpace(query))
	out := make([]exportEntry, 0, len(exported))
	for id, source := range exported {
		node := s.graph.Nodes[id]
		if node == nil || node.External || s.ignored[node.File] {
			continue
		}
		if whole != "" && !exportEntryMatches(node, source, tokens, whole, s.relFile(node.File)) {
			continue
		}
		out = append(out, exportEntry{
			name:       node.Name,
			aliasNames: append([]string(nil), source.names...),
			kind:       node.Kind,
			file:       s.relFile(node.File),
			line:       s.declLine(node),
			handle:     nodeHandle(node.ID),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].file != out[j].file {
			return out[i].file < out[j].file
		}
		if out[i].line != out[j].line {
			return out[i].line < out[j].line
		}
		if out[i].name != out[j].name {
			return out[i].name < out[j].name
		}
		return out[i].kind < out[j].kind
	})
	return out
}

func exportEntryMatches(node *graph.Node, info exportInfo, tokens []string, whole string, file string) bool {
	name := strings.ToLower(node.Name)
	path := strings.ToLower(file)
	if strings.Contains(name, whole) || strings.Contains(path, whole) {
		return true
	}
	for _, exportName := range info.names {
		if strings.Contains(strings.ToLower(exportName), whole) {
			return true
		}
	}
	for _, token := range tokens {
		if strings.Contains(name, token) || strings.Contains(path, token) {
			return true
		}
		for _, exportName := range info.names {
			if strings.Contains(strings.ToLower(exportName), token) {
				return true
			}
		}
	}
	return false
}

func (s *Server) exportedNodeSources() map[string]exportInfo {
	out := make(map[string]exportInfo)
	if s.prog == nil || s.prog.Checker == nil {
		return out
	}
	byDecl := s.nodesByDeclarationSpan()
	s.collectDirectExports(out, byDecl)
	for _, file := range s.prog.SourceFiles() {
		if file == nil || file.Symbol == nil {
			continue
		}
		for _, symbol := range shimchecker.Checker_getExportsOfModule(s.prog.Checker, file.Symbol) {
			target := exportedTargetSymbol(s.prog.Checker, symbol)
			if target == nil {
				continue
			}
			for _, declaration := range target.Declarations {
				if node := byDecl[declarationSpanKey(declaration)]; node != nil {
					appendExportInfo(out, node.ID, symbol.Name)
				}
			}
		}
	}
	s.collectExportedMembers(out, byDecl)
	return out
}

func (s *Server) collectDirectExports(out map[string]exportInfo, byDecl map[declarationKey]*graph.Node) {
	if s.prog == nil {
		return
	}
	for _, file := range s.prog.SourceFiles() {
		if file == nil || file.Statements == nil {
			continue
		}
		for _, statement := range file.Statements.Nodes {
			if statement == nil || shimast.GetCombinedModifierFlags(statement)&shimast.ModifierFlagsExport == 0 {
				continue
			}
			switch statement.Kind {
			case shimast.KindVariableStatement:
				variables := statement.AsVariableStatement()
				if variables == nil || variables.DeclarationList == nil {
					continue
				}
				list := variables.DeclarationList.AsVariableDeclarationList()
				if list == nil || list.Declarations == nil {
					continue
				}
				for _, binding := range list.Declarations.Nodes {
					if node := byDecl[declarationSpanKey(binding)]; node != nil {
						appendExportInfo(out, node.ID, node.Name)
					}
				}
			default:
				if node := byDecl[declarationSpanKey(statement)]; node != nil {
					appendExportInfo(out, node.ID, node.Name)
				}
			}
		}
	}
}

func appendExportInfo(out map[string]exportInfo, id string, name string) {
	if id == "" {
		return
	}
	info := out[id]
	if name != "" && !containsString(info.names, name) {
		info.names = append(info.names, name)
		sort.Strings(info.names)
	}
	out[id] = info
}

func containsString(values []string, value string) bool {
	for _, existing := range values {
		if existing == value {
			return true
		}
	}
	return false
}

func (s *Server) collectExportedMembers(out map[string]exportInfo, byDecl map[declarationKey]*graph.Node) {
	exportedOwners := map[string]exportInfo{}
	for id, info := range out {
		node := s.graph.Nodes[id]
		if node == nil || (node.Kind != graph.NodeClass && node.Kind != graph.NodeInterface) {
			continue
		}
		exportedOwners[node.ID] = info
	}
	if len(exportedOwners) == 0 || s.prog == nil {
		return
	}
	for _, file := range s.prog.SourceFiles() {
		if file == nil || file.Statements == nil {
			continue
		}
		s.collectExportedMembersIn(out, byDecl, exportedOwners, file.Statements.Nodes)
	}
}

func (s *Server) collectExportedMembersIn(out map[string]exportInfo, byDecl map[declarationKey]*graph.Node, exportedOwners map[string]exportInfo, statements []*shimast.Node) {
	for _, statement := range statements {
		switch statement.Kind {
		case shimast.KindClassDeclaration, shimast.KindInterfaceDeclaration:
			owner := byDecl[declarationSpanKey(statement)]
			_, ownerExported := exportedOwners[nodeID(owner)]
			if ownerExported {
				for _, member := range memberNodes(statement) {
					if !exportedMemberVisible(member) {
						continue
					}
					if node := byDecl[declarationSpanKey(member)]; node != nil {
						appendExportInfo(out, node.ID, node.Name)
					}
				}
			}
		case shimast.KindModuleDeclaration:
			s.collectExportedMembersIn(out, byDecl, exportedOwners, moduleMemberStatements(statement))
		}
	}
}

func nodeID(node *graph.Node) string {
	if node == nil {
		return ""
	}
	return node.ID
}

func exportedMemberVisible(member *shimast.Node) bool {
	if member == nil {
		return false
	}
	switch member.Kind {
	case shimast.KindMethodDeclaration, shimast.KindMethodSignature,
		shimast.KindConstructor, shimast.KindGetAccessor, shimast.KindSetAccessor,
		shimast.KindPropertyDeclaration, shimast.KindPropertySignature:
	default:
		return false
	}
	flags := shimast.GetCombinedModifierFlags(member)
	return flags&(shimast.ModifierFlagsPrivate|shimast.ModifierFlagsProtected) == 0
}

func memberNodes(statement *shimast.Node) []*shimast.Node {
	switch statement.Kind {
	case shimast.KindClassDeclaration:
		if decl := statement.AsClassDeclaration(); decl != nil && decl.Members != nil {
			return decl.Members.Nodes
		}
	case shimast.KindInterfaceDeclaration:
		if decl := statement.AsInterfaceDeclaration(); decl != nil && decl.Members != nil {
			return decl.Members.Nodes
		}
	}
	return nil
}

func moduleMemberStatements(statement *shimast.Node) []*shimast.Node {
	body := statement.Body()
	for body != nil && body.Kind == shimast.KindModuleDeclaration {
		body = body.Body()
	}
	if body == nil || body.Kind != shimast.KindModuleBlock {
		return nil
	}
	block := body.AsModuleBlock()
	if block == nil || block.Statements == nil {
		return nil
	}
	return block.Statements.Nodes
}

func exportedTargetSymbol(checker *shimchecker.Checker, symbol *shimast.Symbol) *shimast.Symbol {
	if symbol == nil {
		return nil
	}
	if symbol.Flags&shimast.SymbolFlagsAlias != 0 {
		if aliased := shimchecker.Checker_getAliasedSymbol(checker, symbol); aliased != nil {
			return aliased
		}
	}
	return symbol
}

type declarationKey struct {
	file string
	pos  int
	end  int
}

func (s *Server) nodesByDeclarationSpan() map[declarationKey]*graph.Node {
	out := make(map[declarationKey]*graph.Node, len(s.graph.Nodes))
	for _, node := range s.graph.Nodes {
		out[declarationKey{file: node.File, pos: node.Pos, end: node.End}] = node
	}
	return out
}

func declarationSpanKey(declaration *shimast.Node) declarationKey {
	if declaration == nil {
		return declarationKey{}
	}
	file := ""
	if source := shimast.GetSourceFileOfNode(declaration); source != nil {
		file = source.FileName()
	}
	return declarationKey{file: file, pos: declaration.Pos(), end: declaration.End()}
}

const maxExpandNodeRefs = 8

// expandNodes reopens exact graph nodes by the short handles printed by
// query_nodes/query_files. It is the deterministic follow-up path for exact
// source, with no fuzzy re-ranking and no shell read for TypeScript declarations
// already known to the graph.
func (s *Server) expandNodes(args json.RawMessage) (any, *rpcError) {
	var in struct {
		IDs  []string   `json:"ids"`
		Mode expandMode `json:"mode"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return nil, &rpcError{Code: codeInvalidParams, Message: "expand_nodes: invalid arguments"}
	}
	refs := make([]string, 0, len(in.IDs))
	for _, id := range in.IDs {
		if strings.TrimSpace(id) != "" {
			refs = append(refs, id)
		}
	}
	if len(refs) == 0 {
		return nil, &rpcError{Code: codeInvalidParams, Message: "expand_nodes requires a non-empty 'ids' array"}
	}
	if len(refs) > maxExpandNodeRefs {
		return nil, &rpcError{Code: codeInvalidParams, Message: fmt.Sprintf("expand_nodes accepts at most %d ids", maxExpandNodeRefs)}
	}
	mode := expandMode(strings.TrimSpace(string(in.Mode)))
	if mode == "" {
		mode = expandModeSource
	}
	if mode != expandModeSource && mode != expandModeFlow {
		return nil, &rpcError{Code: codeInvalidParams, Message: "expand_nodes mode must be source or flow"}
	}
	if err := s.ensureLoaded(); err != nil {
		return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
	}
	s.refreshIfStale()
	s.refreshDiagnostics()

	nodes := make([]*graph.Node, 0, len(refs))
	missing := make([]string, 0)
	seen := map[string]bool{}
	for _, ref := range refs {
		node := s.nodeByRef(ref)
		if node == nil {
			missing = append(missing, ref)
			continue
		}
		if seen[node.ID] {
			continue
		}
		seen[node.ID] = true
		nodes = append(nodes, node)
	}
	if len(nodes) == 0 {
		result := expandNodesResult{
			Missing: missing,
			Message: fmt.Sprintf("No graph nodes match handle(s): %s.", strings.Join(missing, ", ")),
			Nodes:   []expandedNodeResult{},
		}
		return structuredToolResult(result, result.Message), nil
	}
	if mode == expandModeFlow {
		names := make([]string, 0, len(nodes))
		for _, node := range nodes {
			names = append(names, node.Name)
		}
		flowQuery := strings.Join(names, " ")
		nodes = s.withCallPath(nodes, maxPathNodes, flowQuery)
		nodes = s.filterFlowNodes(nodes, flowQuery)
		result := expandNodesResult{
			Missing: missing,
			Nodes:   s.expandedNodeResults(nodes, expandedSourceLines(len(nodes))),
			Flow:    s.flowResult(nodes, flowQuery),
		}
		return structuredToolResult(result, fmt.Sprintf("expand_nodes returned %d flow nodes", len(result.Nodes))), nil
	}
	result := expandNodesResult{
		Missing: missing,
		Nodes:   s.expandedNodeResults(nodes, expandedSourceLines(len(nodes))),
	}
	return structuredToolResult(result, fmt.Sprintf("expand_nodes returned %d nodes", len(result.Nodes))), nil
}

// queryFiles renders a roster for one or more files: each file's adjacent files
// and the declarations inside it, one result block per requested location in input
// order. It is the cheap "what is in this file and what is near it" index; the
// bodies and per-symbol relationships are a query_nodes job.
func (s *Server) queryFiles(args json.RawMessage) (any, *rpcError) {
	var in struct {
		Locations []string `json:"locations"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return nil, &rpcError{Code: codeInvalidParams, Message: "query_files: invalid arguments"}
	}
	locations := make([]string, 0, len(in.Locations))
	for _, loc := range in.Locations {
		if strings.TrimSpace(loc) != "" {
			locations = append(locations, loc)
		}
	}
	if len(locations) == 0 {
		return nil, &rpcError{Code: codeInvalidParams, Message: "query_files requires a non-empty 'locations'"}
	}
	if err := s.ensureLoaded(); err != nil {
		return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
	}
	s.refreshIfStale()
	s.refreshDiagnostics()
	result := s.queryFilesResult(locations)
	return structuredToolResult(result, fmt.Sprintf("query_files returned %d location records", len(result.Locations))), nil
}

func (s *Server) filterFlowNodes(nodes []*graph.Node, query string) []*graph.Node {
	tokens := queryTokens(query)
	words := queryWords(query)
	out := make([]*graph.Node, 0, len(nodes))
	for i, node := range nodes {
		if node == nil || !flowNodeEligible(node) {
			continue
		}
		if i == 0 || s.pathTargetScore(node.ID, tokens, words) > 0 {
			out = append(out, node)
			if len(out) >= maxFlowNodes {
				break
			}
		}
	}
	if len(out) == 0 {
		return nodes
	}
	return out
}

const maxFlowNodes = 16

func flowNodeEligible(node *graph.Node) bool {
	switch strings.ToLower(string(node.Kind)) {
	case "class", "interface", "type":
		return false
	default:
		return true
	}
}

// maxPathNodes caps how many downstream call-path nodes a flow query pulls in
// beyond its direct matches, so one query returns the chain without a hub
// exploding the response. The render budget collapses the tail past it.
const maxPathNodes = 16

const maxPathBranch = 8

// withCallPath appends to the matched seeds the declarations downstream of them
// along value-call edges (the runtime call flow), breadth-first and bounded, so a
// single flow query returns the path instead of forcing a follow-up query per hop.
// Seeds, external nodes, and anything past the depth or node caps are skipped, and
// the breadth-first order keeps the immediate next hops first so they render with
// their bodies before the budget collapses the rest.
func (s *Server) withCallPath(seeds []*graph.Node, max int, query string) []*graph.Node {
	const maxDepth = 5
	tokens := queryTokens(query)
	words := queryWords(query)
	if anchored := s.withAnchoredCallPath(seeds, max, query, tokens, words); len(anchored) > 0 {
		return anchored
	}
	inSet := make(map[string]bool, len(seeds))
	depth := make(map[string]int, len(seeds))
	priority := make(map[string]int, len(seeds))
	queue := make([]string, 0, len(seeds))
	for _, n := range seeds {
		inSet[n.ID] = true
		depth[n.ID] = 0
		queue = append(queue, n.ID)
	}
	out := append([]*graph.Node(nil), seeds...)
	added := 0
	for len(queue) > 0 && added < max {
		cur := queue[0]
		queue = queue[1:]
		if depth[cur] > 0 {
			if node := s.graph.Nodes[cur]; node != nil {
				out = append(out, node)
				added++
				if added >= max {
					break
				}
			}
		}
		if depth[cur] >= maxDepth {
			continue
		}
		// Follow the call flow forward, and at each step cross the dynamic-dispatch
		// seam to any concrete implementors, so an interface method on the path
		// brings its real body along instead of forcing a separate query. Targets
		// whose names match the question's domain nouns come first, so the path
		// reaches named work before generic helpers.
		next := s.rankedPathTargets(cur, tokens, words)
		if len(next) > maxPathBranch {
			next = next[:maxPathBranch]
		}
		for _, to := range next {
			if inSet[to] {
				continue
			}
			node := s.graph.Nodes[to]
			// Skip external and git-ignored generated targets: the call path stays in
			// authored code, the same de-surfacing the matcher applies.
			if node == nil || node.External || s.ignored[node.File] {
				continue
			}
			inSet[to] = true
			depth[to] = depth[cur] + 1
			priority[to] = s.pathTargetScoreFrom(cur, to, tokens, words)
			queue = append(queue, to)
			sortPathQueue(queue, priority)
		}
	}
	return out
}

func (s *Server) withAnchoredCallPath(seeds []*graph.Node, max int, query string, tokens []string, words map[string]bool) []*graph.Node {
	anchors := flowAnchors(query, seeds, words)
	if len(anchors) < 2 {
		return nil
	}
	out := make([]*graph.Node, 0, max)
	seen := map[string]bool{}
	add := func(id string) {
		if len(out) >= max || seen[id] {
			return
		}
		node := s.graph.Nodes[id]
		if node == nil || !flowNodeEligible(node) || node.External || s.ignored[node.File] {
			return
		}
		seen[id] = true
		out = append(out, node)
	}
	add(anchors[0].ID)
	for i := 1; i < len(anchors) && len(out) < max; i++ {
		path := s.shortestFlowPath(anchors[i-1].ID, anchors[i].ID, tokens, words)
		if len(path) == 0 {
			add(anchors[i].ID)
			continue
		}
		for _, id := range path[1:] {
			add(id)
		}
	}
	if len(out) < 2 {
		return nil
	}
	return out
}

type flowAnchor struct {
	*graph.Node
	pos   int
	order int
}

func flowAnchors(query string, seeds []*graph.Node, words map[string]bool) []flowAnchor {
	whole := strings.ToLower(query)
	anchors := make([]flowAnchor, 0, len(seeds))
	seen := map[string]bool{}
	for order, node := range seeds {
		if node == nil || seen[node.ID] {
			continue
		}
		name := strings.ToLower(node.Name)
		pos := strings.Index(whole, name)
		if pos < 0 {
			member := strings.ToLower(memberName(node.Name))
			if member == name || !words[member] {
				continue
			}
			if !naturalDottedAnchor(node.Name, words) &&
				!(exactLongMemberAnchor(node.Name, words) && flowMemberAnchorEligible(node)) {
				continue
			}
			pos = strings.Index(whole, member)
			if pos < 0 {
				continue
			}
		}
		seen[node.ID] = true
		anchors = append(anchors, flowAnchor{Node: node, pos: pos, order: order})
	}
	sort.SliceStable(anchors, func(i, j int) bool {
		if anchors[i].pos != anchors[j].pos {
			return anchors[i].pos < anchors[j].pos
		}
		return anchors[i].order < anchors[j].order
	})
	return anchors
}

func flowMemberAnchorEligible(node *graph.Node) bool {
	return node != nil && (node.Kind == graph.NodeMethod || node.Kind == graph.NodeFunction)
}

func (s *Server) shortestFlowPath(fromID, toID string, tokens []string, words map[string]bool) []string {
	const maxDepth = 8
	if fromID == toID {
		return []string{fromID}
	}
	type step struct {
		id   string
		path []string
	}
	queue := []step{{id: fromID, path: []string{fromID}}}
	seen := map[string]bool{fromID: true}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		if len(cur.path) > maxDepth {
			continue
		}
		next := s.allFlowTargets(cur.id, toID, tokens, words)
		for _, id := range next {
			if seen[id] {
				continue
			}
			node := s.graph.Nodes[id]
			if node == nil || node.External || s.ignored[node.File] || !flowNodeEligible(node) {
				continue
			}
			path := append(append([]string(nil), cur.path...), id)
			if id == toID {
				return path
			}
			seen[id] = true
			queue = append(queue, step{id: id, path: path})
		}
	}
	return nil
}

func (s *Server) allFlowTargets(cur string, target string, tokens []string, words map[string]bool) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(s.forwardCallAdj[cur])+len(s.implementorsAdj[cur]))
	for _, id := range s.forwardCallAdj[cur] {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	for _, id := range s.implementorsAdj[cur] {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i] == target {
			return true
		}
		if out[j] == target {
			return false
		}
		left := s.pathTargetScoreFrom(cur, out[i], tokens, words)
		right := s.pathTargetScoreFrom(cur, out[j], tokens, words)
		if left != right {
			return left > right
		}
		return out[i] < out[j]
	})
	return out
}

func sortPathQueue(queue []string, priority map[string]int) {
	sort.SliceStable(queue, func(i, j int) bool {
		left := priority[queue[i]]
		right := priority[queue[j]]
		if left != right {
			return left > right
		}
		return queue[i] < queue[j]
	})
}

func (s *Server) rankedPathTargets(cur string, tokens []string, words map[string]bool) []string {
	seen := map[string]bool{}
	next := make([]string, 0, len(s.forwardCallAdj[cur])+len(s.implementorsAdj[cur]))
	for _, id := range s.forwardCallAdj[cur] {
		if !seen[id] {
			seen[id] = true
			next = append(next, id)
		}
	}
	for _, id := range s.implementorsAdj[cur] {
		if !seen[id] {
			seen[id] = true
			next = append(next, id)
		}
	}
	if s.allowsReverseConsumerSource(cur) {
		for _, id := range s.rankedReverseConsumers(cur, tokens, words) {
			if !seen[id] {
				seen[id] = true
				next = append(next, id)
			}
		}
	}
	sort.Slice(next, func(i, j int) bool {
		left := s.pathTargetScoreFrom(cur, next[i], tokens, words)
		right := s.pathTargetScoreFrom(cur, next[j], tokens, words)
		if left != right {
			return left > right
		}
		return next[i] < next[j]
	})
	positive := 0
	for _, id := range next {
		if s.pathTargetScoreFrom(cur, id, tokens, words) <= 0 {
			break
		}
		positive++
	}
	if positive > 0 {
		next = next[:positive]
	}
	return next
}

func (s *Server) allowsReverseConsumerSource(id string) bool {
	node := s.graph.Nodes[id]
	return node != nil && node.Kind == graph.NodeVariable
}

const maxReverseConsumerBranch = 3

func (s *Server) rankedReverseConsumers(cur string, tokens []string, words map[string]bool) []string {
	candidates := append([]string(nil), s.reverseValueAdj[cur]...)
	preferredOwners := s.queryOwnerHints(candidates, words)
	sort.Slice(candidates, func(i, j int) bool {
		left := s.pathTargetScoreFrom(cur, candidates[i], tokens, words)
		right := s.pathTargetScoreFrom(cur, candidates[j], tokens, words)
		if left != right {
			return left > right
		}
		return candidates[i] < candidates[j]
	})
	out := make([]string, 0, maxReverseConsumerBranch)
	seen := map[string]bool{}
	for _, id := range candidates {
		if seen[id] || s.pathTargetScoreFrom(cur, id, tokens, words) <= 0 {
			continue
		}
		node := s.graph.Nodes[id]
		if node == nil || node.External || s.ignored[node.File] || !flowNodeEligible(node) {
			continue
		}
		if len(preferredOwners) > 0 && !preferredOwners[ownerOf(node.Name)] {
			continue
		}
		seen[id] = true
		out = append(out, id)
		if len(out) >= maxReverseConsumerBranch {
			break
		}
	}
	return out
}

func (s *Server) queryOwnerHints(ids []string, words map[string]bool) map[string]bool {
	owners := map[string]bool{}
	for _, id := range ids {
		node := s.graph.Nodes[id]
		if node == nil {
			continue
		}
		owner := ownerOf(node.Name)
		if owner != "" && words[owner] {
			owners[owner] = true
		}
	}
	return owners
}

func (s *Server) pathTargetScoreFrom(fromID, toID string, tokens []string, words map[string]bool) int {
	score := s.pathTargetScore(toID, tokens, words)
	from := s.graph.Nodes[fromID]
	to := s.graph.Nodes[toID]
	if from == nil || to == nil {
		return score
	}
	if score > 0 && ownerOf(from.Name) != "" && ownerOf(from.Name) == ownerOf(to.Name) {
		score += 80
	}
	return score
}

func (s *Server) pathTargetScore(id string, tokens []string, words map[string]bool) int {
	node := s.graph.Nodes[id]
	if node == nil {
		return 0
	}
	name := strings.ToLower(node.Name)
	member := strings.ToLower(memberName(node.Name))
	score := naturalDottedScore(node.Name, words) + exactMemberScore(node.Name, words)
	for _, token := range tokens {
		switch {
		case name == token:
			score += 120
		case member == token:
			score += 120
		case strings.HasPrefix(member, token):
			score += 60
		case strings.Contains(member, token):
			score += 35
		}
	}
	for word := range words {
		if len(word) < 2 {
			continue
		}
		switch {
		case member == word:
			score += 90
		case strings.HasPrefix(member, word):
			score += 55
		case strings.Contains(member, word):
			score += 35
		}
	}
	return score
}

func ownerOf(name string) string {
	owner, _, ok := dottedNameParts(name)
	if !ok {
		return ""
	}
	return strings.ToLower(owner)
}

func nodeHandle(id string) string {
	h := fnv.New64a()
	_, _ = h.Write([]byte(id))
	return fmt.Sprintf("n:%016x", h.Sum64())
}

func (s *Server) nodeByRef(ref string) *graph.Node {
	ref = normalizeNodeRef(ref)
	if ref == "" {
		return nil
	}
	if node := s.graph.Nodes[ref]; node != nil {
		return node
	}
	if !strings.HasPrefix(ref, "n:") {
		return nil
	}
	for _, node := range s.graph.Nodes {
		if nodeHandle(node.ID) == ref {
			return node
		}
	}
	return nil
}

func normalizeNodeRef(ref string) string {
	ref = strings.TrimSpace(ref)
	if strings.HasPrefix(ref, "handle:") {
		ref = strings.TrimPrefix(ref, "handle:")
	}
	return ref
}

// maxAdjacentFiles caps the adjacency list so a hub file does not dump every
// neighbor; the overflow count is still reported.
const maxAdjacentFiles = 20

// maxExploreNodes caps how many ranked nodes a query returns, so a broad
// keyword query surfaces the most relevant declarations without flooding context.
const maxExploreNodes = 12

// queryTokens lowercases query and splits it into alphanumeric tokens. It does
// not carry a semantic stop-word list; relevance comes from the graph index and
// string matching against node names.
func queryTokens(query string) []string {
	fields := strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
		return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
	})
	tokens := make([]string, 0, len(fields))
	for _, field := range fields {
		if len(field) < 2 {
			continue
		}
		tokens = append(tokens, field)
	}
	return tokens
}

func queryWords(query string) map[string]bool {
	fields := strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
		return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
	})
	words := make(map[string]bool, len(fields))
	for _, field := range fields {
		if len(field) >= 2 {
			words[field] = true
		}
	}
	return words
}

func containsWholeWord(words map[string]bool, value string) bool {
	return words[strings.ToLower(value)]
}

func dottedNameParts(name string) (string, string, bool) {
	dot := strings.LastIndexByte(name, '.')
	if dot <= 0 || dot == len(name)-1 {
		return "", "", false
	}
	owner := name[:dot]
	if ownerDot := strings.LastIndexByte(owner, '.'); ownerDot >= 0 {
		owner = owner[ownerDot+1:]
	}
	return owner, name[dot+1:], true
}

func naturalDottedScore(name string, words map[string]bool) int {
	owner, member, ok := dottedNameParts(name)
	if !ok {
		return 0
	}
	if !containsWholeWord(words, owner) || !words[strings.ToLower(member)] {
		return 0
	}
	return 650
}

func naturalDottedAnchor(name string, words map[string]bool) bool {
	owner, member, ok := dottedNameParts(name)
	if !ok {
		return false
	}
	member = strings.ToLower(member)
	return containsWholeWord(words, owner) && words[member]
}

func naturalAnchorPosition(query, name string) int {
	owner, member, ok := dottedNameParts(strings.ToLower(name))
	if !ok {
		return len(query) + 1
	}
	ownerAt := strings.Index(query, owner)
	memberAt := -1
	if ownerAt >= 0 {
		if idx := strings.Index(query[ownerAt+len(owner):], member); idx >= 0 {
			memberAt = ownerAt + len(owner) + idx
		}
	}
	if memberAt < 0 {
		memberAt = strings.Index(query, member)
	}
	switch {
	case ownerAt >= 0 && memberAt >= 0:
		return memberAt
	case ownerAt >= 0:
		return ownerAt
	case memberAt >= 0:
		return memberAt
	default:
		return len(query) + 1
	}
}

func exactMemberScore(name string, words map[string]bool) int {
	_, member, ok := dottedNameParts(name)
	if !ok {
		return 0
	}
	if words[strings.ToLower(member)] {
		return 550
	}
	return 0
}

func exactLongMemberAnchor(name string, words map[string]bool) bool {
	_, member, ok := dottedNameParts(name)
	if !ok {
		return false
	}
	member = strings.ToLower(member)
	return len(member) >= 8 && words[member]
}

// matchNodes ranks declarations by relevance to query, which may be a symbol name
// or the salient nouns of a natural-language question. A name is scored per query
// token (exact > prefix > substring) plus a small centrality bonus (edge degree),
// so "render update canvas element" surfaces the rendering symbols rather than
// forcing the agent to grep. The top maxExploreNodes are returned; a capped
// file-path match is the fallback when nothing scores on names.
func (s *Server) matchNodesWithStrategy(query string, strategy nodeMatchMode) []*graph.Node {
	if strategy == nodeMatchModeExact {
		return s.matchNodesExact(query)
	}
	return s.matchNodes(query)
}

func (s *Server) matchNodesExact(query string) []*graph.Node {
	q := strings.Trim(strings.TrimSpace(query), "`")
	q = strings.TrimPrefix(q, "handle:")
	if q == "" {
		return nil
	}
	out := make([]*graph.Node, 0)
	seen := map[string]bool{}
	for _, node := range s.graph.Nodes {
		if node == nil || seen[node.ID] {
			continue
		}
		if nodeHandle(node.ID) == q ||
			node.Name == q ||
			s.relFile(node.File) == q ||
			node.File == q {
			seen[node.ID] = true
			out = append(out, node)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].File != out[j].File {
			return out[i].File < out[j].File
		}
		if s.declLine(out[i]) != s.declLine(out[j]) {
			return s.declLine(out[i]) < s.declLine(out[j])
		}
		return out[i].Name < out[j].Name
	})
	if len(out) > maxExploreNodes {
		out = out[:maxExploreNodes]
	}
	return out
}

func (s *Server) matchNodes(query string) []*graph.Node {
	whole := strings.ToLower(strings.TrimSpace(query))
	tokens := queryTokens(query)
	words := queryWords(query)

	type scored struct {
		node         *graph.Node
		score        int
		dotted       bool
		exactAnchor  bool
		memberAnchor bool
		anchorPos    int
	}
	ranked := make([]scored, 0)
	for _, node := range s.graph.Nodes {
		name := strings.ToLower(node.Name)
		// De-surface git-ignored generated code: keep it reachable only by an
		// exact name query, so it never dominates a broad or keyword match.
		if s.ignored[node.File] && name != whole {
			continue
		}
		score := 0
		dotted := false
		exactAnchor := false
		memberAnchor := false
		anchorPos := len(whole) + 1
		if name == whole {
			score += 1000
			exactAnchor = strings.Contains(name, ".")
			anchorPos = 0
		}
		if strings.Contains(name, ".") && strings.Contains(whole, name) {
			score += 900
			dotted = true
			exactAnchor = true
			anchorPos = strings.Index(whole, name)
		} else if naturalScore := naturalDottedScore(node.Name, words); naturalScore > 0 {
			score += naturalScore
			dotted = true
			exactAnchor = naturalDottedAnchor(node.Name, words)
			if exactAnchor {
				anchorPos = naturalAnchorPosition(whole, node.Name)
			}
		} else if memberScore := exactMemberScore(node.Name, words); memberScore > 0 {
			score += memberScore
			dotted = true
			memberAnchor = exactLongMemberAnchor(node.Name, words)
		} else if len(name) >= 8 && strings.Contains(whole, name) {
			score += 500
		}
		for _, token := range tokens {
			switch {
			case name == token:
				score += 100
			case strings.HasPrefix(name, token):
				score += 40
			case strings.Contains(name, token):
				switch {
				case len(token) >= 8:
					score += 80
				case len(token) >= 5:
					score += 24
				default:
					score += 12
				}
			}
		}
		if score == 0 {
			continue
		}
		if score >= 100 {
			if degree := s.degree[node.ID]; degree > 0 {
				if degree > 5 {
					degree = 5
				}
				score += degree
			}
		}
		ranked = append(ranked, scored{node: node, score: score, dotted: dotted, exactAnchor: exactAnchor, memberAnchor: memberAnchor, anchorPos: anchorPos})
	}
	if len(ranked) > 0 {
		sort.Slice(ranked, func(i, j int) bool {
			if ranked[i].score != ranked[j].score {
				return ranked[i].score > ranked[j].score
			}
			return ranked[i].node.ID < ranked[j].node.ID
		})
		anchors := make([]*graph.Node, 0)
		for _, r := range ranked {
			if r.exactAnchor {
				anchors = append(anchors, r.node)
				if len(anchors) >= maxExploreNodes {
					break
				}
			}
		}
		if len(anchors) > 0 {
			anchorPos := make(map[string]int, len(ranked))
			for _, r := range ranked {
				if r.exactAnchor {
					anchorPos[r.node.ID] = r.anchorPos
				}
			}
			sort.SliceStable(anchors, func(i, j int) bool {
				left := anchorPos[anchors[i].ID]
				right := anchorPos[anchors[j].ID]
				if left != right {
					return left < right
				}
				return anchors[i].ID < anchors[j].ID
			})
			seen := make(map[string]bool, len(anchors))
			for _, node := range anchors {
				seen[node.ID] = true
			}
			for _, r := range ranked {
				if len(anchors) >= maxExploreNodes {
					break
				}
				if !r.memberAnchor || seen[r.node.ID] {
					continue
				}
				seen[r.node.ID] = true
				anchors = append(anchors, r.node)
			}
			return anchors
		}
		dottedOwners := map[string]bool{}
		for _, r := range ranked {
			if !r.dotted {
				continue
			}
			if dot := strings.LastIndexByte(strings.ToLower(r.node.Name), '.'); dot > 0 {
				dottedOwners[strings.ToLower(r.node.Name[:dot])] = true
			}
		}
		out := make([]*graph.Node, 0, maxExploreNodes)
		for _, r := range ranked {
			if len(out) >= maxExploreNodes {
				break
			}
			if len(dottedOwners) > 0 &&
				strings.ToLower(string(r.node.Kind)) == "class" &&
				dottedOwners[strings.ToLower(r.node.Name)] {
				continue
			}
			out = append(out, r.node)
		}
		return out
	}

	byFile := make([]*graph.Node, 0)
	for _, node := range s.graph.Nodes {
		if strings.Contains(strings.ToLower(node.File), whole) {
			byFile = append(byFile, node)
		}
	}
	sort.Slice(byFile, func(i, j int) bool { return byFile[i].ID < byFile[j].ID })
	if len(byFile) > maxExploreNodes {
		byFile = byFile[:maxExploreNodes]
	}
	return byFile
}

const maxFlowEvidenceEdges = 32

func (s *Server) edgeUseLine(edge *graph.Edge) int {
	from := s.graph.Nodes[edge.From]
	if from == nil || s.prog == nil || edge.Pos < 0 {
		return 0
	}
	file := s.prog.SourceFile(from.File)
	if file == nil {
		return 0
	}
	text := file.Text()
	if edge.Pos > len(text) {
		return 0
	}
	return 1 + strings.Count(text[:edge.Pos], "\n")
}

// nodeSource returns the verbatim declaration text of node and its 1-based start
// line, or ("", 0) when the source file is not in the program or the span is out
// of range. Leading whitespace before the declaration is skipped so the slice
// starts at the declaration keyword (or its leading doc comment).
func (s *Server) nodeSource(node *graph.Node) (string, int) {
	source, line, _ := s.nodeSourceRange(node)
	return source, line
}

func (s *Server) nodeSourceRange(node *graph.Node) (string, int, int) {
	file := s.prog.SourceFile(node.File)
	if file == nil {
		return "", 0, 0
	}
	text := file.Text()
	if node.Pos < 0 || node.End > len(text) || node.Pos >= node.End {
		return "", 0, 0
	}
	start := node.Pos
	for start < node.End && isSpace(text[start]) {
		start++
	}
	return text[start:node.End], 1 + strings.Count(text[:start], "\n"), start
}

func isSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}

// relFile shortens an absolute workspace path to one relative to the project
// root (the server cwd), so a response does not repeat the long absolute prefix
// on every edge. It is pure token waste, since the agent runs from that root. A path
// outside the root (a bundled lib) or an empty cwd (the prebuilt/test path) is
// returned unchanged.
func (s *Server) relFile(file string) string {
	if s.cwd == "" {
		return file
	}
	// Trim a trailing separator off the root so a cwd like "/project/" still
	// matches "/project/src/...". Return the forward-slash-normalized form even for
	// a path outside the root (a bundled lib), so every path in a response is
	// consistently forward-slash rather than mixing in OS-native backslashes.
	root := strings.TrimRight(strings.ReplaceAll(s.cwd, "\\", "/"), "/")
	f := strings.ReplaceAll(file, "\\", "/")
	if strings.HasPrefix(f, root+"/") {
		return f[len(root)+1:]
	}
	return f
}

// firstCodeOffset returns the index in src of the first non-trivia byte past
// leading whitespace and // line or /* */ block comments, so a signature begins
// at the declaration keyword rather than a leading doc comment or, worse, a
// .d.ts license banner that node.Pos includes as leading trivia.
func firstCodeOffset(src string) int {
	i := 0
	for i < len(src) {
		switch {
		case isSpace(src[i]):
			i++
		case src[i] == '/' && i+1 < len(src) && src[i+1] == '/':
			if j := strings.IndexByte(src[i:], '\n'); j >= 0 {
				i += j + 1
			} else {
				return len(src)
			}
		case src[i] == '/' && i+1 < len(src) && src[i+1] == '*':
			if j := strings.Index(src[i+2:], "*/"); j >= 0 {
				i += 2 + j + 2
			} else {
				return len(src)
			}
		default:
			return i
		}
	}
	return i
}

// declLine returns node's 1-based declaration line, skipping the leading doc
// comment that node.Pos carries as trivia so the line points at the declaration
// itself. Carrying this on every edge is what lets a shell-native agent cite a
// call target without re-reading the file to count lines. That was the dominant residual
// cost the bare-name edge left on the table (a full signature, by contrast, only
// bloated the response without cutting the body fetches a thorough model makes).
func (s *Server) declLine(node *graph.Node) int {
	src, line := s.nodeSource(node)
	if src == "" {
		return line
	}
	return line + strings.Count(src[:firstCodeOffset(src)], "\n")
}

const maxExpandedSourceLines = 180

func expandedSourceLines(nodes int) int {
	switch {
	case nodes <= 3:
		return maxExpandedSourceLines
	case nodes <= 5:
		return 120
	default:
		return 80
	}
}

func memberName(name string) string {
	if dot := strings.LastIndexByte(name, '.'); dot >= 0 {
		return name[dot+1:]
	}
	return name
}

// dependents returns the set of distinct node ids that transitively depend on
// node (reach it through an edge): the blast radius of an edit, walked over the
// reverse adjacency. The caller intersects it with the diagnostics index to show
// how much of the reach is already broken.
func (s *Server) dependents(node *graph.Node) map[string]bool {
	seen := map[string]bool{}
	queue := []string{node.ID}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		for _, from := range s.reverseAdj[current] {
			if !seen[from] {
				seen[from] = true
				queue = append(queue, from)
			}
		}
	}
	return seen
}

// nodeDiagnostics returns the diagnostics attributed to a node plus those on any
// node nested within its source span. A class collects its methods' findings, so
// exploring the class shows that its members are broken. The fix-safety signal
// would otherwise sit only on the member nodes, which the agent has not named.
func (s *Server) nodeDiagnostics(node *graph.Node) []fusedDiagnostic {
	out := append([]fusedDiagnostic(nil), s.diagsByNode[node.ID]...)
	for _, other := range s.graph.Nodes {
		if other.ID == node.ID || other.File != node.File {
			continue
		}
		if other.Pos >= node.Pos && other.End <= node.End {
			out = append(out, s.diagsByNode[other.ID]...)
		}
	}
	return out
}

// diagnostics returns a file's diagnostics as text. It reads the fused set, so
// when a plugin-aware host has injected @ttsc/lint and transform-plugin findings
// they appear here alongside the tsc errors, in the same code and location tsc
// reports.
func (s *Server) queryDiagnostics(args json.RawMessage) (any, *rpcError) {
	var in struct {
		Files    []string                 `json:"files"`
		Severity diagnosticSeverityFilter `json:"severity"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return nil, &rpcError{Code: codeInvalidParams, Message: "query_diagnostics: invalid arguments"}
	}
	sev := diagnosticSeverityFilter(strings.ToLower(strings.TrimSpace(string(in.Severity))))
	if sev == "" {
		sev = diagnosticSeverityFilterError
	}
	if sev != diagnosticSeverityFilterError && sev != diagnosticSeverityFilterWarning && sev != diagnosticSeverityFilterAll {
		return nil, &rpcError{Code: codeInvalidParams, Message: `query_diagnostics 'severity' must be "error", "warning", "all", or omitted`}
	}
	if err := s.ensureLoaded(); err != nil {
		return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
	}
	s.refreshIfStale()
	s.refreshDiagnostics()
	locations := make([]string, 0, len(in.Files))
	for _, f := range in.Files {
		if strings.TrimSpace(f) != "" {
			locations = append(locations, f)
		}
	}
	// No files: the whole-project listing, one block.
	if len(locations) == 0 {
		result := s.projectDiagnosticsResult(sev)
		return structuredToolResult(result, fmt.Sprintf("query_diagnostics returned %d diagnostics", diagnosticsShown(result.Files))), nil
	}
	result := s.queryDiagnosticsFilesResult(locations, sev)
	return structuredToolResult(result, fmt.Sprintf("query_diagnostics returned %d diagnostics", diagnosticsShown(result.Files))), nil
}

// maxProjectDiagnostics caps the whole-project listing so a badly broken project
// cannot flood the agent's context.
const maxProjectDiagnostics = 100

// severityMatches reports whether d satisfies the requested filter: "error" keeps
// errors, "warning" keeps warnings, and "" (the default) keeps both.
func severityMatches(d fusedDiagnostic, want diagnosticSeverityFilter) bool {
	switch want {
	case diagnosticSeverityFilterError:
		return d.IsError()
	case diagnosticSeverityFilterWarning:
		return !d.IsError()
	default:
		return true
	}
}

// sortDiagnostics orders diagnostics by source location so a file's findings
// read top-to-bottom (the fused set otherwise lists the compiler's pass before
// the injected plugin findings, regardless of line).
func sortDiagnostics(diags []fusedDiagnostic) {
	sort.Slice(diags, func(i, j int) bool {
		if diags[i].Line != diags[j].Line {
			return diags[i].Line < diags[j].Line
		}
		if diags[i].Column != diags[j].Column {
			return diags[i].Column < diags[j].Column
		}
		return diags[i].Code < diags[j].Code
	})
}

// resolveFile maps a tool's file argument to program source-file paths. An exact
// path match wins outright; otherwise it returns every source file whose path
// ends with the argument on a path-segment boundary (so "main.ts" matches
// "src/main.ts" but not "src/domain.ts"). Returning all matches lets the caller
// reject an ambiguous fragment instead of silently picking an arbitrary file.
func (s *Server) resolveFile(file string) []string {
	// tsgo normalizes FileName() to forward slashes, so normalize the argument too
	// Otherwise a Windows-style "src\main.ts" never matches ".../src/main.ts".
	file = filepath.ToSlash(file)
	for _, source := range s.prog.SourceFiles() {
		if source.FileName() == file {
			return []string{file}
		}
	}
	needle := "/" + file
	var matches []string
	for _, source := range s.prog.SourceFiles() {
		if strings.HasSuffix(source.FileName(), needle) {
			matches = append(matches, source.FileName())
		}
	}
	return matches
}
