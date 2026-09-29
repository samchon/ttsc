import type { BunRegistrationState } from "./BunRegistrationState";
import type { BunRuntimeGlobal } from "./BunRuntimeGlobal";

/**
 * Pending and locked options for the single runtime loader.
 *
 * Bun uses the first matching `onLoad` hook and does not fall through to a
 * later overlapping plugin (oven-sh/bun#20583). Registering twice — once
 * implicitly on import, once explicitly — would let the default loader shadow
 * the configured one. Instead exactly one Bun plugin is registered. Calls made
 * before its first load replace this detached snapshot; entering the first
 * transformable load locks that value synchronously for the process's immutable
 * module-loading session. State is keyed by the Bun runtime in a global weak
 * map so loading both emitted module conditions cannot install two overlapping
 * loaders.
 */
const BUN_REGISTRATION_STATES = Symbol.for(
  "@ttsc/unplugin/bun-register/states/v1",
);

/**
 * Resolve the registration state owned by one concrete Bun runtime object,
 * creating it on first use.
 *
 * The map lives on `globalThis` under a registry symbol, so the CommonJS and
 * ESM builds of `bun-register`, which are separate module instances, still
 * share one state and install one loader between them.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A registry symbol gives separately emitted modules the same owned slot,
 *   and a WeakMap keys state by the actual runtime object rather than a name.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns shared-state initialization; installation and option
 *   transitions stay with their dedicated operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The namespaced symbol creates package-owned registration state without
 *   replacing a foreign global or Bun method. A conflicting non-WeakMap slot
 *   is not repaired; nonconfigurable collision propagates as a registration error.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains concrete-runtime identity and dual-module sharing, with
 *   separate descriptive paragraphs and tags per documentation guidance.
 */
export function registrationState(
  runtime: BunRuntimeGlobal,
): BunRegistrationState {
  const holder = globalThis as unknown as Record<PropertyKey, unknown>;
  let states = holder[BUN_REGISTRATION_STATES];
  if (!(states instanceof WeakMap)) {
    states = new WeakMap<object, BunRegistrationState>();
    Object.defineProperty(holder, BUN_REGISTRATION_STATES, {
      configurable: false,
      enumerable: false,
      value: states,
      writable: false,
    });
  }
  const registrations = states as WeakMap<object, BunRegistrationState>;
  const existing = registrations.get(runtime);
  if (existing !== undefined) return existing;
  const created: BunRegistrationState = {
    activeOptions: undefined,
    lockedOptions: undefined,
    optionsLocked: false,
    registered: false,
  };
  registrations.set(runtime, created);
  return created;
}
