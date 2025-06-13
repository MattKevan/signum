'use client';

import { useUIStore } from '@/stores/uiStore';
import { useEffect } from 'react';

export function useInitialiseUIStore() {
  const initialize = useUIStore((state) => state.screen.initializeScreenSize);
  const isInitialized = useUIStore((state) => state.screen.isInitialized);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);
}   