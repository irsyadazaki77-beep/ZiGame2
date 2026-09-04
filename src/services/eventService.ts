import { EVENT_CONFIG } from '../config/balanceConfig';
import { DynamicEvent } from '../types';

export const eventService = {
  getActiveEvents(): DynamicEvent[] {
    const now = Date.now();
    return EVENT_CONFIG.events.filter(evt => {
      const start = new Date(evt.startAt).getTime();
      const end = new Date(evt.endAt).getTime();
      return now >= start && now <= end;
    });
  },

  getMultipliersForGame(gameId: string): { xpMultiplier: number; coinMultiplier: number; activeEvent?: DynamicEvent } {
    const active = this.getActiveEvents();
    let xpMultiplier = 1.0;
    let coinMultiplier = 1.0;
    let matchingEvent: DynamicEvent | undefined;

    for (const evt of active) {
      if (evt.targetGames.includes('all') || evt.targetGames.includes(gameId)) {
        xpMultiplier = Math.max(xpMultiplier, evt.xpMultiplier);
        coinMultiplier = Math.max(coinMultiplier, evt.coinMultiplier);
        matchingEvent = evt;
      }
    }

    return {
      xpMultiplier,
      coinMultiplier,
      activeEvent: matchingEvent
    };
  }
};
