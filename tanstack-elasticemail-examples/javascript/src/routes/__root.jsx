import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Elastic Email Examples - TanStack Start + TypeScript" },
      { name: "description", content: "Examples for sending and managing email with Elastic Email and TanStack Start" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

const nav = [
  {
    to: "/send-email",
    label: "Send",
  },
  {
    to: "/attachments",
    label: "Attachments",
  },
  {
    to: "/templates",
    label: "Templates",
  },
  {
    to: "/scheduling",
    label: "Scheduling",
  },
  {
    to: "/contacts",
    label: "Contacts",
  },
  {
    to: "/domains",
    label: "Domains",
  },
  {
    to: "/statistics",
    label: "Statistics",
  },
  {
    to: "/double-optin",
    label: "Double opt-in",
  },
  {
    to: "/webhooks",
    label: "Webhooks",
  },
  {
    to: "/inbound",
    label: "Inbound",
  },
];

function RootComponent() {
  return (
    <RootDocument>
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
    </RootDocument>
  );
}

function RootDocument({ children }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
