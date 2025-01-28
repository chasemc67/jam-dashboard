/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

import { RemixBrowser } from '@remix-run/react';
import { startTransition, StrictMode, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import posthog from 'posthog-js';

function PosthogInit() {
  useEffect(() => {
    posthog.init('phc_yb2fmLa3KE8pZQbZXysKt5AoVruBMGGaPHJhkQ36ymF', {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'always', // or 'always' to create profiles for anonymous users as well
      capture_pageleave: true,
      capture_pageview: true,
      autocapture: true,
      session_recording: {
        maskAllInputs: false,
        maskTextSelector: '[data-ph-mask]',
      },
    });

    if (
      window.location.hostname === 'localhost' ||
      process.env.NODE_ENV === 'development'
    ) {
      posthog.people.set({ opt_in_site_apps: true });
      // You can also add other properties to identify internal users
      posthog.people.set({ internal_user: true });
    }
  }, []);

  return null;
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
      <PosthogInit />
    </StrictMode>,
  );
});
