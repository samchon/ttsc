// @ttsc-corpus-clean: playwright/prefer-locator
import { test } from "@playwright/test"; test("locator", async ({ page }) => { await page.getByRole("button").click(); });
