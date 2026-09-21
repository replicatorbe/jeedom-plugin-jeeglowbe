# jeeGlow

jeeGlow ajoute un second dashboard à Jeedom. Il ne remplace rien : le dashboard
d'origine, les vues et les designs restent en place et continuent de fonctionner.
jeeGlow relit vos objets, vos équipements et vos commandes, et en dessine une
présentation moderne, utilisable aussi bien sur un écran d'ordinateur que sur
une tablette murale ou un téléphone.

## Comment le dashboard est organisé

Un **rail** à gauche donne les vues, et des **sous-onglets** en haut découpent
la vue courante. Sur téléphone, le rail devient une barre en bas.

| Vue | Ce qu'elle montre |
|---|---|
| **Accueil** | L'état de la maison : quelques mesures en pastilles, puis une tuile par domaine avec ce qui est en marche |
| **Fonctions** | Le rangement par défaut : Lumières, Prises, Volets, Chauffage, Sécurité, Caméras, Multimédia, Appareils, Météo, Énergie, Capteurs, Information |
| **Pièces** | Vos objets Jeedom, plus « Non classé » |
| **Système** | Vos équipements par plugin — la vue du dépannage |

Le rangement par défaut est **la fonction, pas la pièce**, pour une raison
tenace : sur une installation ordinaire, la moitié des équipements
n'appartiennent à aucun objet. Un dashboard rangé par pièce y est vide de moitié
le premier jour. Les pièces restent une vue à part entière, qui devient la bonne
à mesure que vous rangez.

Le domaine d'un équipement est déduit des familles de types génériques du cœur.
Un équipement dont aucune commande n'est typée se range dans « Information ».

L'adresse porte la vue et l'onglet — `#view=functions&tab=light` — donc une
tablette peut démarrer exactement où vous voulez.

## Le panneau de détail

Une carte ne montre que l'essentiel : son état, ses commandes principales, et
jusqu'à trois mesures. **Un appui sur l'en-tête de la carte ouvre le détail**,
en panneau latéral sur ordinateur, en feuille par le bas sur tablette et
téléphone : toutes les informations, toutes les commandes, le widget du plugin.

Le corps de la carte, lui, agit : un appui allume, éteint, monte ou descend.
Deux gestes distincts, sans appui long — sur une tablette murale, un appui long
est une loterie.

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

## Quand un plugin a écrit son propre widget

Certains plugins ne se contentent pas d'une valeur : ils fournissent avec leur
commande un rendu qu'ils ont dessiné — les vignettes d'une alerte caméra, le
plan d'un robot, un bulletin météo complet, une liste de veille. **jeeGlow
affiche ce rendu-là**, à l'intérieur de sa carte, plutôt que la valeur brute.
Son auteur sait mieux que nous ce qu'il y a à montrer.

Ces widgets ne sont pas cousus dans la page — sur une installation ordinaire ils
pèsent plus de trois cents kilo-octets. Ils sont demandés en un seul appel une
fois la page dessinée, et en attendant, la valeur s'affiche sobrement. Si
l'appel échoue, elle y reste.

## Commandes qui renvoient une structure

Plusieurs plugins rangent tout un état dans une seule commande texte : une
prochaine collecte, l'état d'un onduleur, la dernière alerte d'une caméra. Sur
un dashboard, la valeur brute donne une accolade suivie de trois cents
caractères, et l'information se perd dans sa propre syntaxe.

Pour les commandes **sans** widget de plugin, jeeGlow reconnaît ces valeurs et
affiche à la place le champ le plus lisible,
souligné en pointillés. **Un appui dessus déplie le détail** : un champ par
ligne, les listes annoncées par leur nombre d'éléments, chacun résumé à son
tour. Un second appui referme.

Les horodatages y sont rendus en date — l'heure seule si c'est aujourd'hui, le
jour et l'heure sinon — plutôt qu'en nombre de secondes. Une commande numérique
sans unité dont la valeur ressemble à un horodatage bénéficie du même
traitement : un compteur d'énergie, lui, porte une unité et reste un nombre.

## Images

Une commande dont la valeur est l'adresse d'une image — la carte d'un robot, la
photo d'un portier, l'instantané d'une caméra — est affichée **comme une
image**, pas comme une adresse. Si le chargement échoue, la ligne de texte
reprend sa place plutôt que de laisser un trou.

