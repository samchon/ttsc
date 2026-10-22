//go:build ttsc_typescript_7_1

package driver_test

import (
  "testing"
)

// contentMapperMapperScript is a content mapper that speaks the compiler's
// mapper protocol: JSON-RPC over stdio with Content-Length framing. It maps a
// `.sql` file whose text names one column into a module exporting a `query`
// whose only property is that column, and it appends every request method it
// receives to mapper.log beside itself.
const contentMapperMapperScript = `"use strict";
const fs = require("node:fs");
const path = require("node:path");
const log = (line) => fs.appendFileSync(path.join(__dirname, "mapper.log"), line + "\n");
let buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const match = /Content-Length: *(\d+)/i.exec(buffer.subarray(0, headerEnd).toString("ascii"));
    const length = Number(match[1]);
    if (buffer.length < headerEnd + 4 + length) return;
    const message = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString("utf8"));
    buffer = buffer.subarray(headerEnd + 4 + length);
    if (message.id === undefined || message.id === null) continue;
    const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: handle(message.method, message.params) }), "utf8");
    process.stdout.write("Content-Length: " + body.length + "\r\n\r\n");
    process.stdout.write(body);
  }
});
function handle(method, params) {
  log(method);
  switch (method) {
    case "initialize":
      return { positionEncoding: "utf-16", diagnosticSource: "sql" };
    case "openProject":
      return { configIdentity: "" };
    case "transform":
      return { text: "export declare const query: { " + params.content.trim() + ": string };\n", extension: ".ts" };
    default:
      return null;
  }
}
`

// writeContentMapperProject writes a project whose index.ts reads
// `query.name` from ./query.sql, a file only the sql-mapper content mapper can
// turn into TypeScript, and returns its root.
func writeContentMapperProject(t *testing.T) string {
  t.Helper()
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["index.ts"],
  "contentMappers": [{ "package": "sql-mapper", "extensions": [".sql"] }]
}
`)
  writeProjectFile(t, root, "index.ts", "import { query } from \"./query.sql\";\nexport const value: string = query.name;\n")
  writeProjectFile(t, root, "query.sql", "name\n")
  writeProjectFile(t, root, "node_modules/sql-mapper/package.json", `{
  "name": "sql-mapper",
  "version": "1.0.0",
  "typescript": { "contentMapper": { "exec": ["node", "./mapper.js"] } }
}
`)
  writeProjectFile(t, root, "node_modules/sql-mapper/mapper.js", contentMapperMapperScript)
  return root
}
