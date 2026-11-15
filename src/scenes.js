// -----------------------------------------------------------------------------
// Scene action "Get the dose rate of a probe" (Gladys 5.1+).
//
// Gives a scene the last measurement of a probe as outputs a notification can
// quote: "{{...summary}}" reads "München-Neuhausen (ODL): 0,107 µSv/h
// (15/11 11:00), cosmique 0,049, terrestre 0,057. Mesure contrôlée.". The
// devices already give each value to the scene conditions; what this action
// adds is a ready-made sentence in the configured language.
//
// The triggers are fired by the hub (src/hub.js).
// -----------------------------------------------------------------------------

import { MESSAGES, TEXT } from './i18n.js';
import { isFresh, latest, stationStatus } from './dose.js';

export const GET_DOSE_RATE = 'get_dose_rate';

/**
 * @param {import('./hub.js').Hub} hub
 * @param {{ station?: string }} fields
 * @param {string} language
 */
export function getDoseRate(hub, fields, language) {
  const station = fields.station ? hub.stationByDevice(fields.station) : null;
  if (!station) {
    throw new Error(MESSAGES.thrown(TEXT.unknownStation));
  }
  const record = hub.records.get(station.id);
  const last = latest(record);
  if (!last) {
    throw new Error(MESSAGES.thrown(TEXT.noReading));
  }
  const now = hub.now();
  const fresh = isFresh(record, now);
  const values = {
    dose: fresh ? last.v : null,
    cosmic: fresh ? record.cosmic : null,
    terrestrial: fresh ? record.terrestrial : null,
  };
  const status = stationStatus(record, now);
  const outputs = {
    summary: MESSAGES.summary({ name: hub.nameOf(station), ...values, time: last.t, status })[
      language
    ],
    measured_at: new Date(last.t).toISOString(),
    status,
  };
  for (const [key, value] of [
    ['dose_rate', values.dose],
    ['cosmic', values.cosmic],
    ['terrestrial', values.terrestrial],
  ]) {
    if (value !== null) {
      outputs[key] = value;
    }
  }
  return outputs;
}
