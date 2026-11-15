# BfS ODL

## What it does

Brings into Gladys the **ambient gamma dose rate** measured by the probes of the **ODL network** of the German
Federal Office for Radiation Protection (Bundesamt für Strahlenschutz, BfS): about 1,700 probes across Germany, one
value per hour. The integration reads the open data service of the BfS, the same data as the
[ODL-Info](https://odlinfo.bfs.de) map, with no account and no key.

For each followed probe you get the dose rate, its cosmic and terrestrial parts, the time and state of the
measurement, a dashboard widget with the 24-hour curve, and scene triggers when the dose rate crosses an alert
threshold.

**This integration is not an official alert system**: in an emergency, follow the instructions of the authorities.
Natural levels vary: rain washes radon decay products to the ground and can add up to 0.1 µSv/h for a few hours. The
integration is not affiliated with the BfS. Data: Bundesamt für Strahlenschutz (BfS), free of charge, source cited.

Same integration for France: [Téléray](https://github.com/guim31/gladys-teleray) (ASNR network).

## Requirements

- Gladys 5.3.0 or later.
- Internet access from Gladys.
- The location of your house (Settings → Houses), to follow the closest probe automatically.

## Configuration

1. Install the integration: Integrations → Install from GitHub, address `https://github.com/guim31/gladys-odl`.
2. **Probes**: leave it empty to follow the probe closest to your house, or type up to 5 probe ids (9 digits),
   names or postcodes separated by commas (e.g. `091620001, 80637, Feldberg`). A postcode gives its lowest probe in
   operation. Two buttons help: **Find the probes near a house** lists the closest ones with their id and distance,
   **Search for probes** lists those of a postcode (or its first digits) or whose name holds a text.
3. **Alert threshold**: the dose rate that fires the "Dose rate above the threshold" trigger, 0.3 µSv/h by default
   (see Scenes).
4. **Language**: language of the feature names (set when a device is added) and of the texts.
5. Open the **Discovery** tab and add the probe.

## Devices

One device per probe, named after it (e.g. `München-Neuhausen (ODL)`):

| Feature                  | What it is                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Dose rate (µSv/h)        | ambient gamma dose rate of the last hour, in microsieverts per hour                             |
| Cosmic part (µSv/h)      | the share of cosmic radiation, estimated by the BfS (it grows with altitude)                    |
| Terrestrial part (µSv/h) | the rest: radiation from the ground and the air (radon), the part that varies                   |
| Measurement time         | end of the measurement hour (the BfS publishes it 60 to 90 minutes later)                       |
| Probe state              | Measurement checked, Not checked yet, Test operation, Probe out of order, No recent measurement |

Gladys has no radiation unit: the unit is in the feature names. A measurement older than 4 hours is not published as
current (the state then says "No recent measurement"). A probe out of order publishes no value.

## Widget

**ODL dose rate**: the dose rate and its cosmic and terrestrial parts as tiles (the dose rate turns red at the alert
threshold), the curve of the last 24 hours, and the time, state, threshold and source. Settings: the probe (empty: the
first one added), and two switches to hide the curve or the rows below it.

## Scenes

- Trigger **Dose rate above the threshold**: the hourly dose rate of a probe in operation reaches the alert threshold
  of the configuration, checked or not yet (a fast alert rather than a late one). Fired once when it is crossed; it
  stays crossed until the dose rate falls 0.02 µSv/h below it. Never on the first look at a probe, nor for a probe in
  test operation. Variables: probe name, dose rate, threshold, end of the measurement hour.
- Trigger **Dose rate back to normal**: after an exceedance, the dose rate is at least 0.02 µSv/h below the threshold
  again.
- Action **Get the dose rate of a probe**: the last values and a ready-made sentence (`summary`) for a notification;
  `status` is one of `checked`, `not_checked`, `test_operation`, `defective`, `no_recent`.

The default threshold, **0.3 µSv/h**, is a cautious one: natural levels in Germany sit between 0.05 and 0.18 µSv/h
(median about 0.11), up to some 0.25 µSv/h on a mountain top, and a heavy rain can add up to 0.1 µSv/h for a few
hours. 0.3 µSv/h is therefore rarely reached without a real cause; 0.2 µSv/h will fire on rain at some probes. The
devices also give their values to the usual scene conditions, for a threshold of your own.

## Scene examples

- Notify me when the dose rate is high: trigger "Dose rate above the threshold", then "Get the dose rate of a probe"
  and a notification with its summary.
- A weekly report: a scheduled scene, "Get the dose rate of a probe", then a message with the summary.

## Troubleshooting

- **"No probe"**: set the location of a house (Settings → Houses) or type a probe in the configuration.
- **"Unknown probes"**: the id, name or postcode was not found; use the search buttons and copy the id.
- **"The BfS does not answer"**: the measurements are read again every 20 minutes.
- **"No recent measurement"**: the probe has published nothing for 4 hours (maintenance, transmission). The values
  come back with its next measurement.
- **"Probe out of order"**: the BfS marks the probe defective; choose a neighbour until it is repaired.

## Limits

- One value per hour, published 60 to 90 minutes after its hour: the integration reads every 20 minutes (one request
  for all the followed probes), the probe list once a day.
- 5 probes at most.
- The cosmic and terrestrial parts are estimates of the BfS; some probes do not provide them.
- Safecast measurements are not included (a possible follow-up).
- A device's feature names are set when it is added; changing the language afterwards does not rename them.
