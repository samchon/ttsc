import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

const root = process.argv[3];
const startup = JSON.parse(fs.readFileSync(path.join(root, "startup.json"), "utf8"));
const reply = (value) => process.stdout.write(JSON.stringify(value) + "\n");
const preparation = { binaries: [], startedAt: "peer-start", finishedAt: "peer-ready", elapsedMs: 0 };
if (startup.readiness === "error") reply({ readiness: true, error: "AUTHORED_READY_ERROR" });
if (startup.readiness === "success" || startup.readiness === "duplicate")
  reply({ readiness: true, preparation });
if (startup.readiness === "duplicate") reply({ readiness: true, preparation });
process.stderr.write("AUTHORED_STDERR_한글\n");
const held = new Map();
let splitTail;
for await (const line of createInterface({ input: process.stdin })) {
  const command = JSON.parse(line);
  if (command.close) process.exit(0);
  const action = command.pluginLock?.action ?? command.sourceSuffix;
  if (action === "hold") held.set(command.id, command);
  else if (action === "barrier") reply({ id: command.id, value: [...held.keys()] });
  else if (action === "release") {
    for (const id of [...held.keys()].reverse()) reply({ id, value: "RELEASED" });
    held.clear();
    reply({ id: command.id, value: "RELEASE_ACK" });
  } else if (action === "domain-error") reply({ id: command.id, error: "AUTHORED_DOMAIN_ERROR" });
  else if (action === "malformed") process.stdout.write("{bad-json}\n");
  else if (action === "unknown") reply({ id: command.id + 100, value: "UNOWNED" });
  else if (action === "partial") {
    await new Promise((resolve) => process.stdout.write(Buffer.from([0x7b, 0x22, 0xe2, 0x82]), resolve));
    process.exit(0);
  } else if (action === "nonzero") process.exit(7);
  else if (action === "normal-close") process.exit(0);
  else if (action === "split") {
    const bytes = Buffer.from(JSON.stringify({ id: command.id, value: "한글" }) + "\n");
    const split = bytes.indexOf(Buffer.from("한")) + 1;
    await new Promise((resolve) => process.stdout.write(bytes.subarray(0, split), resolve));
    splitTail = bytes.subarray(split);
  } else if (action === "split-release") {
    process.stdout.write(splitTail);
    splitTail = undefined;
    reply({ id: command.id, value: "SPLIT_RELEASED" });
  } else reply({ id: command.id, value: action || "OK" });
}
