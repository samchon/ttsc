/**
 * Verifies solid/jsx-no-undef: JSX component tags must resolve to a binding.
 *
 * Pins the rule that flags PascalCase JSX elements with no in-scope binding.
 * Solid renders these as undefined components at runtime, which would silently
 * mount nothing instead of erroring at compile time.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Reference `<Missing />` without importing or defining `Missing`.
 */
import { createSignal } from "solid-js";

createSignal(0);

// expect: solid/jsx-no-undef error
const tree = <Missing />;

JSON.stringify({ tree });
