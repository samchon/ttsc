// @ttsc-corpus-clean: playwright/no-networkidle
import { test } from "@playwright/test"; test("load", async ({ page }) => { await page.goto("/", { waitUntil: "load" }); });
