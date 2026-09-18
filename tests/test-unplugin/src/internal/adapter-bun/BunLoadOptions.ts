/** Minimal shape of the options object passed to `onLoad` in the Bun plugin API. */
export type BunLoadOptions = {
  /** Path filter the adapter registers. */
  filter: RegExp;
};
