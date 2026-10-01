declare const test: any;
declare const expect: any;
declare const page: any;
import { test, expect } from "@playwright/test";

test("checks length", async ({ page }) => {
  const collection = page.locator("li");
  // expect: playwright/prefer-to-have-length error
  expect(await collection.length()).toBe(2);
});
