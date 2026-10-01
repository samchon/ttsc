// @ttsc-corpus-clean: playwright/no-page-pause
import { test } from "@playwright/test"; test("navigate", async ({ page }) => { await page.goto("/"); });
