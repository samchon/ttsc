/** Write a launcher help page to stdout. */
function write(lines: readonly string[]): void {
  process.stdout.write(`${lines.join("\n")}\n`);
}

/** Print the top-level `ttsc-graph` command help. */
export function printGraphHelp(): void {
  write([
    "Usage: ttsc-graph [command] [options]",
    "",
    "Without a command, serve the inspect_typescript_graph MCP tool over stdio.",
    "",
    "Commands:",
    "  dump       Write the native compiler graph as JSON.",
    "  view       Open a local 3D graph viewer.",
    "  inspect    Run one semantic graph request and write its JSON result.",
    "",
    "MCP options:",
    "  --cwd <path>          Project root (default: current directory).",
    "  --tsconfig <file>     tsconfig relative to --cwd (default: tsconfig.json).",
    "",
    "Run 'ttsc-graph <command> --help' for command-specific options.",
  ]);
}

/**
 * Print `ttsc-graph dump` help without starting the native binary.
 *
 * `dump` forwards to `ttscgraph`, which owns the flag contract, so this page is
 * a summary and not the source of truth. Answering locally is still right —
 * help has to work when no platform package is installed — but the page names
 * the authority so a reader who needs the exact current set knows where it
 * lives rather than trusting a copy that can drift.
 */
export function printDumpHelp(): void {
  write([
    "Usage: ttsc-graph dump [options]",
    "",
    "Write the whole compiler graph as JSON to stdout: every node and edge,",
    "none of the MCP response caps. The native `ttscgraph` binary owns these",
    "flags; run `ttscgraph dump --help` through an installed ttsc for its",
    "authoritative list.",
    "",
    "Options:",
    "  --cwd <path>          Project root (default: current directory).",
    "  --tsconfig <file>     tsconfig relative to --cwd (default: tsconfig.json).",
    "  --pretty[=true|false] Pretty-print the graph JSON.",
  ]);
}

/** Print `ttsc-graph view` help without starting the local web server. */
export function printViewHelp(): void {
  write([
    "Usage: ttsc-graph view [options]",
    "",
    "Build the graph and serve a local 3D viewer until Ctrl+C.",
    "",
    "Options:",
    "  --cwd <path>          Project root (default: current directory).",
    "  --tsconfig, -p <file> tsconfig relative to --cwd (default: tsconfig.json).",
    "  --port <number>       Local port, or 0 for an available port (default: 0).",
    "  --no-open             Do not open the viewer in the default browser.",
    "  --max-nodes <number>  Visible-node budget (default: 1200).",
  ]);
}

/** Print the semantic CLI projection of the MCP request union. */
export function printInspectHelp(): void {
  write([
    "Usage: ttsc-graph inspect <request> [arguments] [options]",
    "",
    "Run one compiler-resolved graph request and write { audit, next, result } JSON.",
    "Each command reads the current disk snapshot; it does not start an MCP server.",
    "",
    "Requests:",
    "  overview [--aspect all|layers|hotspots|publicApi]",
    "  entrypoints <question> [--limit <1..8>] [--neighbors <0..2>]",
    "  lookup <query> [--limit <1..6>] [--include-external]",
    "  details <handle...> [--neighbors] [--neighbor-limit <1..3>]",
    "      [--member-limit <number>] [--dependency-limit <1..4>] [--include-external]",
    "  trace <from> [--to <target>] [--direction forward|reverse|impact]",
    "      [--focus all|execution|types] [--max-depth <number>]",
    "      [--max-nodes <number>] [--include-external]",
    "  tour <question> [--hint <symbol>]... [--limit <1..5>] [--no-tests]",
    "",
    "Shared options:",
    "  --cwd <path>          Project root (default: current directory).",
    "  --tsconfig, -p <file> tsconfig relative to --cwd (default: tsconfig.json).",
    "  --pretty              Pretty-print the result JSON.",
    "",
    "Examples:",
    "  ttsc-graph inspect overview --cwd .",
    "  ttsc-graph inspect trace Service.run --to helper --focus execution",
    "  ttsc-graph inspect tour 'How does the request flow work?' --hint Service.run",
  ]);
}
