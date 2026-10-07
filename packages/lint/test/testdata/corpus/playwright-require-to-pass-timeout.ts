declare const test: any;
declare const expect: any;
declare const page: any;
import { test, expect } from "@playwright/test";

test("passes eventually", async () => {
  // expect: playwright/require-to-pass-timeout error
  await expect(async () => {}).toPass();
});
