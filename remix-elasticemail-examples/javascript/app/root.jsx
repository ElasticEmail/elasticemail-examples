import { Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import styles from "./styles.css?url";

export const links = () => [{ rel: "stylesheet", href: styles }];

export const meta = () => [
  { title: "Elastic Email Examples - Remix + JavaScript" },
  { name: "description", content: "Examples for sending and managing email with Elastic Email and Remix" },
];

const nav = [
  { to: "/send-email", label: "Send" },
  { to: "/attachments", label: "Attachments" },
  { to: "/templates", label: "Templates" },
  { to: "/scheduling", label: "Scheduling" },
  { to: "/contacts", label: "Contacts" },
  { to: "/domains", label: "Domains" },
  { to: "/statistics", label: "Statistics" },
  { to: "/webhooks", label: "Webhooks" },
  { to: "/inbound", label: "Inbound" },
  { to: "/double-optin", label: "Double opt-in" },
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <nav className="nav">
          <Link to="/" className="nav-brand">
            Elastic Email Examples
          </Link>
          <div className="nav-links">
            {nav.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
