/** Shape the runtime preload forwards to `Bun.plugin`. */
export interface CapturedPlugin {
  name: string;
  setup: (build: unknown) => unknown;
}
