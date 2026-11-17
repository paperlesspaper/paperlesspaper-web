export type BatteryWarning = "low" | "empty";
export type BatteryChannels = { email: boolean; push: boolean };
export type BatteryPreferences = Record<BatteryWarning, BatteryChannels>;

// Preserve an explicitly saved preference from the first version for "low".
// The new no-contact warning always requires its own opt-in.
export function readBatteryPreference(value: any): BatteryPreferences {
  return {
    low: {
      email: (value?.low?.email ?? value?.email) === true,
      push: (value?.low?.push ?? value?.push) === true,
    },
    empty: {
      email: value?.empty?.email === true,
      push: value?.empty?.push === true,
    },
  };
}
