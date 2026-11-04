/**
 * Email delivery adapter. With RESEND_API_KEY set, mail is sent through Resend's
 * HTTP API. Without it (local development), the message is printed to the console
 * so links such as password resets and invitations can still be followed.
 * Swap this file to use another provider; nothing else depends on Resend.
 */
export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(env: Env, email: OutgoingEmail): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.info(`[email:dev] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text }),
  });
  if (!res.ok) {
    console.error(`[email] delivery failed with status ${res.status}`);
    throw new Error("Email could not be sent.");
  }
}
