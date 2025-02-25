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
import { GoogleAdsense } from './components/GoogleAdsense/GoogleAdsense';

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
  { rel: 'canonical', href: 'https://jamdashboard.com' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full overflow-hidden">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Google AdSense Verification */}
        <meta name="google-adsense-account" content="ca-pub-5090338634220885" />

        {/* Primary Meta Tags */}
        <title>
          Jam Dashboard - Guitar Learning Tools | Fretboard, Chords & Ear
          Training
        </title>
        <meta
          name="description"
          content="Free interactive guitar learning tools for all skill levels. Master the fretboard, explore chord voicings, practice CAGED shapes, and improve your ear with our training games."
        />
        <meta
          name="keywords"
          content="guitar learning, fretboard visualizer, guitar chord library, CAGED system, ear training for guitar, chord voicings, guitar practice tools, music theory for guitar"
        />
        <meta name="author" content="Jam Dashboard" />
        <meta name="robots" content="index, follow" />

        {/* Open Graph / Social Media */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://jamdashboard.com" />
        <meta property="og:site_name" content="Jam Dashboard" />
        <meta
          property="og:title"
          content="Jam Dashboard - Interactive Guitar Learning & Practice Tools"
        />
        <meta
          property="og:description"
          content="Free tools to master guitar: visualize scales on the fretboard, explore chord voicings, learn CAGED shapes, and train your ear with interactive exercises."
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
          content="Master guitar with our fretboard visualizer, chord library, CAGED system viewer, and ear training games. Free interactive tools for all skill levels."
        />
        <meta
          name="twitter:image"
          content="https://jamdashboard.com/assets/og-image.png"
        />

        {/* Structured data for rich results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Jam Dashboard',
              url: 'https://jamdashboard.com',
              description:
                'Free interactive guitar learning tools for all skill levels. Master the fretboard, explore chord voicings, practice CAGED shapes, and improve your ear with our training games.',
              applicationCategory: 'EducationalApplication, MusicApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
              },
              isAccessibleForFree: true,
              author: {
                '@type': 'Organization',
                name: 'Jam Dashboard',
              },
            }),
          }}
        />

        {/* Google Ads Tag */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-16895491550"
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-16895491550');
            `,
          }}
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
          <GoogleAdsense />
        </div>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
