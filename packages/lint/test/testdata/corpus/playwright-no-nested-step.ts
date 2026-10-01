declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test("steps", async () => {
  await test.step("outer", async () => {
    // expect: playwright/no-nested-step error
    await test.step("inner", async () => {});
  });
});
