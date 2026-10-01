declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

// expect: playwright/no-slowed-test error
test.slow();
