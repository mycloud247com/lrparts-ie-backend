import emailService from "./email.js";
import { INTENTS } from "./emailIntents.js";

/**
 * Send a notification by intent key.
 * Fire-and-forget — errors are logged, never thrown.
 *
 * Usage:
 *   notify("ORDER_CONFIRMED", { user, order, items });
 */
export function notify(intentKey, data) {
  const intentFn = INTENTS[intentKey];
  if (!intentFn) {
    console.error(`[Notifier] Unknown intent: ${intentKey}`);
    return;
  }

  try {
    const { to, subject, html } = intentFn(data);

    emailService.send(to, subject, html).catch((err) => {
      console.error(`[Notifier] Failed to send ${intentKey} to ${to}:`, err.message);
    });
  } catch (err) {
    console.error(`[Notifier] Error building ${intentKey}:`, err.message);
  }
}
