/**
 * Minimal shape of a Bun load handler: receives a path and returns transformed
 * contents plus the loader Bun should apply next.
 */
export type BunLoader = (args: {
  path: string;
}) => Promise<{ contents: string; loader: string } | undefined>;
