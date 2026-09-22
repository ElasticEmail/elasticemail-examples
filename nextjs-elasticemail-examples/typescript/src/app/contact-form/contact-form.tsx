"use client";

import { useActionState } from "react";
import { type ContactFormState, submitContactForm } from "./actions";

const initialState: ContactFormState = { success: false, error: null, messageIds: null };

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContactForm, initialState);

  return (
    <div>
      <form action={formAction} className="form">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required placeholder="Ann Example" />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required placeholder="you@yourdomain.com" />
          <p className="hint">A confirmation is sent to this address.</p>
        </div>

        <div className="field">
          <label htmlFor="message">Message</label>
          <textarea id="message" name="message" required rows={4} placeholder="How can we help you?" />
        </div>

        <button type="submit" disabled={isPending}>
          {isPending ? "Sending..." : "Send Message"}
        </button>
      </form>

      {state.success && (
        <div className="result result-success">
          <h3>Message Sent</h3>
          <p>Check your inbox for the confirmation. The team notification went to CONTACT_EMAIL.</p>
          {state.messageIds && <p className="small">Message IDs: {state.messageIds.join(", ")}</p>}
        </div>
      )}

      {state.error && (
        <div className="result result-error">
          <h3>Error</h3>
          <p>{state.error}</p>
        </div>
      )}
    </div>
  );
}
