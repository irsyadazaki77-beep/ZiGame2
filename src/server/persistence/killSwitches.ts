import { serverLogger } from '../logger';

export type KillSwitchFeature = 'ranked' | 'economy' | 'seasons';

const runtimeKillSwitches: Record<KillSwitchFeature, boolean> = {
  ranked: process.env.KILL_SWITCH_RANKED === 'true',
  economy: process.env.KILL_SWITCH_ECONOMY === 'true',
  seasons: process.env.KILL_SWITCH_SEASONS === 'true'
};

export function isKillSwitchActive(feature: KillSwitchFeature): boolean {
  return runtimeKillSwitches[feature] || false;
}

export function setKillSwitch(feature: KillSwitchFeature, active: boolean, adminUid?: string): { success: boolean; feature: KillSwitchFeature; active: boolean } {
  runtimeKillSwitches[feature] = active;
  serverLogger.security('KILL_SWITCH_TOGGLE', `Kill switch '${feature}' set to ${active}`, {
    feature,
    active,
    adminUid: adminUid || 'system'
  });
  return { success: true, feature, active };
}

export function getKillSwitches(): Record<KillSwitchFeature, boolean> {
  return { ...runtimeKillSwitches };
}
