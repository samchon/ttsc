// @ttsc-corpus-clean: playwright/no-force-option
import { test } from "@playwright/test"; test("normal", async ({ page }) => { await page.getByRole("button").click({ force: false }); });
