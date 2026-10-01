declare const test: any;
declare const expect: any;
declare const page: any;
import { test, expect } from "@playwright/test";

test("expects", async () => {
  // expect: playwright/valid-expect error
  expect();
});
