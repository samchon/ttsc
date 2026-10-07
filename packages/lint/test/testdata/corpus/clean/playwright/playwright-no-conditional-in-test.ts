// @ttsc-corpus-clean: playwright/no-conditional-in-test
import { test } from "@playwright/test"; test("straight", async ({ page }) => { await page.click("button"); });
