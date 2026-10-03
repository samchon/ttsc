/**
 * Verifies solid/no-proxy-apis: direct `Proxy` construction is rejected.
 *
 * Pins the rule that flags `new Proxy(...)` literals. Solid's stores already
 * wrap state in proxies internally; ad-hoc proxies in user code defeat the
 * fine-grained tracking and usually point to React/Vue-style reactivity
 * carry-over.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Construct `new Proxy({}, {})` directly.
 */
import { createSignal } from "solid-js";

createSignal(0);

// expect: solid/no-proxy-apis error
const handler = new Proxy({}, {});

JSON.stringify({ handler });
