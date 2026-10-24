const fs = require("node:fs");
const path = require("node:path");
const schema = path.join(__dirname, "schema.txt");
const log = path.join(__dirname, "mapper.log");
let buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const end = buffer.indexOf("\r\n\r\n");
    if (end === -1) return;
    const length = Number(/Content-Length: *(\d+)/i.exec(buffer.subarray(0, end).toString("ascii"))[1]);
    if (buffer.length < end + 4 + length) return;
    const request = JSON.parse(buffer.subarray(end + 4, end + 4 + length).toString("utf8"));
    buffer = buffer.subarray(end + 4 + length);
    if (request.id == null) continue;
    fs.appendFileSync(log, JSON.stringify({ method: request.method, pid: process.pid }) + "\n");
    let result = null;
    if (request.method === "initialize")
      result = { positionEncoding: "utf-16", diagnosticSource: "sql" };
    if (request.method === "openProject")
      result = { configIdentity: fs.existsSync(schema) ? fs.readFileSync(schema, "utf8") : "missing", watchedFiles: [schema] };
    if (request.method === "transform")
      result = { text: "export declare const query: { " + request.params.content.trim() + ": " + (fs.existsSync(schema) ? fs.readFileSync(schema, "utf8").trim() : "string") + " };\n", extension: ".ts" };
    const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }));
    process.stdout.write("Content-Length: " + body.length + "\r\n\r\n");
    process.stdout.write(body);
  }
});
