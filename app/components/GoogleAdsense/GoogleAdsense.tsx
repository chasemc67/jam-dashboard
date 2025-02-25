import { useEffect } from 'react';

export function GoogleAdsense() {
  useEffect(() => {
    try {
      const script = document.createElement('script');
      script.src =
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5090338634220885';
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);

      return () => {
        // Cleanup if component unmounts
        document.body.removeChild(script);
      };
    } catch (error) {
      console.error('Error loading AdSense:', error);
    }
  }, []);

  return null;
}
