import type { TtscTerminalGenerationError } from "../errors/TtscTerminalGenerationError";
import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";

/** Cache promises whose unchanged terminal verdict may be replayed. */
export const TERMINAL_TRANSFORM_GENERATIONS = new WeakMap<
  Promise<TtscCachedProjectTransform>,
  TtscTerminalGenerationError
>();
