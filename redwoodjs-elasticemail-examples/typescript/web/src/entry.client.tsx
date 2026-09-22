import { hydrateRoot, createRoot } from "react-dom/client";
import App from "./App";

const redwoodAppElement = document.getElementById("redwood-app");

if (!redwoodAppElement) {
  throw new Error("Could not find an element with ID 'redwood-app'. Check web/src/index.html.");
}

if (redwoodAppElement.children?.length > 0) {
  hydrateRoot(redwoodAppElement, <App />);
} else {
  createRoot(redwoodAppElement).render(<App />);
}
