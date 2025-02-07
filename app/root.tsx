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
import { ContextProviders } from './components/ContextProviders';

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
        <title>Jam Dashboard - Guitar Learning & Practice Tools</title>
        <meta
          name="description"
          content="Interactive guitar learning tools including ear training exercises, fretboard visualization, and chord explorer"
        />

        {/* Open Graph / Social Media */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://jamdashboard.com" />
        <meta
          property="og:title"
          content="Jam Dashboard - Guitar Learning & Practice Tools"
        />
        <meta
          property="og:description"
          content="Interactive guitar learning tools including ear training exercises, fretboard visualization, and chord explorer"
        />
        <meta
          property="og:image"
          content="https://jamdashboard.com/assets/og-image.png"
        />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://jamdashboard.com" />
        <meta
          name="twitter:title"
          content="Jam Dashboard - Guitar Learning & Practice Tools"
        />
        <meta
          name="twitter:description"
          content="Interactive guitar learning tools including fretboard visualization, chord explorer, and ear training exercises"
        />
        <meta
          name="twitter:image"
          content="https://jamdashboard.com/assets/og-image.png"
        />

        <Meta />
        <Links />
        <style
          // disable overscroll
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
          <ContextProviders>{children}</ContextProviders>
          <ScrollRestoration />
          {/* Silent audio element for iOS audio unblocking - not meant for user interaction */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio id="silent-audio" preload="auto" loop>
            <source src="/assets/silent.mp3" type="audio/mp3" />
          </audio>
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
