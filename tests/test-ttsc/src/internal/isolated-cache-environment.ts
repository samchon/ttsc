import fs from "node:fs";
import path from "node:path";

/** Keep a test process's default cache and legacy cleanup paths in its fixture. */
export function isolatedCacheEnvironment(root: string): NodeJS.ProcessEnv {
  const home = path.join(root, "clean-process-home");
  const temporary = path.join(home, "tmp");
  fs.mkdirSync(temporary, { recursive: true });
  return {
    HOME: home,
    USERPROFILE: home,
    LOCALAPPDATA: path.join(home, "AppData", "Local"),
    XDG_CACHE_HOME: path.join(home, "xdg"),
    TMPDIR: temporary,
    TEMP: temporary,
    TMP: temporary,
    TTSC_CACHE_DIR: "",
    TTSC_GO_CACHE_DIR: "",
  };
}
