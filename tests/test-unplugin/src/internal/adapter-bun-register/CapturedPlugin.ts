/** Shape the runtime preload forwards to `Bun.plugin`. */
export interface CapturedPlugin {
  /** Plugin name Bun reports. */
  name: string;
  /** Setup hook Bun calls with its builder. */
  setup: (build: unknown) => unknown;
}
