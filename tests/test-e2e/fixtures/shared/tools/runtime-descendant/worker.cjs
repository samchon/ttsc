const fs = require("node:fs");
const path = require("node:path");
fs.writeFileSync(path.join(__dirname, "ready.tmp"), JSON.stringify({ pid: process.pid }));
fs.renameSync(path.join(__dirname, "ready.tmp"), path.join(__dirname, "ready.json"));
const deadline = Date.now() + 30000;
while (!fs.existsSync(path.join(__dirname, "release"))) {
  if (Date.now() > deadline) throw new Error("descendant release was not sent");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
}
const { value } = require("../../src/runtime-corpus/descendant-lazy.cts");
fs.writeFileSync(path.join(__dirname, "result"), value);
