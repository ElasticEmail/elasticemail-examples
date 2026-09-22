"use server";

import { apiError, contactEmail, emailsApi, from } from "@/lib/elasticemail";

const escape = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Two transactional sends: confirmation to the visitor, notification to CONTACT_EMAIL.
export async function submitContactForm(_prev, formData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return { success: false, error: "All fields are required", messageIds: null };
  }

  const safeName = escape(name);
  const safeMessage = escape(message).replace(/\n/g, "<br />");

  try {
    const [confirmation, notification] = await Promise.all([
      emailsApi.emailsTransactionalPost({
        Recipients: { To: [email] },
        Content: {
          From: from,
          Subject: "We received your message",
          Body: [
            {
              ContentType: "HTML",
              Content: `<h1>Thanks, ${safeName}</h1><p>We received your message and will get back to you soon.</p><blockquote>${safeMessage}</blockquote>`,
            },
],
        },
      }),
      emailsApi.emailsTransactionalPost({
        Recipients: { To: [contactEmail] },
        Content: {
          From: from,
          ReplyTo: email,
          Subject: `New contact form submission from ${name}`,
          Body: [
            {
              ContentType: "HTML",
              Content: `<h2>New message</h2><p><strong>From:</strong> ${safeName} &lt;${escape(email)}&gt;</p><p><strong>Submitted:</strong> ${new Date().toISOString()}</p><p>${safeMessage}</p>`,
            },
],
        },
      }),
]);

    return {
      success: true,
      error: null,
      messageIds: [confirmation.data.MessageID, notification.data.MessageID].filter((id) => !!id),
    };
  } catch (err) {
    return { success: false, error: apiError(err).message, messageIds: null };
  }
}
