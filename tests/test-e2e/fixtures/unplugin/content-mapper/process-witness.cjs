const fs = require("node:fs");
const net = require("node:net");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
let server;

// Native birth stamps distinguish a later occupant of the same PID. macOS's
// second-wide stamp conservatively rejects indistinguishable same-second reuse.
const nativeIdentity = (pid) => {
  if (process.platform === "linux") {
    let stat;
    try { stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8"); }
    catch (error) { if (error.code === "ENOENT" || error.code === "ESRCH") return undefined; throw error; }
    const fields = stat.slice(stat.lastIndexOf(") ") + 2).trim().split(/\s+/);
    if (!/^\d+$/.test(fields[19] ?? "")) throw new Error("Missing native process start ticks");
    return fields[19];
  }
  const observed = spawnSync("ps", ["-p", String(pid), "-o", "lstart="],
    { encoding: "utf8", windowsHide: true, env: { ...process.env, LC_ALL: "C" } });
  if (observed.error) throw observed.error;
  if (observed.signal !== null || (observed.status !== 0 && !(observed.status === 1 && observed.stdout.trim() === "" && observed.stderr.trim() === "")))
    throw new Error("Native process identity query failed: " + observed.stderr);
  return observed.stdout.trim() || undefined;
};

// A Windows mapper retains its unique kernel pipe until process death. This
// avoids spawning an identity-query process inside the mapper's RPC deadline.
exports.capture = async () => {
  const pid = process.pid;
  if (process.platform !== "win32") {
    const identity = nativeIdentity(pid);
    if (identity === undefined) throw new Error("Mapper process has no native identity");
    return { pid, identity };
  }
  const endpoint = "\\\\.\\pipe\\ttsc-mapper-" + crypto.randomUUID();
  server = net.createServer((socket) => socket.end());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(endpoint, resolve);
  });
  return { pid, endpoint };
};

// Silence, query errors and timeouts never certify departure. A pipe connection
// proves the original Windows mapper still lives; only native absence accepts it.
exports.departed = async ({ pid, identity, endpoint }) => {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("Invalid process ID");
  if (process.platform === "win32" ? typeof endpoint !== "string" : typeof identity !== "string")
    throw new Error("Missing mapper process witness");
  try { process.kill(pid, 0); }
  catch (error) { if (error.code === "ESRCH") return true; throw error; }
  if (process.platform !== "win32") return nativeIdentity(pid) !== identity;
  return new Promise((resolve, reject) => {
    const socket = net.connect(endpoint);
    const finish = (error, departed) => {
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error); else resolve(departed);
    };
    const timer = setTimeout(() => finish(new Error("Mapper pipe probe did not settle")), 5000);
    socket.once("connect", () => finish(undefined, false));
    socket.once("error", (error) => finish(
      error.code === "ENOENT" || error.code === "ECONNREFUSED" ? undefined : error,
      true,
    ));
  });
};
