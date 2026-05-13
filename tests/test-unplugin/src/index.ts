import { TestExecutor } from "@ttsc/testing";
import path from "node:path";

TestExecutor.main({
  location: path.join(process.cwd(), "src", "features"),
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
