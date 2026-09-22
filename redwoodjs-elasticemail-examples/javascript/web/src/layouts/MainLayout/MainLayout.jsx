import { Link } from "@redwoodjs/router";

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

const MainLayout = ({ children }) => {
  return (
    <>
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
      {children}
    </>
  );
};

export default MainLayout;
