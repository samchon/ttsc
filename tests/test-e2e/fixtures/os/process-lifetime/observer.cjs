const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// This separate actual owner process must be able to exit while the unrelated
// descendant still owns stdout. Do not dispose or kill that descendant here.
const [adapter, moduleURL, root] = process.argv.slice(2);
(async () => {
  const module = await import(moduleURL);
  const ready = path.join(root, "observer.ready");
  const descendant = path.join(root, "observer.child");
  const ended = path.join(root, "observer.ended");
  assert.equal(adapter, "resident");
  const owner = new module.ResidentCheckProcess({
    binary: process.execPath,
    args: [path.join(root, "worker.cjs"), "resident", "pipe", ready, descendant, ended, "5000"],
    cwd: root, env: process.env,
  });
  const until = Date.now() + 8000;
  while (![ready, descendant].every((file) => fs.existsSync(file) && /^[1-9]\d*\n$/.test(fs.readFileSync(file, "utf8")))) {
    assert.ok(Date.now() < until, "observer child readiness");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  fs.writeFileSync(path.join(root, "observer.close-start"), String(Date.now()));
  await assert.rejects(owner.close(), /did not close after termination/);
  await assert.rejects(owner.waitForExit(), /did not close after termination/);
  await assert.rejects(owner.close(), /did not close after termination/);
  console.log("unknown join remains failed");
})();
