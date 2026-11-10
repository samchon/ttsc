const fs = require("node:fs");
const path = require("node:path");
let buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const end = buffer.indexOf("\r\n\r\n");
    if (end < 0) return;
    const length = Number(/Content-Length:\s*(\d+)/i.exec(buffer.subarray(0, end).toString())[1]);
    if (buffer.length < end + 4 + length) return;
    const request = JSON.parse(buffer.subarray(end + 4, end + 4 + length));
    buffer = buffer.subarray(end + 4 + length);
    if (request.id === undefined) continue;
    fs.appendFileSync(path.join(__dirname, "mapper-used"), request.method + "\n");
    const result = request.method === "initialize"
      ? { positionEncoding: "utf-16", diagnosticSource: "unused-mapper", protocolVersion: request.params.protocolVersion }
      : request.method === "transform"
        ? { text: request.params.content, extension: ".ts", mappings: [] }
        : null;
    const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }));
    process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
    process.stdout.write(body);
  }
});
