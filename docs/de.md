# BfS ODL

## Was die Integration macht

Bringt die **Gamma-Ortsdosisleistung** in Gladys, die die Sonden des **ODL-Messnetzes** des Bundesamts für
Strahlenschutz (BfS) messen: rund 1.700 Sonden in ganz Deutschland, ein Wert pro Stunde. Die Integration liest die
offene Datenschnittstelle des BfS, dieselben Daten wie die Karte [ODL-Info](https://odlinfo.bfs.de), ohne Konto und
ohne Schlüssel.

Für jede verfolgte Sonde bekommst du die Ortsdosisleistung, ihren kosmischen und terrestrischen Anteil, Zeit und
Zustand der Messung, ein Dashboard-Widget mit der 24-Stunden-Kurve und Szenen-Auslöser, wenn die Dosisleistung eine
Alarmschwelle überschreitet.

**Diese Integration ist kein offizielles Warnsystem**: Folge im Notfall den Anweisungen der Behörden. Die natürlichen
Werte schwanken: Regen wäscht Radon-Folgeprodukte aus der Luft und kann für einige Stunden bis zu 0,1 µSv/h
hinzufügen. Die Integration ist nicht mit dem BfS verbunden. Daten: Bundesamt für Strahlenschutz (BfS), kostenlos,
Quelle genannt.

Dieselbe Integration für Frankreich: [Téléray](https://github.com/guim31/gladys-teleray) (Messnetz der ASNR).

## Voraussetzungen

- Gladys 5.3.0 oder neuer.
- Internetzugang von Gladys aus.
- Der Standort deines Hauses (Einstellungen → Häuser), um automatisch die nächste Sonde zu verfolgen.

## Konfiguration

1. Installiere die Integration: Integrationen → Von GitHub installieren, Adresse
   `https://github.com/guim31/gladys-odl`.
2. **Sonden**: Lass das Feld leer, um die Sonde zu verfolgen, die deinem Haus am nächsten ist, oder gib bis zu 5
   Sondenkennungen (9 Ziffern), Namen oder Postleitzahlen durch Kommas getrennt ein (z. B. `091620001, 80637,
Feldberg`). Eine Postleitzahl ergibt ihre am tiefsten gelegene Sonde in Betrieb. Zwei Buttons helfen: **Sonden um
   ein Haus finden** listet die nächsten mit Kennung und Entfernung auf, **Sonden suchen** die einer Postleitzahl
   (oder ihrer ersten Ziffern) oder deren Name einen Text enthält.
3. **Alarmschwelle**: die Dosisleistung, die den Auslöser „Dosisleistung über der Schwelle“ auslöst, standardmäßig
   0,3 µSv/h (siehe Szenen).
4. **Sprache**: Sprache der Funktionsnamen (beim Hinzufügen eines Geräts festgelegt) und der Texte.
5. Öffne den Tab **Erkennung** und füge die Sonde hinzu.

## Geräte

Ein Gerät pro Sonde, nach ihr benannt (z. B. `München-Neuhausen (ODL)`):

| Funktion                      | Was es ist                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Ortsdosisleistung (µSv/h)     | Gamma-Ortsdosisleistung der letzten Stunde, in Mikrosievert pro Stunde              |
| Kosmischer Anteil (µSv/h)     | der Anteil der kosmischen Strahlung, vom BfS geschätzt (er wächst mit der Höhe)     |
| Terrestrischer Anteil (µSv/h) | der Rest: Strahlung aus dem Boden und der Luft (Radon), der Anteil, der schwankt    |
| Messzeit                      | Ende der Messstunde (das BfS veröffentlicht sie 60 bis 90 Minuten später)           |
| Zustand der Sonde             | Messwert geprüft, Noch ungeprüft, Testbetrieb, Sonde defekt, Keine aktuelle Messung |

Gladys kennt keine Strahlungseinheit: Die Einheit steht im Funktionsnamen. Eine Messung, die älter als 4 Stunden ist,
wird nicht als aktuell veröffentlicht (der Zustand lautet dann „Keine aktuelle Messung“). Eine defekte Sonde
veröffentlicht keinen Wert.

## Widget

**ODL-Ortsdosisleistung**: die Dosisleistung und ihr kosmischer und terrestrischer Anteil als Kacheln (die
Dosisleistung wird an der Alarmschwelle rot), die Kurve der letzten 24 Stunden, dann Zeit, Zustand, Schwelle und
Quelle. Einstellungen: die Sonde (leer: die erste hinzugefügte) und zwei Schalter, um die Kurve oder die Zeilen darunter
auszublenden.

## Szenen

- Auslöser **Dosisleistung über der Schwelle**: Die stündliche Dosisleistung einer Sonde in Betrieb erreicht die
  Alarmschwelle der Konfiguration, geprüft oder noch nicht (lieber ein schneller als ein später Alarm). Einmal
  ausgelöst, beim Überschreiten; die Schwelle bleibt überschritten, bis die Dosisleistung 0,02 µSv/h darunter fällt.
  Nie beim ersten Blick auf eine Sonde und nie für eine Sonde im Testbetrieb. Variablen: Name der Sonde,
  Dosisleistung, Schwelle, Ende der Messstunde.
- Auslöser **Dosisleistung wieder normal**: Nach einer Überschreitung liegt die Dosisleistung wieder mehr als
  0,02 µSv/h unter der Schwelle.
- Aktion **Dosisleistung einer Sonde abrufen**: die letzten Werte und ein fertiger Satz (`summary`) für eine
  Benachrichtigung; `status` ist `checked`, `not_checked`, `test_operation`, `defective` oder `no_recent`.

Die Standardschwelle von **0,3 µSv/h** ist vorsichtig gewählt: Die natürlichen Werte liegen in Deutschland zwischen
0,05 und 0,18 µSv/h (Median etwa 0,11), auf Berggipfeln bis etwa 0,25 µSv/h, und ein starker Regen kann für einige
Stunden bis zu 0,1 µSv/h hinzufügen. 0,3 µSv/h wird also selten ohne echten Grund erreicht; 0,2 µSv/h löst an manchen
Sonden bei Regen aus. Die Geräte geben ihre Werte auch an die üblichen Szenen-Bedingungen weiter, für deine eigene
Schwelle.

## Szenen-Beispiele

- Benachrichtige mich, wenn die Dosisleistung hoch ist: Auslöser „Dosisleistung über der Schwelle“, dann
  „Dosisleistung einer Sonde abrufen“ und eine Benachrichtigung mit der Zusammenfassung.
- Ein wöchentlicher Bericht: eine geplante Szene, „Dosisleistung einer Sonde abrufen“, dann eine Nachricht mit der
  Zusammenfassung.

## Fehlerbehebung

- **„Keine Sonde“**: Lege den Standort eines Hauses fest (Einstellungen → Häuser) oder gib eine Sonde in der
  Konfiguration ein.
- **„Unbekannte Sonden“**: Kennung, Name oder Postleitzahl wurde nicht gefunden; nutze die Such-Buttons und kopiere
  die Kennung.
- **„Das BfS antwortet nicht“**: Die Messwerte werden alle 20 Minuten erneut gelesen.
- **„Keine aktuelle Messung“**: Die Sonde hat seit 4 Stunden nichts veröffentlicht (Wartung, Übertragung). Die Werte
  kommen mit ihrer nächsten Messung zurück.
- **„Sonde defekt“**: Das BfS meldet die Sonde als defekt; wähle bis zur Reparatur eine Nachbarsonde.

## Grenzen

- Ein Wert pro Stunde, 60 bis 90 Minuten nach seiner Stunde veröffentlicht: Die Integration liest alle 20 Minuten
  (eine Anfrage für alle verfolgten Sonden), die Sondenliste einmal am Tag.
- Höchstens 5 Sonden.
- Der kosmische und der terrestrische Anteil sind Schätzungen des BfS; manche Sonden liefern sie nicht.
- Safecast-Messungen sind nicht enthalten (eine mögliche Erweiterung).
- Die Funktionsnamen eines Geräts werden beim Hinzufügen festgelegt; eine spätere Sprachänderung benennt sie nicht um.
