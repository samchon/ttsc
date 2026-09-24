import path from "node:path";

/**
 * The absolute path of the module resolution input recorder
 * (`driver/resolutioninputs/recorder.cjs`), the one file that owns which inputs
 * a resolution read (samchon/ttsc#1501).
 *
 * The recorder lives beside the Go package that embeds it, so a Go plugin's
 * config loader and ttsc's own evaluators share it rather than copy it. The
 * package ships `driver`, so the path holds wherever ttsc is installed. An
 * evaluator that runs in a clean process of its own requires it by this path.
 */
export const RESOLUTION_INPUT_RECORDER_PATH: string = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "driver",
  "resolutioninputs",
  "recorder.cjs",
);
