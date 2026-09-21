# jeeGlow

jeeGlow ajoute un second dashboard à Jeedom. Il ne remplace rien : le dashboard
d'origine, les vues et les designs restent en place et continuent de fonctionner.
jeeGlow relit vos objets, vos équipements et vos commandes, et en dessine une
présentation moderne, utilisable aussi bien sur un écran d'ordinateur que sur
une tablette murale ou un téléphone.

## Ouvrir le dashboard

Menu **Plugins → Autre → jeeGlow**, ou directement :

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe
```

## Ce que jeeGlow affiche

Pour chaque objet (une pièce, un étage), jeeGlow liste les équipements
**actifs et visibles** que vous avez le droit de voir, et choisit pour chacun une
carte d'après les **types génériques** de ses commandes :

| Carte | Reconnue à |
|---|---|
| Lumière | `LIGHT_STATE`, `LIGHT_ON`, `LIGHT_OFF`, `LIGHT_TOGGLE`, `LIGHT_SLIDER` |
| Volet | `FLAP_STATE`, `FLAP_UP`, `FLAP_DOWN`, `FLAP_STOP`, `FLAP_SLIDER` |
| Prise | `ENERGY_STATE`, `ENERGY_ON`, `ENERGY_OFF`, `ENERGY_SLIDER` |
| Capteur | aucune commande d'action visible : l'équipement ne fait que mesurer |
| Générique | tout le reste : les infos visibles, puis les actions visibles |

Un équipement qui répond à plusieurs cartes prend la première de la liste.

**Si une carte vous semble mal choisie**, la cause est presque toujours la même :
les commandes n'ont pas de type générique. Ouvrez l'équipement, onglet
*Commandes*, et renseignez la colonne *Type générique*. Le dashboard suit
immédiatement — c'est aussi ce qui améliore le reste de Jeedom, l'application
mobile et les assistants vocaux.

## Les cartes en pratique

- **Lumière et prise** : un appui n'importe où sur la carte bascule l'état. La
  carte entière se colore quand c'est allumé. Le curseur, s'il existe, n'envoie
  la valeur qu'au relâchement.
- **Volet** : monter, stop, descendre, et la position en pourcentage quand
  l'équipement la donne.
- **Capteur** : la première mesure en grand, les suivantes en dessous.
- **Générique** : les informations visibles, puis les actions sous forme de
  boutons, de listes ou de curseurs.

Les valeurs se mettent à jour **en temps réel**, sans rechargement : jeeGlow
écoute le même flux d'événements que le dashboard d'origine.

La liste des équipements, elle, est relue quand la page redevient visible après
plus de cinq minutes. Un équipement ajouté, renommé ou rangé dans une autre
pièce apparaît donc tout seul sur une tablette murale, sans qu'on ait à la
toucher.

Seules les commandes **visibles** apparaissent, plus celles dont la carte a
besoin. Pour retirer une information du dashboard, décochez *Afficher* sur la
commande ; pour la faire apparaître, cochez-la.

## Mode kiosque

Le bouton en haut à droite passe en plein écran : le menu et le pied de page de
Jeedom disparaissent, il ne reste que le dashboard. L'adresse suit, ce qui permet
de la mettre en favori ou en page de démarrage sur une tablette :

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe&fullscreen=1
```

Pour une tablette murale réellement verrouillée :

1. Créez un utilisateur dédié (**Réglages → Système → Utilisateurs**), profil
   **restreint**.
2. Donnez-lui le droit de lecture sur les seuls objets et équipements qu'il doit
   voir.
3. Dans son profil, choisissez **jeeGlow** comme page d'accueil.
4. Sur la tablette, ouvrez l'adresse ci-dessus avec `&fullscreen=1` et ajoutez-la
   à l'écran d'accueil.

L'utilisateur ne voit alors que ce dashboard, et seulement ses pièces.

## Choisir sa pièce

Les pastilles sous le titre filtrent par pièce. Le choix s'inscrit dans
l'adresse (`#room=5`), donc une tablette peut démarrer directement sur la
cuisine :

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe&fullscreen=1#room=5
```

La recherche, elle, traverse toutes les pièces.

## Réglages

**Plugins → Gestion des plugins → jeeGlow → Configuration** :

- **Titre affiché** : le nom en haut du dashboard.
- **Afficher les équipements sans objet** : les regroupe dans une pièce
  « Non classé ». Utile tant que le rangement n'est pas fait.

## Utilisateurs en lecture seule

Un utilisateur qui a le droit de **voir** un équipement sans celui de l'**agir**
ne reçoit aucun bouton, aucun curseur, aucune liste : la carte affiche l'état et
s'arrête là. Le cœur refuserait de toute façon l'exécution, mais un dashboard
couvert de commandes qui répondent par une alerte rouge n'aurait aucun sens.

## Ce que jeeGlow ne fait pas

- Il ne modifie **aucun** équipement, aucune commande, aucun réglage de Jeedom.
- Il respecte ce que vous avez déjà décidé : un objet masqué du dashboard reste
  masqué, un équipement désactivé ou invisible n'apparaît pas.
- Il ne réutilise pas les widgets natifs : les cartes sont les siennes. Un widget
  personnalisé installé sur une commande ne se retrouve donc pas ici.
