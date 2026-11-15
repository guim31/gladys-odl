// -----------------------------------------------------------------------------
// What the measurements of a probe say: its state, and whether its dose rate
// stands above the alert threshold.
//
// Pure functions of a record and a clock: the hub, the widget and the scene
// action read the same answers.
//
// A record: the probe (src/api.js parseStation), its last 24 hours of 1-hour
// measurements { t (end of the hour, epoch ms), v (µSv/h), checked }, and the
// newest site status and cosmic / terrestrial parts read from the network.
//
// The BfS publishes a 1-hour value some 60 to 90 minutes after its hour: a
// probe whose last measurement ended more than 4 hours ago is "no recent
// measurement".
// -----------------------------------------------------------------------------

/** Past this age (after the end of its hour), the last measurement is not current any more. */
export const STALE_MS = 4 * 60 * 60 * 1000;

/** The window of the chart. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Site status of the network. */
export const SITE = { OPERATION: 1, DEFECTIVE: 2, TEST: 3 };

/**
 * Alert thresholds offered by the configuration, in µSv/h. 0.3 is the default:
 * natural levels in Germany sit between 0.05 and 0.18 µSv/h (0.11 median),
 * up to some 0.25 on a mountain, and rain can add up to 0.1 for a few hours.
 */
export const THRESHOLDS = ['0.2', '0.3', '0.5', '1'];
export const DEFAULT_THRESHOLD = '0.3';

/** A crossed threshold stays crossed until the dose rate falls this far below it (µSv/h). */
export const HYSTERESIS = 0.02;

export const STATUS = {
  CHECKED: 'checked',
  NOT_CHECKED: 'not_checked',
  TEST: 'test_operation',
  DEFECTIVE: 'defective',
  NO_RECENT: 'no_recent',
};

/** The newest measurement of a record, or null. */
export function latest(record) {
  const measures = record?.measures ?? [];
  return measures.length > 0 ? measures[measures.length - 1] : null;
}

/** True when the newest measurement is recent enough to be current, on a probe not defective. */
export function isFresh(record, now) {
  const last = latest(record);
  return Boolean(last) && now - last.t <= STALE_MS && record.siteStatus !== SITE.DEFECTIVE;
}

/** The state shown for a probe. */
export function stationStatus(record, now) {
  if (record?.siteStatus === SITE.DEFECTIVE) {
    return STATUS.DEFECTIVE;
  }
  if (!isFresh(record, now)) {
    return STATUS.NO_RECENT;
  }
  if (record.siteStatus === SITE.TEST) {
    return STATUS.TEST;
  }
  return latest(record).checked ? STATUS.CHECKED : STATUS.NOT_CHECKED;
}

/**
 * Whether the dose rate stands above the threshold, given the previous answer
 * (hysteresis on the way down). null when the probe cannot tell (stale,
 * defective, in test operation): the previous state holds.
 * @param {object} record
 * @param {number} now
 * @param {number} threshold µSv/h
 * @param {boolean | null} [previous]
 */
export function isAbove(record, now, threshold, previous = false) {
  if (!isFresh(record, now) || record.siteStatus !== SITE.OPERATION) {
    return null;
  }
  // In nSv/h, integers: 0.3 - 0.02 is 0.27999999999999997 in floating point.
  const nSv = (value) => Math.round(value * 1000);
  const v = nSv(latest(record).v);
  return previous === true ? v > nSv(threshold) - nSv(HYSTERESIS) : v >= nSv(threshold);
}

/** Keep the measurements of the last 24 hours before the newest one. */
export function trim(measures) {
  if (measures.length === 0) {
    return measures;
  }
  const newest = measures[measures.length - 1].t;
  return measures.filter((m) => m.t > newest - DAY_MS);
}

/**
 * Merge measurements into a sorted list (by time, one per time). A known time
 * is replaced: the BfS checks a measurement afterwards.
 * @returns {{ measures: Array, added: number, changed: number }}
 */
export function merge(measures, incoming) {
  const byTime = new Map(measures.map((m) => [m.t, m]));
  let added = 0;
  let changed = 0;
  for (const m of incoming) {
    const known = byTime.get(m.t);
    if (!known) {
      added += 1;
    } else if (known.v !== m.v || known.checked !== m.checked) {
      changed += 1;
    }
    byTime.set(m.t, m);
  }
  const sorted = [...byTime.values()].sort((a, b) => a.t - b.t);
  return { measures: trim(sorted), added, changed };
}
