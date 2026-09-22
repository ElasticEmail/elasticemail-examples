import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Elastic Email Examples - Next.js + JavaScript",
  description: "Examples for sending and managing email with Elastic Email and Next.js",
};

const nav = [
  { href: "/send-email", label: "Send" },
  { href: "/attachments", label: "Attachments" },
  { href: "/templates", label: "Templates" },
  { href: "/scheduling", label: "Scheduling" },
  { href: "/contact-form", label: "Contact form" },
  { href: "/contacts", label: "Contacts" },
  { href: "/domains", label: "Domains" },
  { href: "/statistics", label: "Statistics" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/inbound", label: "Inbound" },
  { href: "/double-optin", label: "Double opt-in" },
];

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/" className="nav-brand">
            Elastic Email Examples
          </Link>
          <div className="nav-links">
            {nav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
))}
          </div>
        </nav>
        {children}
      </body>
    </html>
);
}
