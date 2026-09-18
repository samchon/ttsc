import { bunRuntime } from "./core/bun/bunRuntime";
import { ensureRegistered } from "./core/bun/ensureRegistered";
import { registrationState } from "./core/bun/registrationState";

export { register, register as default } from "./core/bun/register";

// Auto-register on import so a `bunfig.toml` `preload` entry — which only
// imports the module — takes effect. The side effect lives in this entry, not
// in a core module it imports, so each evaluation of either built condition
// registers exactly as a preload does, and `sideEffects` names only the entry.
// Guarded so importing from Node (a stray import, or a unit test) is a
// harmless no-op rather than a throw.
const runtime = bunRuntime();
if (runtime !== undefined) {
  ensureRegistered(runtime, registrationState(runtime));
}
