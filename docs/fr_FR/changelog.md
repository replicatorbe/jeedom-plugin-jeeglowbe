# Changelog

## 0.2

Refonte de l'accueil, de la navigation et des cartes.

- L'Accueil devient la vue d'arrivée. C'est celle qui est faite pour le coup
  d'œil, et c'était la seule qu'on ne voyait jamais sans un clic.
- Nouvelle vue **Santé** : les équipements qui ne répondent plus, les mesures
  hors plage, les piles faibles et les équipements muets depuis deux jours,
  rassemblés en un endroit. Le rail porte une pastille avec leur nombre.
- L'accueil montre ce qui est réellement en marche, en vraies cartes qu'on peut
  éteindre sur place, avec un bouton « Tout éteindre » qui demande confirmation.
- Les pastilles de mesure nomment leur source et mènent à l'équipement : un
  nombre sans attribution n'est pas une information.
- Les pièces prennent l'icône et la couleur choisies dans Jeedom, et résument ce
  qui s'y passe. Les domaines deviennent une rangée de raccourcis.
- Les scénarios que vous avez le droit de lancer apparaissent en scènes.
- Trois nouvelles cartes, déduites comme les autres des types génériques du
  cœur : caméra, climat et multimédia. Elles retombaient jusqu'ici sur la carte
  générique, qui réduisait une caméra à trois lignes binaires.
- Sur une carte qui pilote quelque chose, toute la carte bascule et seule la
  pastille d'icône ouvre le détail. C'était l'inverse, et la bascule n'avait que
  la moitié de la cible.
- Pastille ronde quand on peut agir, carrée quand on ne peut que lire.
- Le sous-titre d'une carte indique la pièce, hors de la vue Pièces.
- Fanions sur l'en-tête : pile faible, et « ne répond plus ».
- L'état allumé n'est plus un aplat saturé mais une surface teintée : le
  sous-titre d'une carte allumée n'atteignait le rapport de contraste de 4,5:1
  sur aucune des sept catégories, et l'anneau de focus y disparaissait presque.
  La saturation se concentre sur la pastille et un liseré latéral.
- Le remplissage plein rouge est désormais réservé aux alarmes — fumée, fuite,
  sabotage, alarme. Une caméra qui détecte du mouvement se teinte en rouge, et
  non en ambre : elle réclame un regard, elle n'est pas « allumée ».
- Le kiosque n'est plus un mode mais une distance de lecture : un seul facteur
  agrandit toute la typographie et toutes les cibles.
- Chaque valeur qui change et chaque bascule d'état se signalent, et l'échec
  d'une commande se voit sur la carte fautive, plus seulement dans le bandeau
  de Jeedom.
- Les animations s'effacent si le système demande de les limiter.
- Le dashboard cesse de redessiner quand l'onglet passe en arrière-plan : les
  valeurs continuent d'être suivies, le dessin attend le réveil. Jeedom diffuse
  ses changements à tous les clients quelle que soit la vue, et c'est ce qui
  fait ramer les tablettes bon marché.
- La recherche porte aussi sur le nom de la pièce.
- Les réglages d'une carte occupent chacun une rangée pleine largeur.
- Documentation : l'adresse d'une pièce s'écrit `#view=rooms&tab=5` et non
  `#room=5`, et une carte montre trois informations et quatre commandes, non six
  et huit.

## 0.1

Première version.

- Dashboard alternatif, sans aucune modification du dashboard d'origine.
- Cartes déduites des types génériques : lumière, volet, prise, capteur, et une
  carte générique de repli pour tout le reste.
- Mise à jour en temps réel des valeurs.
- Filtre par pièce, recherche, mode plein écran pour tablette murale.
- Navigation par rail et sous-onglets : Accueil, Fonctions, Pièces, Système.
- Rangement par domaine plutôt que par pièce, et panneau de détail par équipement.
- Noms personnalisés par équipement, sans toucher à Jeedom.
- Courbes d'historique dans le panneau de détail.
- Noms raccourcis automatiquement à l'affichage, réglage « Noms courts ».
- Rangement d'un équipement dans une pièce depuis le panneau de détail.
- Horloge sur l'accueil et écran maintenu allumé en kiosque.
- Bouton « Kiosque » nommé dans le rail, et réglage « Démarrer en kiosque »
  pour ouvrir jeeGlow sans le menu de Jeedom sans rien cliquer.
- Mode kiosque retenu par l'appareil, retour à l'accueil après inactivité et
  atténuation de nuit.
- Thème clair ou sombre accordé automatiquement à celui de Jeedom.
- Les commandes qui renvoient une structure ne sont plus affichées telles
  quelles : la carte montre le champ le plus lisible, le détail se déplie d'un
  appui, et les horodatages sont rendus en date.
- Les valeurs qui désignent une image sont affichées comme des images.
- Le widget d'un plugin, quand il en a écrit un pour sa commande, est affiché
  tel quel dans la carte.
- Une carte annonce ce qu'elle ne montre pas : « + n autres ».
