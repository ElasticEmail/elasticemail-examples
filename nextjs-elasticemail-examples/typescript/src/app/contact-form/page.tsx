import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { ContactForm } from "./contact-form";

export default function ContactFormPage() {
  const exampleCode = `"use server";

import { contactEmail, emailsApi, from } from "@/lib/elasticemail";

export async function submitContactForm(_prev, formData: FormData) {
  const name = formData.get("name");
  const email = formData.get("email");
  const message = formData.get("message");

  await Promise.all([
    emailsApi.emailsTransactionalPost({
      Recipients: { To: [email] },
      Content: { From: from, Subject: "We received your message", Body: [...] },
    }),
    emailsApi.emailsTransactionalPost({
      Recipients: { To: [contactEmail] },
      Content: { From: from, ReplyTo: email, Subject: \`New contact form submission from \${name}\`, Body: [...] },
    }),
  ]);
}`;

  return (
    <main>
      <PageHeader
        title="Contact Form"
        description="Server Action that sends a confirmation to the visitor and a notification to CONTACT_EMAIL."
        sourcePath="src/app/contact-form/actions.ts"
      />

      <ContactForm />

      <h2>Code Example</h2>
      <CodeBlock code={exampleCode} title="src/app/contact-form/actions.ts" />
    </main>
  );
}
