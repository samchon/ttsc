import { runTurbopackLoaderWithContext } from "./runTurbopackLoaderWithContext";

/**
 * Invoke the built turbopack loader entrypoint with a minimal fake of the
 * webpack loader context Turbopack provides (`async()`, `resourcePath`,
 * `getOptions()`), returning the content the loader hands to the callback.
 */
export async function runTurbopackLoader(props: {
  resourcePath: string;
  source: string;
  options?: unknown;
}): Promise<string> {
  return (await runTurbopackLoaderWithContext(props)).content;
}
