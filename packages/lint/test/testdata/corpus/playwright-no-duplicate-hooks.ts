declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test.beforeEach(async () => {});

// expect: playwright/no-duplicate-hooks error
test.beforeEach(async () => {});
