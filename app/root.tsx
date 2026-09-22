import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { Toaster } from "./components/Toaster";
import { ThemeProvider } from "./components/ThemeSelector";
import { registerEventLogging, registerGlobalErrorCapture } from "./utils/eventLogging";
import { errorMessage, eventBus, publishError } from "./utils/events";

// Boot-time wiring: publishers publish once and the console mirrors every
// event from this single subscription. The global rejection capture mounts
// beside it as the last capture path — an async throw with no local catch
// escapes every handler catch and every error boundary, so only this
// window-level listener sees it (G2). Module scope so both are live before
// route loaders run (db.getAll can surface storage events at boot). Guarded
// for SSR — this module also evaluates on the server, where neither has a
// window to attach to.
if (typeof window !== "undefined") {
  registerEventLogging();
  registerGlobalErrorCapture();
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}

/**
 * Terminal error boundary (React Router framework mode): publishes the error
 * to the event bus and renders the fallback. Unlike a route boundary this one
 * never rethrows — there is no ancestor boundary to delegate to. The publish
 * defers with queueMicrotask (bus listeners such as Toaster call setState,
 * which is illegal inside another component's render) and rides publishError,
 * so a route boundary's already-published error wins the microtask race and
 * root adds nothing. Navigational 404s skip the publish: they are expected
 * outcomes, the fallback page is their capture, and a never-auto-dismissing
 * error toast per mistyped URL is noise. Routes with their own boundary
 * (invoices) capture their errors first; every other route relies on this
 * boundary for non-404 failures. Client-only publish: the server's bus has
 * no consumer, so SSR failures stay on the SSR error path.
 */
export function ErrorBoundary({ error: boundaryError }: Partial<Route.ErrorBoundaryProps> = {}) {
  const error = useRouteError() ?? boundaryError;
  // Neither delivery channel carried an error: nothing to capture — still
  // render the fallback below rather than a blank screen.
  if (typeof window !== "undefined" && error !== undefined && !(isRouteErrorResponse(error) && error.status === 404)) {
    queueMicrotask(() =>
      publishError(
        eventBus,
        {
          type: "app",
          message: isRouteErrorResponse(error) ? error.statusText || `HTTP ${error.status}` : errorMessage(error),
          context: { action: "route-error", boundary: "root" },
        },
        error
      )
    );
  }
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
