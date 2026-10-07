const fs = require("node:fs");
const path = require("node:path");
const { acquireDependencyBuildLock } = require(path.join(process.env.LOCK_API, "acquireDependencyBuildLock.ts"));
const root = process.env.LOCK_ROOT;
const lease = acquireDependencyBuildLock(path.join(root, "entry.lock"));
if (!lease) throw new Error("seed could not acquire");
fs.writeFileSync(path.join(root, "seed.json"), JSON.stringify(lease));