## Ce qu'une carte ne montre pas d'emblée

Une carte affiche au plus six informations et huit commandes. Au-delà, elle
l'annonce : **« + 4 autres »**, d'un appui, dépliez le reste. Rien ne disparaît
en silence.

## Des noms lisibles

Les plugins nomment pour eux-mêmes : `OpenMQTTGateway 1629AC — OMG_ESP32_BLE_SALON`
dit le modèle, le numéro de série, et enfin ce qui vous intéresse. jeeGlow
raccourcit ces noms à l'affichage — le réglage **Noms courts**, actif par
défaut — en retirant les identifiants matériels et ce qui précède un tiret
entouré d'espaces.

Deux garde-fous : « Detection OUEST-NORD » n'est pas touché, parce que son tiret
n'est pas un séparateur ; et si le raccourcissement donne un résultat vide ou
d'une lettre, le nom d'origine est gardé. Mieux vaut un nom long qu'un nom faux.

Le nom dans Jeedom n'est jamais modifié, et le nom que vous donnez à la main
l'emporte toujours sur le raccourcissement.

## Donner vos propres noms

`Shelly 1 91E2EE — spotcuisinep` ne sera jamais beau sur un mur. Ouvrez le
détail d'un équipement et cliquez sur le crayon : le nom que vous donnez
s'affiche partout dans jeeGlow.

**Le nom de l'équipement dans Jeedom n'est pas touché.** Vos scénarios, votre
historique et les autres plugins s'appuient dessus ; le changer pour faire joli
sur un dashboard casserait ce qui en dépend. Le nom choisi vit dans la
configuration de jeeGlow. Effacez-le pour revenir au nom d'origine.

Renommer écrit dans la configuration du plugin : réservé aux administrateurs.

## Ranger une pièce sans quitter le dashboard

Le panneau de détail propose un sélecteur de **pièce** aux administrateurs. La
moitié d'une installation ordinaire n'appartient à aucun objet, et personne ne
va ouvrir la page d'un plugin pour corriger ça : la seule occasion de ranger est
celle où l'on a l'équipement sous les yeux.

L'écriture est directe, sans déclencher les traitements du plugin propriétaire :
changer de pièce est un attribut Jeedom, il n'y a aucune raison de faire tourner
le code d'un plugin de caméra pour ça.

## Courbes

Dans le panneau de détail, les commandes **historisées** sont tracées sur les
dernières 24 heures, deux courbes au maximum. C'est le moteur de graphiques de
Jeedom qui dessine : mêmes données, mêmes couleurs que partout ailleurs.

## Mode kiosque

Le bouton en haut à droite passe en plein écran : **le menu et la barre du haut
de Jeedom disparaissent**, ainsi que le pied de page. Il ne reste que le
dashboard.

Le mode est **retenu par l'appareil** : une tablette qui rouvre la page la
retrouve en kiosque, sans paramètre dans l'adresse et sans intervention. Un
ordinateur qui ouvre la même adresse, lui, garde son menu — le réglage est
propre au navigateur. Le même bouton en sort, et Jeedom retrouve son menu.

L'adresse fonctionne aussi, pour un favori ou une page de démarrage :

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe&fullscreen=1
```

L'heure et la date s'affichent en haut de l'accueil, dans la langue de Jeedom —
pas celle du navigateur, qui n'est pas forcément la vôtre sur une tablette.

En kiosque, jeeGlow demande aussi au navigateur de **garder l'écran allumé**.
Cette demande n'est possible qu'en contexte sécurisé : si vous ouvrez Jeedom en
HTTP par son adresse IP, elle n'existe pas et la tablette s'éteindra comme
avant. C'est une limite du navigateur, pas un réglage manquant.

Deux réglages accompagnent ce mode, dans la configuration du plugin, et ne
s'appliquent qu'à lui :

- **Retour à l'accueil après** *n* minutes d'inactivité. La tablette laissée sur
  une pièce revient d'elle-même à la vue d'ensemble. Un panneau de détail resté
  ouvert suspend ce retour : on ne referme pas la page de quelqu'un qui lit.
- **Atténuation de nuit** : un voile assombrit l'écran, de 0 à 70 %. Les heures
  de nuit sont celles que vous avez déjà données à Jeedom pour changer de thème.
  Une page web ne commande pas le rétroéclairage : c'est un voile, pas une
  baisse de luminosité.

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
