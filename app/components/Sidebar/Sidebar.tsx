import { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export const Sidebar = () => {
  useEffect(() => {
    try {
      // Push the ad only if adsbygoogle is defined
      if (window.adsbygoogle) {
        window.adsbygoogle.push({});
      }
    } catch (err) {
      console.error('Error loading ad:', err);
    }
  }, []);

  return (
    <div className="w-64 p-4 border-l border-border">
      {/* AdSense Ad Container */}
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-5090338634220885" // Your AdSense publisher ID
        data-ad-slot="YOUR-AD-SLOT-ID" // You'll replace this with your actual ad slot ID
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};
