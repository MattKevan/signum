// src/features/editor/components/HomepageSwitch.tsx
'use client';

import { useAppStore } from '@/core/state/useAppStore';
import { Label } from '@/core/components/ui/label';
import { Switch } from '@/core/components/ui/switch';
import { toast } from 'sonner';
import { useState } from 'react';

interface HomepageSwitchProps {
  siteId: string;
  pagePath: string;
  isHomepage: boolean;
}

export default function HomepageSwitch({ siteId, pagePath, isHomepage }: HomepageSwitchProps) {
  const { setHomepageAction } = useAppStore.getState();
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckedChange = async (isChecked: boolean) => {
    if (!isChecked) {
      // It's not possible for the user to "uncheck" this switch.
      // Another page must be selected to become the homepage.
      toast.info("To change the homepage, set it on another page.");
      return;
    }
    
    setIsLoading(true);
    try {
      await setHomepageAction(siteId, pagePath);
    } catch (error) {
      console.error("Failed to set homepage:", error);
      toast.error("An error occurred while setting the homepage.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
      <div className="space-y-0.5">
        <Label htmlFor="homepage-switch" className="text-base">
          Set as Homepage
        </Label>
        <p className="text-sm text-muted-foreground">
          Make this the first page visitors see.
        </p>
      </div>
      <Switch
        id="homepage-switch"
        checked={isHomepage}
        onCheckedChange={handleCheckedChange}
        disabled={isLoading || isHomepage}
        aria-readonly
      />
    </div>
  );
}