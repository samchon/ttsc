/**
 * Verifies solid/prefer-classlist: `classnames`/`clsx` calls are rejected.
 *
 * Pins the rule that flags `class={clsx({ ... })}` patterns. Solid provides
 * the `classList` JSX prop, which toggles individual class names reactively
 * without re-rendering the whole class attribute string.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render a `<div>` whose `class` reads `clsx({ active })`.
 */
import { createSignal } from "solid-js";

declare const clsx: (input: Record<string, unknown>) => string;
const [enabled] = createSignal(true);

// expect: solid/prefer-classlist error
const tree = <div class={clsx({ active: enabled() })} />;

JSON.stringify({ tree });
