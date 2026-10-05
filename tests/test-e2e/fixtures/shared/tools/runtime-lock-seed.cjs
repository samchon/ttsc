const { acquireDependencyBuildLock } = require(process.env.TTSC_E2E_LOCK_IMPLEMENTATION);
if (acquireDependencyBuildLock(process.env.TTSC_E2E_LOCK_DIRECTORY) === null)
  throw new Error("the lock was not acquired");
console.log("holder-acquired");
require(process.env.TTSC_E2E_MISSING_OWNED_SOURCE);
