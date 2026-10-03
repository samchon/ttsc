declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test("uses title", async ({ page }) => {
  // expect: playwright/no-get-by-title error
  page.getByTitle("Settings");
});
