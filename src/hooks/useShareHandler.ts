import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';

interface ShareData {
  url: string | null;
  text: string | null;
}

export const useShareHandler = () => {
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const extractInstagramUrl = useCallback((data: ShareData): string | null => {
    // Check if URL is directly an Instagram link
    if (data.url) {
      const instagramPattern = /https?:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/[\w-]+/i;
      const match = data.url.match(instagramPattern);
      if (match) return match[0];
    }

    // Check if text contains an Instagram link
    if (data.text) {
      const instagramPattern = /https?:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/[\w-]+/gi;
      const match = data.text.match(instagramPattern);
      if (match) return match[0];
    }

    return null;
  }, []);

  const clearSharedUrl = useCallback(() => {
    setSharedUrl(null);
  }, []);

  useEffect(() => {
    const setupShareListener = async () => {
      if (Capacitor.isNativePlatform()) {
        // Handle deep links / app links when app is opened via share
        App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
          console.log('App opened with URL:', event.url);
          
          // Handle share intent URLs
          const instagramUrl = extractInstagramUrl({ url: event.url, text: null });
          if (instagramUrl) {
            setSharedUrl(instagramUrl);
          }
        });

        // Check if app was launched with shared content
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl?.url) {
          console.log('App launched with URL:', launchUrl.url);
          const instagramUrl = extractInstagramUrl({ url: launchUrl.url, text: null });
          if (instagramUrl) {
            setSharedUrl(instagramUrl);
          }
        }
      } else {
        // Web Share Target API - check URL params for shared content
        const urlParams = new URLSearchParams(window.location.search);
        const sharedText = urlParams.get('text') || urlParams.get('url');
        
        if (sharedText) {
          const instagramUrl = extractInstagramUrl({ url: sharedText, text: sharedText });
          if (instagramUrl) {
            setSharedUrl(instagramUrl);
            // Clean up URL params after extracting
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', cleanUrl);
          }
        }
      }

      setIsReady(true);
    };

    setupShareListener();

    return () => {
      if (Capacitor.isNativePlatform()) {
        App.removeAllListeners();
      }
    };
  }, [extractInstagramUrl]);

  return {
    sharedUrl,
    clearSharedUrl,
    isReady,
  };
};
