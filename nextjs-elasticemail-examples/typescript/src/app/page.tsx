import Link from "next/link";

interface ExampleItem {
  title: string;
  description: string;
  href: string;
}

const examples: { category: string; items: ExampleItem[] }[] = [
  {
    category: "Sending Emails",
    items: [
      { title: "Basic Send", description: "Send a simple HTML email", href: "/send-email" },
      { title: "With Attachments", description: "Attach a base64-encoded file", href: "/attachments" },
      { title: "With CID Attachments", description: "Embed inline images using Content-ID", href: "/cid-attachments" },
      { title: "With Templates", description: "Send an Elastic Email template with merge fields", href: "/templates" },
      { title: "Scheduled Send", description: "Delay delivery with TimeOffset", href: "/scheduling" },
      { title: "Prevent Gmail Threading", description: "Unique X-Entity-Ref-ID per email", href: "/prevent-threading" },
    ],
  },
  {
    category: "Forms and Actions",
    items: [
      {
        title: "Contact Form",
        description: "Server Action sending a confirmation and a team notification",
        href: "/contact-form",
      },
    ],
  },
  {
    category: "Receiving Emails and Events",
    items: [
      { title: "Webhooks", description: "Receive Sent, Opened, Clicked, Error events", href: "/webhooks" },
      { title: "Inbound Emails", description: "Receive parsed emails through an inbound route", href: "/inbound" },
    ],
  },
  {
    category: "Subscription",
    items: [
      { title: "Double Opt-In", description: "Subscribe with email confirmation", href: "/double-optin" },
    ],
  },
  {
    category: "Management",
    items: [
      { title: "Contacts", description: "Add contacts to a list and list them", href: "/contacts" },
      { title: "Domains", description: "Add a domain and check DNS verification", href: "/domains" },
      { title: "Statistics", description: "Account-wide delivery and engagement counts", href: "/statistics" },
    ],
  },
];

export default function HomePage() {
  return (
    <main className="wide">
      <h1>Elastic Email Examples</h1>
      <p className="muted">
        Examples for sending and managing email with{" "}
        <a href="https://elasticemail.com" target="_blank" rel="noopener noreferrer">
          Elastic Email
        </a>{" "}
        and Next.js 15 (App Router).
      </p>

      <div className="card">
        <h3>Quick Setup</h3>
        <ol>
          <li>
            Copy <code>.env.example</code> to <code>.env</code>
          </li>
          <li>
            Add your API key from{" "}
            <a
              href="https://app.elasticemail.com/marketing/settings/new/manage-api"
              target="_blank"
              rel="noopener noreferrer"
            >
              app.elasticemail.com
            </a>{" "}
            and set <code>EMAIL_FROM</code> to a verified sender
          </li>
          <li>
            Run <code>npm run dev</code>
          </li>
        </ol>
      </div>

      {examples.map((section) => (
        <div key={section.category}>
          <h2 className="section-title">{section.category}</h2>
          <div className="grid">
            {section.items.map((item) => (
              <Link key={item.href} href={item.href}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <footer>
        <a href="https://github.com/ElasticEmail/elasticemail-examples" target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>{" "}
        &middot;{" "}
        <a href="https://elasticemail.com/developers" target="_blank" rel="noopener noreferrer">
          Elastic Email Developers
        </a>
      </footer>
    </main>
  );
}
