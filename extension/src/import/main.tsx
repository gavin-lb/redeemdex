import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ImportApp from "./ImportApp";

const root = document.getElementById("root");

if (!root) throw new Error("Import app root is missing.");

createRoot(root).render(
  <StrictMode>
    <ImportApp />
  </StrictMode>,
);
