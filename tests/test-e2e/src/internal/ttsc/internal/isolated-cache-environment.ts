import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

/** Give each fixture its own legacy home and external system temp directory. */
export function isolatedCacheEnvironment(root: string): NodeJS.ProcessEnv {
  const home = path.join(root, "clean-process-home");
  fs.mkdirSync(home, { recursive: true });
  let temporary = temporaries.get(root);
  if (temporary === undefined) {
    temporary = TestProject.tmpdir("ttsc-clean-process-temp-");
    temporaries.set(root, temporary);
  }
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
    GOCACHE: "",
  };
}

const temporaries = new Map<string, string>();
