import type { Bindings, FeedbackRow } from "./types";

/**
 * Notify the owner via Resend when new feedback arrives.
 * If RESEND_API_KEY is missing, skip email and log a warning.
 */
export async function notifyOwner(
  env: Bindings,
  row: FeedbackRow
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[feedback-wall] RESEND_API_KEY not set — skipping email notification"
    );
    return;
  }

  const to = env.NOTIFY_EMAIL;
  if (!to) {
    console.warn(
      "[feedback-wall] NOTIFY_EMAIL not set — skipping email notification"
    );
    return;
  }

  const preview =
    row.message.length > 200 ? `${row.message.slice(0, 200)}…` : row.message;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">New feedback on your wall</h2>
      <p style="margin: 0 0 8px;"><strong>From:</strong> ${escapeHtml(row.name)}</p>
      <p style="margin: 0 0 8px;"><strong>When:</strong> ${escapeHtml(row.created_at)}</p>
      ${
        row.image_key
          ? `<p style="margin: 0 0 8px;"><strong>Image:</strong> attached (key ${escapeHtml(row.image_key)})</p>`
          : ""
      }
      <blockquote style="margin: 16px 0; padding: 12px 16px; background: #f4f4f5; border-left: 4px solid #6366f1; border-radius: 4px;">
        ${escapeHtml(preview)}
      </blockquote>
      <p style="color: #71717a; font-size: 13px;">Sent by Feedback Wall</p>
    </div>
  `.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Resend requires a verified domain for custom from; onboarding uses this.
      from: "Feedback Wall <onboarding@resend.dev>",
      to: [to],
      subject: `New feedback from ${row.name}`,
      html,
      text: `New feedback from ${row.name}\n\n${row.message}\n\n(${row.created_at})`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(
      `[feedback-wall] Resend error ${res.status}: ${body.slice(0, 500)}`
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
