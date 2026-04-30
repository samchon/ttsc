import type { ITtscBuildOptions } from "./ITtscBuildOptions";

export type ITtscCheckOptions = Omit<ITtscBuildOptions, "emit">;
