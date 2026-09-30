import { TestExecutor } from "@ttsc/testing";
import path from "node:path";

TestExecutor.main({
  location: [
    path.join(process.cwd(), "src", "features"),
    path.join(process.cwd(), "src", "native-plugins"),
  ],
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
