import { TestExecutor } from "../../utils/src/TestExecutor";
import path from "node:path";
import { closeIdentityBoundary } from "./internal/identityBoundary";
const base = path.join(process.cwd(), "src");
const dir = process.env.TTSC_TEST_DIR;
const dirs = process.env.TTSC_TEST_DIRS?.split(",").map((value) => value.trim()).filter(Boolean);

TestExecutor.main({ location: dirs?.length ? dirs.map((value) => path.join(base, value)) : dir ? path.join(base, dir) : path.join(base, "features") }).finally(closeIdentityBoundary).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
