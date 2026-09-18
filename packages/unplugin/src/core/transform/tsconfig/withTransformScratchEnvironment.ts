import { transformScratchEnvironment } from "./transformScratchEnvironment";

/** Scope parent-process temp consumers to the same owned scratch directory. */
export function withTransformScratchEnvironment<T>(
  scratchDirectory: string,
  callback: () => T,
): T {
  const environment = transformScratchEnvironment(scratchDirectory);
  const previous = {
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
  };
  process.env.TEMP = environment.TEMP;
  process.env.TMP = environment.TMP;
  process.env.TMPDIR = environment.TMPDIR;
  try {
    return callback();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}
