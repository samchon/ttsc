import { assertFailedNotificationsFallBackToCompleteValidation } from "../../internal/transform-project-cache";

/**
 * Verifies a watcher failing after generation falls back instead of evicting.
 *
 * Pins the asynchronous half of samchon/ttsc#1223. A watcher that errors once
 * the generation exists proves nothing about membership either way, so treating
 * it like a detected change discarded a still-provable generation and
 * re-compiled the whole project once per delivered module. Only a reported
 * membership event is evidence of staleness.
 *
 * 1. Deliver every module with healthy watchers so the narrow path is active.
 * 2. Fail every registered watcher, redeliver, and assert the same generation
 *    keeps serving with no extra compile.
 * 3. Edit a project source and assert invalidation still happens.
 */
export const test_transformttsc_failed_notifications_fall_back_to_complete_validation =
  async () => {
    await assertFailedNotificationsFallBackToCompleteValidation();
  };
