import { useEffect, useState } from 'react';
import type { Analytics } from 'firebase/analytics';
import { getFirebaseAnalytics } from '../lib/firebase';

export function useFirebaseAnalytics() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    let isActive = true;

    getFirebaseAnalytics()
      .then((instance) => {
        if (isActive) {
          setAnalytics(instance);
        }
      })
      .catch(() => {
        if (isActive) {
          setAnalytics(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return analytics;
}
