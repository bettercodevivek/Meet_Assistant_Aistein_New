'use client';

import { useEffect } from 'react';

/**
 * Periodically hits GET /api/v1/batch-calling so the server merges Python batch
 * status and runs post-call automations without requiring the user to stay on
 * Batch Calling. Idempotent and safe to call often.
 */
export function BatchAutomationBackgroundSync() {
  useEffect(() => {
    const tick = () => {
      void fetch('/api/v1/batch-calling?includeCancelled=true').catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 12000);
    return () => window.clearInterval(id);
  }, []);
  return null;
}
