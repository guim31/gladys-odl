// -----------------------------------------------------------------------------
// The Gladys devices: one per followed ODL probe.
//
// External ids (forever, see CLAUDE.md):
//   device  : ext:<selector>:probe:<kenn>
//   feature : ext:<selector>:probe:<kenn>:<key>
// The kenn is the 9-digit id of the probe in the BfS network: it survives a
// renamed probe.
//
// Gladys has no radiation category and no µSv/h unit: the dose rates are
// `unknown/unknown` features with the unit in their name (three of them on a
// device, so the dashboard shows their names, not the generic label).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';
import { NAMES } from './i18n.js';

/** Feature keys, in display order. */
export const FEATURE_KEYS = ['dose_rate', 'cosmic', 'terrestrial', 'measured_at', 'status'];

// min/max are display bounds (Gladys never clamps a state). Natural levels
// sit between 0.05 and 0.25 µSv/h; 1 keeps a real rise on the scale.
const dose = { category: CATEGORIES.UNKNOWN, type: TYPES.UNKNOWN.UNKNOWN, min: 0, max: 1 };
const text = { category: CATEGORIES.TEXT, type: TYPES.TEXT.TEXT, min: 0, max: 0 };

const FEATURES = {
  dose_rate: { ...dose, keep_history: true },
  cosmic: { ...dose, keep_history: true },
  terrestrial: { ...dose, keep_history: true },
  // Texts: their history would only repeat what the dose rates already date.
  measured_at: { ...text, keep_history: false },
  status: { ...text, keep_history: false },
};

/**
 * The external ids of the device of a probe.
 * @param {object} gladys
 * @param {{ id: string }} station
 */
export function idsOf(gladys, station) {
  return gladys.externalIds('probe', station.id);
}

/** The device name: the name of the probe, and the network. */
export function deviceName(station) {
  return `${station.name} (ODL)`;
}

/**
 * The discovery payload of one probe.
 * @param {object} gladys
 * @param {object} station
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, station, language) {
  const names = NAMES[language] ?? NAMES.fr;
  const ids = idsOf(gladys, station);
  const params = [{ name: 'probe_id', value: station.id }];
  if (station.code) {
    params.push({ name: 'probe_code', value: station.code });
  }
  if (station.plz) {
    params.push({ name: 'postcode', value: station.plz });
  }
  return {
    name: deviceName(station),
    external_id: ids.device,
    model: 'BfS ODL',
    // The container reads the probes itself every 20 minutes (src/poller.js):
    // no core polling.
    should_poll: false,
    features: FEATURE_KEYS.map((key) => ({
      name: names[key],
      external_id: ids.feature(key),
      ...FEATURES[key],
      read_only: true,
      has_feedback: false,
    })),
    params,
  };
}
