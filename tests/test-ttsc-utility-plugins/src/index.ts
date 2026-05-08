import { TestExecutor } from "@ttsc/testing";

TestExecutor.main({
  location: import.meta.dirname + "/features",
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
