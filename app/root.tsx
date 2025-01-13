import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';
import type { LinksFunction } from '@remix-run/node';
import { Analytics } from '@vercel/analytics/remix';
import { SpeedInsights } from '@vercel/speed-insights/remix';

import './tailwind.css';

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full overflow-hidden">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <style
          dangerouslySetInnerHTML={{
            __html: `
          html, body {
            overscroll-behavior: none;
            overflow: hidden;
            height: 100%;
          }
          #root {
            overflow: auto;
            height: 100%;
          }
        `,
          }}
        />
      </head>
      <body className="bg-background">
        <div id="root" className="bg-background">
          {children}
          <ScrollRestoration />
          <Scripts />
          <Analytics />
          <SpeedInsights />
        </div>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
