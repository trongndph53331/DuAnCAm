import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./design-system";
import "./styles.css";
import "./design-system/tokens.css";
import "./design-system/legacy-migration.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider><App /></ThemeProvider>
  </StrictMode>,
);

