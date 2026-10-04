const fs = require("node:fs");
const path = require("node:path");
const root = process.env.LOCK_ROOT;
const role = process.env.LOCK_ROLE;
const api = (name) => require(path.join(process.env.LOCK_API, name + ".ts"))[name];
const acquire = api("acquireDependencyBuildLock");
const inspect = api("inspectDependencyBuildLock");
const reclaim = api("reclaimDependencyBuildLock");
const release = api("releaseDependencyBuildLock");
const lock = path.join(root, "entry.lock");
const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value));
const wait = (name) => {
  const deadline = Date.now() + 120000;
  while (!fs.existsSync(path.join(root, name))) {
    if (Date.now() > deadline) throw new Error("barrier timeout: " + name);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
};
const observed = inspect(lock, Date.now());
if (observed.state !== "abandoned") throw new Error("seed not abandoned: " + observed.state);
write(role + "-ready.json", observed.fence);
wait(role + "-start");
const reclaimed = reclaim(lock, observed.fence);
const lease = acquire(lock);
write(role + "-observed.json", { reclaimed, holding: lease !== null });
if (role === "a") {
  if (!lease) throw new Error("winner failed to acquire");
  write("a-lease.json", lease);
  wait("a-finalize");
  write("a-result.json", { released: release(lock, lease) });
} else {
  if (lease) {
    release(lock, lease);
    throw new Error("stale contender acquired live winner");
  }
  wait("b-successor");
  const successor = acquire(lock);
  if (!successor) throw new Error("successor failed to acquire");
  write("b-lease.json", successor);
  wait("b-finalize");
  write("b-result.json", { released: release(lock, successor) });
}
