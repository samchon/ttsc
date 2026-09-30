import { TestExecutor } from "@ttsc/testing";
import path from "node:path";

import { TestSourceUnits } from "../../utils/src/TestSourceUnits";

import { closeIdentityBoundary } from "./internal/identityBoundary";

const boundaries = [path.join(process.cwd(), "src", "features")];
if (process.env.TTSC_TEST_LAYER === "e2e" || TestSourceUnits.run(boundaries))
  TestExecutor.main({ location: boundaries })
    .finally(closeIdentityBoundary)
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
