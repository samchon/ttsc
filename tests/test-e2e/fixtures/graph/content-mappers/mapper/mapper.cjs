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
    if (request.id === undefined || request.id === null) continue;
    fs.appendFileSync(path.join(__dirname, "mapper.log"), request.method + "\n");
    let result = null;
    if (request.method === "initialize")
      result = { positionEncoding: "utf-16", diagnosticSource: "minimal-mapper", protocolVersion: request.params.protocolVersion };
    else if (request.method === "openProject")
      result = { configIdentity: "schema", watchedFiles: [path.join(__dirname, "schema.txt")] };
    else if (request.method === "transform") {
      const value = request.params.content.trim();
      const type = fs.readFileSync(path.join(__dirname, "schema.txt"), "utf8").trim();
      result = { text: `export const answer: ${type === "literal" ? value : type} = ${value};\nexport type Answer = typeof answer;\n`, extension: ".ts", mappings: [] };
    }
    const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }));
    process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
    process.stdout.write(body);
  }
});
