import type { ITtscTransformOptions } from "../structures";

import { runTransform } from "./internal/runTransform";

/** Transform one TypeScript source file and return emitted JavaScript. */
export function transform(options: ITtscTransformOptions): string {
  return runTransform(options);
}
