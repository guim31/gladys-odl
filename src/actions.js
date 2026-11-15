// -----------------------------------------------------------------------------
// The buttons of the Configuration screen (manifest `actions`):
//
//   find_nearby : the probes closest to a house of Gladys (its location,
//                 `location: true` in the manifest), with their id and
//                 distance — to pick the ones to follow.
//   search      : the probes of a postcode (or its beginning) or whose name
//                 holds a text.
// -----------------------------------------------------------------------------

import { SITE } from './dose.js';
import { MESSAGES, TEXT } from './i18n.js';

export const ACTION = { FIND_NEARBY: 'find_nearby', SEARCH: 'search' };

/** A search lists this many probes (the message stays readable). */
const LISTED = 8;

const flagged = (s) => ({ ...s, defective: s.siteStatus === SITE.DEFECTIVE });

/** The probe list, or the error the user sees. */
async function networkOf(hub) {
  await hub.refreshNetwork();
  if (hub.network.list.length === 0) {
    throw new Error(MESSAGES.thrown(TEXT.apiUnreachable));
  }
  await hub.save();
}

/**
 * @param {object} gladys
 * @param {import('./hub.js').Hub} hub
 * @param {{ house?: string }} fields
 */
export async function findNearby(gladys, hub, fields) {
  const houses = (await gladys.getHouses()).filter(
    (house) => typeof house.latitude === 'number' && typeof house.longitude === 'number',
  );
  const house = fields.house ? houses.find((h) => h.selector === fields.house) : houses[0];
  if (!house) {
    throw new Error(MESSAGES.thrown(TEXT.noHouse));
  }
  await networkOf(hub);
  return MESSAGES.nearby({ house: house.name, stations: hub.nearest(house, LISTED) });
}

/**
 * @param {import('./hub.js').Hub} hub
 * @param {{ query?: string }} fields
 */
export async function search(hub, fields) {
  const query = String(fields.query ?? '')
    .trim()
    .slice(0, 60);
  if (query === '') {
    throw new Error(MESSAGES.thrown(TEXT.emptyQuery));
  }
  await networkOf(hub);
  const found = hub.search(query);
  return MESSAGES.found({
    query,
    stations: found.slice(0, LISTED).map(flagged),
    more: Math.max(0, found.length - LISTED),
  });
}
