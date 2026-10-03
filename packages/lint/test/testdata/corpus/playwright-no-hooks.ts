declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

// expect: playwright/no-hooks error
test.beforeEach(async () => {});
