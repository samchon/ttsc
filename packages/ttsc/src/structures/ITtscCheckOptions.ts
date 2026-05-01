import type { ITtscBuildOptions } from "./ITtscBuildOptions";

/** Options accepted by `check()`: build options except the emit override. */
export type ITtscCheckOptions = Omit<ITtscBuildOptions, "emit">;
