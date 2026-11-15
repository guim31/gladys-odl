import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseStations } from '../src/config.js';

test('defaults', () => {
  assert.deepEqual(normalizeConfig(), {
    stations: [],
    threshold: 0.3,
    language: DEFAULT_CONFIG.language,
  });
  assert.equal(normalizeConfig({ language: 'it' }).language, 'fr');
  assert.equal(normalizeConfig({ threshold: '0.5' }).threshold, 0.5);
  assert.equal(normalizeConfig({ threshold: '7' }).threshold, 0.3);
});

test('the typed probes: commas or semicolons, spaces kept inside a name, duplicates dropped', () => {
  assert.deepEqual(
    parseStations(' 091620001 , Garmisch-P. OT Zugspitze;091620001; feldberg ,FELDBERG,, '),
    ['091620001', 'Garmisch-P. OT Zugspitze', 'feldberg'],
  );
});
