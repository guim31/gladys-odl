# BfS ODL

## Ce que fait l’intégration

Amène dans Gladys le **débit de dose gamma ambiant** mesuré par les sondes du **réseau ODL** de l’Office fédéral
allemand de radioprotection (Bundesamt für Strahlenschutz, BfS) : environ 1 700 sondes dans toute l’Allemagne, une
valeur par heure. L’intégration lit le service de données ouvertes du BfS, les mêmes données que la carte
[ODL-Info](https://odlinfo.bfs.de), sans compte ni clé.

Pour chaque sonde suivie : le débit de dose, ses parts cosmique et terrestre, l’heure et l’état de la mesure, un
widget de tableau de bord avec la courbe sur 24 heures, et des déclencheurs de scène quand le débit franchit un seuil
d’alerte.

**Cette intégration n’est pas un dispositif d’alerte officiel** : en cas d’urgence, suivez les consignes des
autorités. Les niveaux naturels varient : la pluie rabat au sol les descendants du radon et peut ajouter jusqu’à
0,1 µSv/h pendant quelques heures. L’intégration n’est pas affiliée au BfS. Données : Bundesamt für Strahlenschutz
(BfS), gratuites, source citée.

La même intégration pour la France : [Téléray](https://github.com/guim31/gladys-teleray) (réseau de l’ASNR).

## Prérequis

- Gladys 5.3.0 ou plus récent.
- Un accès à Internet depuis Gladys.
- La position de votre maison (Paramètres → Maisons), pour suivre automatiquement la sonde la plus proche.

## Configuration

1. Installez l’intégration : Intégrations → Installer depuis GitHub, adresse `https://github.com/guim31/gladys-odl`.
2. **Sondes** : laissez vide pour suivre la sonde la plus proche de votre maison, ou saisissez jusqu’à 5
   identifiants de sonde (9 chiffres), noms ou codes postaux séparés par des virgules (ex. `091620001, 80637,
Feldberg`). Un code postal donne sa sonde en service la plus basse. Deux boutons aident : **Trouver les sondes
   autour d’une maison** liste les plus proches avec leur identifiant et leur distance, **Chercher des sondes** liste
   celles d’un code postal (ou de ses premiers chiffres) ou dont le nom contient un texte.
3. **Seuil d’alerte** : le débit qui déclenche « Débit de dose au-dessus du seuil », 0,3 µSv/h par défaut (voir
   Scènes).
4. **Langue** : langue des noms de fonctionnalités (fixés à l’ajout d’un appareil) et des textes.
5. Ouvrez l’onglet **Découverte** et ajoutez la sonde.

## Appareils

Un appareil par sonde, à son nom (ex. `München-Neuhausen (ODL)`) :

| Fonctionnalité         | Ce que c’est                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| Débit de dose (µSv/h)  | débit de dose gamma ambiant de la dernière heure, en microsieverts par heure                     |
| Part cosmique (µSv/h)  | la part du rayonnement cosmique, estimée par le BfS (elle croît avec l’altitude)                 |
| Part terrestre (µSv/h) | le reste : rayonnement du sol et de l’air (radon), la part qui varie                             |
| Heure de la mesure     | fin de l’heure de mesure (le BfS la publie 60 à 90 minutes plus tard)                            |
| État de la sonde       | Mesure contrôlée, Pas encore contrôlée, Sonde en test, Sonde hors service, Pas de mesure récente |

Gladys n’a pas d’unité de rayonnement : l’unité est dans le nom des fonctionnalités. Une mesure de plus de 4 heures
n’est pas publiée comme actuelle (l’état indique alors « Pas de mesure récente »). Une sonde hors service ne publie
aucune valeur.

## Widget

**Débit de dose ODL** : le débit et ses parts cosmique et terrestre en tuiles (le débit passe au rouge au seuil
d’alerte), la courbe des 24 dernières heures, puis l’heure, l’état, le seuil et la source. Réglages : la sonde (vide :
la première ajoutée), et deux interrupteurs pour masquer la courbe ou les lignes en dessous.

## Scènes

- Déclencheur **Débit de dose au-dessus du seuil** : le débit horaire d’une sonde en service atteint le seuil
  d’alerte de la configuration, contrôlé ou pas encore (mieux vaut une alerte rapide qu’une alerte tardive).
  Déclenché une fois, au franchissement ; le seuil reste franchi tant que le débit ne repasse pas 0,02 µSv/h en
  dessous. Jamais au premier regard sur une sonde, ni pour une sonde en test. Variables : nom de la sonde, débit,
  seuil, fin de l’heure de mesure.
- Déclencheur **Débit de dose revenu à la normale** : après un dépassement, le débit est de nouveau à au moins
  0,02 µSv/h sous le seuil.
- Action **Obtenir le débit de dose d’une sonde** : les dernières valeurs et une phrase toute faite (`summary`) pour
  une notification ; `status` vaut `checked`, `not_checked`, `test_operation`, `defective` ou `no_recent`.

Le seuil par défaut, **0,3 µSv/h**, est prudent : en Allemagne, les niveaux naturels se situent entre 0,05 et
0,18 µSv/h (médiane d’environ 0,11), jusqu’à 0,25 µSv/h environ en haut d’une montagne, et une forte pluie peut
ajouter jusqu’à 0,1 µSv/h pendant quelques heures. 0,3 µSv/h n’est donc que rarement atteint sans cause réelle ;
0,2 µSv/h se déclenchera sous la pluie sur certaines sondes. Les appareils donnent aussi leurs valeurs aux conditions
de scène habituelles, pour un seuil à vous.

## Exemples de scènes

- Me prévenir quand le débit est élevé : déclencheur « Débit de dose au-dessus du seuil », puis « Obtenir le débit
  de dose d’une sonde » et une notification avec son résumé.
- Un relevé hebdomadaire : une scène planifiée, « Obtenir le débit de dose d’une sonde », puis un message avec le
  résumé.

## Dépannage

- **« Aucune sonde »** : renseignez la position d’une maison (Paramètres → Maisons) ou saisissez une sonde dans la
  configuration.
- **« Sondes inconnues »** : l’identifiant, le nom ou le code postal est introuvable ; utilisez les boutons de
  recherche et copiez l’identifiant.
- **« Le BfS ne répond pas »** : les mesures sont relues toutes les 20 minutes.
- **« Pas de mesure récente »** : la sonde n’a rien publié depuis 4 heures (maintenance, transmission). Les valeurs
  reviennent avec sa mesure suivante.
- **« Sonde hors service »** : le BfS signale la sonde défectueuse ; choisissez une voisine en attendant sa
  réparation.

## Limites

- Une valeur par heure, publiée 60 à 90 minutes après son heure : l’intégration lit toutes les 20 minutes (une
  requête pour toutes les sondes suivies), et la liste des sondes une fois par jour.
- 5 sondes au plus.
- Les parts cosmique et terrestre sont des estimations du BfS ; certaines sondes ne les fournissent pas.
- Les mesures Safecast ne sont pas incluses (suite possible).
- Les noms des fonctionnalités sont fixés à l’ajout de l’appareil ; changer la langue ensuite ne les renomme pas.
