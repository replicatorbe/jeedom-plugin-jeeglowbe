# Changelog

## 0.2

Refonte de l'accueil, de la navigation et des cartes, et un dashboard dont on
règle ce qu'il montre.

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
- jeeGlow peut désormais **masquer ce qu'il affiche**, sans rien changer au
  dashboard d'origine : un élément dans une carte, une carte entière, tout un
  plugin ou toute une pièce. Un bouton de réglage dans la barre du haut, réservé
  aux administrateurs, pose ces décisions sur le dashboard lui-même.
- Trois états et non une case à cocher : « Comme Jeedom », « Toujours affiché »
  et « Masqué ». Rétablir efface la décision au lieu d'en enregistrer une autre,
  et ce qui est rétabli suit Jeedom de nouveau, y compris si la visibilité y
  change plus tard.
- Le widget écrit par un plugin peut être refusé commande par commande, sans
  masquer la commande : jeeGlow la redessine alors à sa façon. Un aspirateur
  dont toutes les commandes portent un rendu conçu pour le dashboard d'origine
  redevient une carte comme les autres.
- Le tri a lieu sur le serveur : ce qui est masqué ne parvient plus à la page,
  ne compte plus dans la limite de quatre cents équipements, et n'est plus
  signalé dans la vue Santé.
- La configuration du plugin compte les décisions en cours et propose « Tout
  rétablir » : un réglage dont on ne sait pas revenir est un réglage qu'on
  n'ose pas essayer.
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
- Chaque scène dit depuis quand elle n'a pas tourné : « il y a 2 h », « hier »,
  une date au-delà d'une semaine. Le relevé voyageait dans le modèle depuis la
  première version et n'était affiché nulle part. La mention passe à
  « à l'instant » dès l'appui, sans attendre la relecture du modèle.
- « Tout éteindre » coiffe aussi la page d'un domaine et celle d'une pièce. Il
  n'existait que sur « En ce moment » — or c'est en entrant dans « Lumières » ou
  dans « Salon » qu'on veut couper d'un geste. Pas sur l'aperçu, où les rangées
  sont écrêtées, ni dans la vue Santé, où une pile faible ne s'éteint pas ; et
  il s'efface dès qu'il ne reste qu'une seule chose allumée.
- L'icône de la carte « Dehors » suit le temps qu'il fait. Elle était un soleil
  voilé par construction, quelle qu'ait été la condition météo — et la condition
  était déjà lue, écrite en toutes lettres au bas de cette même carte. Un ciel
  dégagé devient une lune la nuit, et une condition non reconnue garde l'icône
  d'origine.
- **Tout l'accueil suit le temps réel.** Les cartes « Dehors » et
  « Intérieur », la mesure d'une tuile de domaine, la température d'une tuile de
  pièce ne sont pas des cartes : elles n'avaient aucun abonnement et restaient à
  la valeur du dessin de la page. Sur une tablette murale, qui n'est jamais
  rechargée et ne change jamais d'onglet, l'écran affichait la maison de tout à
  l'heure — ce qui retire à un dashboard connecté à peu près tout son intérêt.
- Les scènes suivent l'annonce que le cœur fait déjà : un scénario lancé depuis
  un autre écran, par un capteur ou par sa programmation montre son sablier ici,
  et sa ligne repasse à « à l'instant ». Ce qui est appris ainsi est écrit dans
  le modèle et non sur le seul bouton, sans quoi le premier redessin le
  perdrait.
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
