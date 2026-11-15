// -----------------------------------------------------------------------------
// The container's own timer.
//
// The ODL network publishes one value per probe and per hour, some 60 to 90
// minutes after the hour: reading every 20 minutes shows a new value at most
// 20 minutes late, and costs one small request (every followed probe at once).
// The devices are published with `should_poll: false` (20 minutes is not a
// polling frequency of Gladys): the container reads by itself. What is read:
// the followed probes whose device the user added to Gladys. The probe list
// is read again once a day.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'poller' });

/** The pace of the reads. */
export const PERIOD_MS = 20 * 60_000;

/** A probe read less than this ago is not read again (a device just added, a restart). */
const MIN_GAP_MS = 60_000;

/**
 * @param {object} options
 * @param {object} options.gladys
 * @param {import('./hub.js').Hub} options.hub
 * @param {() => Promise<void>} options.afterCycle publishes what the reads changed
 * @param {() => Promise<void>} [options.beforeCycle] the daily probe list
 * @param {boolean} [options.timers] run the periodic timer (tests may turn it off)
 * @param {() => number} [options.now]
 */
export function createPoller({
  gladys,
  hub,
  afterCycle = async () => {},
  beforeCycle = async () => {},
  timers = true,
  now = () => Date.now(),
}) {
  const lastReadAt = new Map();
  let running = Promise.resolve();
  let timer = null;
  let stopped = true;

  async function read(stations, force) {
    const due = stations.filter((s) => {
      const last = lastReadAt.get(s.id);
      return force || last === undefined || now() - last >= MIN_GAP_MS;
    });
    for (const station of due) {
      lastReadAt.set(station.id, now());
    }
    try {
      await hub.refresh(due);
    } catch (err) {
      // Logged once by the hub's issue log; the next cycle retries.
      logger.debug(`Read failed: ${err.message}`);
    }
  }

  /** One cycle: the followed probes added to Gladys (or the given ones). Cycles never overlap. */
  function cycle({ stations, force = true } = {}) {
    const run = running.then(async () => {
      if (gladys.connected === false) {
        logger.debug('Gladys unreachable: cycle skipped');
        return;
      }
      await beforeCycle();
      await read(stations ?? hub.followed.filter((s) => hub.isCreated(s)), force);
      await afterCycle();
    });
    running = run.catch(() => {});
    return run;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Reading cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, PERIOD_MS);
  }

  return {
    /** (Re)start: read now, then every PERIOD_MS. */
    async restart() {
      stopped = false;
      schedule();
      await cycle({ force: false });
    },
    cycle,
    /** Read some probes now unless read in the last minute. */
    async refreshNow(stations) {
      await cycle({ stations, force: false });
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
