import fs from "node:fs";
import path from "node:path";

import { TestExecutor } from "../../utils/src/TestExecutor";

const features = path.join(process.cwd(), "src", "features");
const locations = fs
  .readdirSync(features, { withFileTypes: true })
  .filter((entry) => entry.isFile() || entry.isDirectory())
  .map((entry) => path.join(features, entry.name));

TestExecutor.main({ location: locations }).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
