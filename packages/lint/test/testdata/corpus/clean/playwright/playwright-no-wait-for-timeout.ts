// @ttsc-corpus-clean: playwright/no-wait-for-timeout
import { test } from "@playwright/test"; test("url", async ({ page }) => { await page.waitForURL("/done"); });
