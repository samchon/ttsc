const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Authored fixture rendezvous. A cold observer is ready before any command;
// publication holds effectful/fast-exiting actors live until original-handle
// enrollment. Grandchild's original 500ms timer never passes through this gate.
function location(role, event) {
  assert.match(role, /^[a-z0-9-]+$/);
  return path.join(process.env.TTSC_LIFETIME_ROOT, `lifetime-${role}-${event}.json`);
}

function publish(role, event, body) {
  const target = location(role, event);
  const temporary = target + ".pending";
  fs.writeFileSync(temporary, JSON.stringify({
    sessionNonce: process.env.TTSC_LIFETIME_SESSION,
    role,
    pid: process.pid,
    publishedAt: Date.now(),
    publishedNs: process.hrtime.bigint().toString(),
    ...body,
  }));
  fs.renameSync(temporary, target);
}

function awaitAck(role, event, pid = process.pid) {
  const target = location(role, event);
  const until = Date.now() + 5000;
  const cell = new Int32Array(new SharedArrayBuffer(4));
  while (!fs.existsSync(target)) {
    assert.ok(Date.now() < until, "original lifetime acknowledgement deadline");
    Atomics.wait(cell, 0, 0, 10);
  }
  const ack = JSON.parse(fs.readFileSync(target, "utf8"));
  assert.equal(ack.sessionNonce, process.env.TTSC_LIFETIME_SESSION);
  assert.equal(ack.role, role);
  assert.equal(ack.pid, pid);
  assert.equal(typeof ack.targetId, "string");
  assert.match(ack.targetId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.ok(ack.identity && typeof ack.identity === "object");
  return ack;
}

function enrolled(role) {
  publish(role, "ready", {});
  return awaitAck(role, "acquired");
}

function requireRetired(role, target, joinObserved = {}) {
  publish(role, "retire", { targetId: target.targetId, pid: target.pid, ...joinObserved });
  const ack = awaitAck(role, "retired", target.pid);
  assert.equal(ack.targetId, target.targetId);
  assert.deepEqual(ack.identity, target.identity);
  assert.equal(ack.retired, true);
}

module.exports = { enrolled, requireRetired, location, awaitAck };
