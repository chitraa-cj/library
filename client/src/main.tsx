import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { queryClient } from "./lib/queryClient";
import { hydrateFromPrerender } from "./lib/prerender-bootstrap";

// Adopt the server-rendered critical content before the first render, so the
// app never re-fetches the verse that is already on screen.
hydrateFromPrerender(queryClient);

createRoot(document.getElementById("root")!).render(<App />);
