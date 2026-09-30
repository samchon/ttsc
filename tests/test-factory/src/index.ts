import { TestExecutor } from "../../utils/src/TestExecutor";
import path from "node:path";

TestExecutor.main({
  location: path.join(process.cwd(), "src", "unit"),
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
