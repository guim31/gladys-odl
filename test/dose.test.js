import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITE, STATUS, STALE_MS, isAbove, merge, stationStatus } from '../src/dose.js';

const T = Date.parse('2026-11-15T10:00:00Z');
const H = 60 * 60_000;
const m = (hours, v, checked = true) => ({ t: T + hours * H, v, checked });
const rec = (measures, siteStatus = SITE.OPERATION) => ({ measures, siteStatus });

test('the state of a probe: checked, not checked, test, defective, no recent measurement', () => {
  assert.equal(stationStatus(rec([m(0, 0.1)]), T + STALE_MS), STATUS.CHECKED);
  assert.equal(stationStatus(rec([m(0, 0.1, false)]), T), STATUS.NOT_CHECKED);
  assert.equal(stationStatus(rec([m(0, 0.1)]), T + STALE_MS + 1), STATUS.NO_RECENT);
  assert.equal(stationStatus(rec([]), T), STATUS.NO_RECENT);
  assert.equal(stationStatus(rec([m(0, 0.1)], SITE.TEST), T), STATUS.TEST);
  assert.equal(stationStatus(rec([m(0, 0.1)], SITE.DEFECTIVE), T), STATUS.DEFECTIVE);
  assert.equal(stationStatus(rec([], SITE.DEFECTIVE), T), STATUS.DEFECTIVE);
});

test('above the threshold, with hysteresis on the way down', () => {
  const at = (v, previous, siteStatus) => isAbove(rec([m(0, v)], siteStatus), T, 0.3, previous);
  assert.equal(at(0.299, false), false);
  assert.equal(at(0.3, false), true);
  assert.equal(at(0.29, true), true, 'above 0.3 - 0.02 stays above');
  assert.equal(at(0.28, true), false);
  assert.equal(at(0.5, false, SITE.TEST), null, 'a probe in test operation tells nothing');
  assert.equal(at(0.5, false, SITE.DEFECTIVE), null);
  assert.equal(isAbove(rec([m(0, 0.5)]), T + STALE_MS + 1, 0.3, false), null);
});

test('merging keeps one measurement per hour, sorted, over 24 hours, and sees the checks', () => {
  const { measures, added, changed } = merge(
    [m(-25, 1), m(-1, 2, false)],
    [m(0, 3), m(-1, 2, true)],
  );
  assert.deepEqual(
    measures.map((x) => [x.v, x.checked]),
    [
      [2, true],
      [3, true],
    ],
  );
  assert.equal(added, 1);
  assert.equal(changed, 1);
});
