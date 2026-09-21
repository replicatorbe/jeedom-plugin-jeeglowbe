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
| **Accueil** | L'état de la maison : l'heure, quelques mesures, ce qui est en marche, vos scènes, vos pièces |
| **Fonctions** | Le rangement par domaine : Lumières, Prises, Volets, Chauffage, Sécurité, Caméras, Multimédia, Appareils, Météo, Énergie, Capteurs, Information |
| **Pièces** | Vos objets Jeedom, plus « Non classé » |
| **Santé** | Ce qui réclame une intervention |
| **Système** | Vos équipements par plugin — la vue du dépannage |

On arrive sur **l'Accueil**. C'est la vue faite pour le coup d'œil, et c'était
pourtant la seule qu'on ne voyait jamais sans un clic — alors que c'est déjà
celle vers laquelle une tablette revient d'elle-même quand plus personne ne la
regarde.

Le rangement des équipements, lui, part de **la fonction et non de la pièce**,
pour une raison tenace : sur une installation ordinaire, la moitié des
équipements n'appartiennent à aucun objet. Un dashboard rangé par pièce y est
vide de moitié le premier jour. Les pièces restent une vue à part entière, qui
devient la bonne à mesure que vous rangez.

Le domaine d'un équipement est déduit des familles de types génériques du cœur.
Un équipement dont aucune commande n'est typée se range dans « Information ».

L'adresse porte la vue et l'onglet. `#view=functions&tab=light` ouvre les
lumières, `#view=rooms&tab=5` la pièce numéro 5, `#view=health&tab=all` la liste
de ce qui ne va pas. `tab=all` montre la vue entière. Une tablette peut donc
démarrer exactement où vous voulez :

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe&fullscreen=1#view=rooms&tab=5
```

## Ouvrir le dashboard

Menu **Plugins → Autre → jeeGlow**, ou directement :

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe
```

## L'accueil

L'accueil ne montre pas des équipements : il répond à la question qu'on se pose
en entrant dans une pièce. Dans l'ordre, du haut vers le bas :

**L'heure et la date**, dans la langue de Jeedom — pas celle du navigateur, qui
n'est pas forcément la vôtre sur une tablette. Rien à calculer, mais c'est ce
qui distingue un écran mural d'une page web laissée ouverte.

**Quelques mesures en pastilles** : la consommation, la température intérieure,
celle du dehors, l'humidité, quand votre installation les mesure. Chaque
pastille **nomme sa source** et mène à l'équipement qui l'a dite : « 21,4 °C »
relevé on ne sait où n'est la température de personne. Un capteur dédié passe
devant la sonde interne d'un autre appareil, qui mesure surtout la chaleur de
son propre boîtier.

Quand votre installation rapporte la condition météo, l'icône de la carte
« Dehors » **suit le temps qu'il fait** — pluie, neige, orage, brouillard, ciel
couvert — et devient une lune la nuit pour un ciel dégagé. Une condition qu'elle
ne reconnaît pas laisse l'icône d'origine : se tromper de temps serait pire que
de ne pas en changer.

**Un bandeau « points à surveiller »**, s'il y a lieu, qui compte les ennuis et
mène à la vue Santé.

**« En ce moment »** : les cartes de ce qui est réellement en marche, huit au
plus, puis une tuile « + n » qui bascule vers la vue Fonctions. Ce sont de
vraies cartes, qu'on peut éteindre sur place — une tuile de domaine ne répondait
que par un nombre qu'il fallait aller vérifier ailleurs. Dès que plusieurs de
ces équipements savent s'éteindre, un bouton **« Tout éteindre »** apparaît dans
le titre de la rangée. Il demande confirmation, et il espace les commandes de
120 millisecondes : quinze exécutions simultanées font tomber certains démons de
plugin.

Le même bouton coiffe la page d'un domaine et celle d'une pièce : entrez dans
« Lumières » ou dans « Salon » et vous pouvez tout couper d'un geste. Il
n'apparaît pas sur l'aperçu, où les rangées sont écrêtées — un bouton qui
éteindrait vingt-huit équipements sous une rangée qui en montre six promettrait
autre chose que ce qu'il fait — ni dans la vue Santé, où une pile faible ne
s'éteint pas. Il s'efface de lui-même dès qu'il ne reste plus qu'une seule chose
allumée dans la rangée : celle-là s'éteint sur sa carte.

**Les scènes**, quand vous avez des scénarios. Ne sont proposés que ceux qui
sont actifs, visibles, et que vous avez le droit de lancer. Chaque scène indique
**depuis quand elle n'a pas tourné** — « il y a 2 h », « hier », une date
au-delà d'une semaine — à côté de son groupe : c'est la question qu'on se pose
la main au-dessus du bouton, et un scénario jamais lancé ne dit simplement rien.
La mention passe à « à l'instant » dès l'appui. Un scénario en cours le dit
aussi, parce qu'un scénario long — fermer douze volets — ne donne sinon aucun
signe entre l'appui et la fin. Le journal du scénario enregistre un lancement
manuel, à votre nom, comme s'il partait du cœur.

**Les pièces**, une tuile chacune, avec **l'icône et la couleur que vous avez
déjà choisies dans Jeedom** : les ignorer pour coller la même porte ouverte sur
le garage, le jardin et la cuisine, c'était jeter un travail déjà fait. Chaque
tuile résume sa pièce — le nombre d'équipements en marche, et une température
quand la pièce en mesure une.

**Les domaines**, enfin, réduits à une rangée de raccourcis compacts. Ce sont
des portes, pas des informations : ils n'avaient pas à occuper une rangée de
grandes tuiles au-dessus des pièces.

## La vue Santé

Une pile morte, un équipement qui ne répond plus, un seuil franchi : le
dashboard d'origine ne le dit nulle part, et il fallait jusqu'ici parcourir
quatre cents tuiles à l'œil pour l'apprendre. La vue Santé les rassemble, et le
rail porte une pastille avec leur nombre — une alerte qu'il faut aller chercher
dans une vue n'alerte personne.

Quatre sections, dans cet ordre :

- **Ne répondent plus** : le `timeout` que le cœur pose lui-même quand un
  équipement dépasse le délai que vous lui avez donné.
- **Hors plage** : les alertes `warning` et `danger`, posées par le cœur sur les
  seuils que vous avez réglés sur vos commandes.
- **Piles faibles** : 25 % ou moins.
- **Muets depuis deux jours** : plus aucune valeur datée depuis 48 heures.

Aucun seuil n'est inventé, sauf celui de la pile : les trois autres sont ceux de
Jeedom, tels que vous les avez réglés. Le niveau de pile est lu dans le statut
que le cœur tient, et à défaut sur une commande de type générique `BATTERY` :
beaucoup de plugins ne renseignent jamais le premier alors qu'ils remontent bel
et bien leur niveau.

Un équipement qui ne répond plus est rangé là et nulle part ailleurs. Une pile
qu'on ne peut plus lire n'est pas un second problème, c'est le même.

## Ce que jeeGlow affiche

Pour chaque objet (une pièce, un étage), jeeGlow liste les équipements
**actifs et visibles** que vous avez le droit de voir, et choisit pour chacun une
carte d'après les **types génériques** de ses commandes :

| Carte | Reconnue à |
|---|---|
| Lumière | `LIGHT_STATE`, `LIGHT_ON`, `LIGHT_OFF`, `LIGHT_TOGGLE`, `LIGHT_SLIDER`, `LIGHT_BRIGHTNESS` |
| Volet | `FLAP_STATE`, `FLAP_UP`, `FLAP_DOWN`, `FLAP_STOP`, `FLAP_SLIDER`, et leurs équivalents BSO |
| Prise | `ENERGY_STATE`, `ENERGY_ON`, `ENERGY_OFF`, `ENERGY_SLIDER` |
| Caméra | le domaine caméra, ou `CAMERA_TAKE` et `CAMERA_URL` |
| Climat | `THERMOSTAT_TEMPERATURE`, `THERMOSTAT_SETPOINT`, `THERMOSTAT_SET_SETPOINT`, `THERMOSTAT_MODE`, `THERMOSTAT_STATE` |
| Multimédia | `MEDIA_STATE`, `MEDIA_STATUS`, `MEDIA_TITLE`, `MEDIA_PAUSE`, `MEDIA_RESUME` |
| Capteur | aucune commande d'action visible : l'équipement ne fait que mesurer |
| Générique | tout le reste : les infos visibles, puis les actions visibles |

Les trois premières lignes décident en premier, parce qu'elles décrivent ce qui
se pilote : une lampe sur prise commandée est d'abord une lampe. Caméra, climat
et multimédia ne sont examinés que si rien de pilotable n'a été reconnu — ces
trois familles n'ont aucun rôle au sens des trois premières, et elles
retombaient toutes sur la carte générique, qui réduisait dix-huit caméras à
« Perte vidéo — » suivi de trois lignes binaires.

**Si une carte vous semble mal choisie**, la cause est presque toujours la même :
les commandes n'ont pas de type générique. Ouvrez l'équipement, onglet
*Commandes*, et renseignez la colonne *Type générique*. Le dashboard suit
immédiatement — c'est aussi ce qui améliore le reste de Jeedom, l'application
mobile et les assistants vocaux.

Au-delà de quatre cents équipements, la liste est tronquée et la page le dit :
ce n'est plus un dashboard mais un inventaire, et chaque équipement se paie en
lectures côté serveur.

## Agir, ou ouvrir le détail

Une carte ne montre que l'essentiel. Le reste — toutes les informations, toutes
les commandes, le widget du plugin, les courbes — vit dans un **panneau de
détail**, latéral sur ordinateur, en feuille par le bas sur tablette et
téléphone.

Deux gestes, jamais un appui long : sur une tablette murale, un appui long est
une loterie.

- **Sur une carte qui pilote quelque chose**, toute la carte agit, et **seule la
  pastille d'icône ouvre le détail**. C'était l'inverse : l'en-tête entier
  ouvrait le détail, et la bascule ne disposait que du bas de la carte, soit la
  moitié de la cible perdue sur une tuile courte.
- **Sur une carte qui ne pilote rien** — un capteur, une carte d'information —
  il n'y a pas de conflit : l'en-tête entier ouvre le détail.

La forme de la pastille le dit sans qu'on ait à essayer : **ronde quand on peut
agir, carrée quand on ne peut que lire**. Jusqu'ici, un variateur sans commande
d'allumage était visuellement identique à une lampe pilotable et ne répondait à
rien.

Hors de la vue Pièces, le sous-titre d'une carte indique **la pièce** : en vue
Fonctions, « Plafonnier » et « Plafonnier » sont deux cartes identiques, et rien
n'indiquait laquelle était la cuisine. En vue Pièces, la section porte déjà le
nom : le répéter serait du bruit.

Deux fanions peuvent apparaître à droite du nom : **pile faible**, avec son
pourcentage, et **« ne répond plus »**. Ils tiennent chacun sur leur ligne,
parce qu'un équipement peut très bien être muet *et* en pile faible.

## Les cartes en pratique

**Lumière et prise** : un appui n'importe où sur la carte bascule l'état. Si
l'équipement ne dit pas dans quel état il se trouve, la carte donne deux boutons
explicites, *Allumer* et *Éteindre*, plutôt qu'une bascule qui se tromperait une
fois sur deux.

**Volet** : monter, stop, descendre, et la position en pourcentage quand
l'équipement la donne. Un volet ne se bascule pas d'un appui — monter et
descendre sont deux gestes — mais il se pilote : sa pastille ouvre donc le
détail, comme sur une lampe, et ses trois flèches gardent toute la largeur.

**Climat** : la température mesurée en grand, la consigne à côté, le mode en
sous-titre, et deux boutons qui règlent la consigne par pas de **un demi**
dans l'unité de la commande — un demi-degré sur un thermostat en Celsius.
Ouvrir un panneau pour gagner un demi-degré est le geste qu'on ne fait jamais.
Les deux boutons n'apparaissent que si l'équipement expose une commande de
consigne, et ils ne partent que si la consigne actuelle est connue : ils y
ajoutent un demi-degré, ils ne l'inventent pas.

**Caméra** : le dernier événement en toutes lettres, une pastille
**« Mouvement »** tant qu'une détection est vraie, et un bouton *Capturer* quand
l'équipement sait prendre un instantané. L'instantané ou le rendu du plugin, s'il
y en a un, passe avant tout le reste : une image vaut mieux que n'importe quelle
phrase. Le détail du diagnostic — perte vidéo, véhicule détecté, dix lignes
binaires — reste dans le panneau.

**Multimédia** : le titre et l'artiste sur une ligne, l'état en sous-titre, et
les boutons de transport que l'équipement expose — précédent, pause, lecture,
suivant.

**Capteur** : la première mesure en grand, les suivantes en dessous.

**Générique** : les informations visibles, puis les actions sous forme de
boutons, de listes, de curseurs ou d'un sélecteur de couleur.

Sur toutes les cartes, **les réglages occupent chacun une rangée pleine
largeur** : un curseur qui partage sa ligne avec deux boutons devient
intouchable au doigt, et un petit bouton logé dans un coin de tuile mange la
cible principale sans rien apporter. Un curseur n'envoie sa valeur qu'au
relâchement.

## Ce qu'une carte ne montre pas d'emblée

Une carte affiche au plus **trois informations et quatre commandes**. Au-delà,
elle l'annonce : **« + 4 · détail »**, d'un appui le panneau s'ouvre sur le
reste. Rien ne disparaît en silence.

Une image et le widget d'un plugin ne comptent pas dans ce quota : ce sont les
éléments les plus parlants d'une carte, et les reléguer au panneau derrière
trois nombres serait exactement l'inverse de ce qu'on cherche.

## Ce qui se voit bouger

Les valeurs se mettent à jour **en temps réel**, sans rechargement : jeeGlow
écoute le même flux d'événements que le dashboard d'origine. Cela vaut pour les
cartes, mais aussi pour **tout ce qui résume l'accueil** : les cartes « Dehors »
et « Intérieur », la mesure d'une tuile de domaine, la température d'une tuile
de pièce, le nombre de choses en marche. Aucune de ces tuiles n'est une carte,
et aucune ne suivait rien : elles restaient à la valeur qu'elles avaient au
dessin de la page, c'est-à-dire, sur une tablette murale qu'on ne recharge
jamais, à celle du matin.

Les **scènes** suivent aussi. Un scénario lancé depuis un autre écran, par un
capteur ou par sa programmation montre son sablier ici, et sa ligne repasse à
« à l'instant » — jeeGlow écoute l'annonce que le cœur fait déjà à tous ses
clients, au lieu d'attendre la relecture du quart d'heure.

Et comme un
dashboard temps réel qui remplace un texte sans un pixel de signal oblige à
relire l'écran entier pour savoir ce qui vient de bouger :

- **une valeur qui change clignote** — jamais au premier affichage, sans quoi
  tout serait marqué neuf en même temps au chargement ;
- **une bascule d'état se signale sur toute la carte** : c'est le changement
  qu'on cherche des yeux depuis l'autre bout de la pièce ;
- **une commande en cours d'envoi le montre**, et l'attente dure ce que dure
  l'aller-retour, pas une durée décidée d'avance — une commande Zigbee de trois
  secondes affichait un dashboard immobile, et une commande instantanée gardait
  une carte grisée bien après coup ;
- **un échec se voit sur la carte fautive**, cerclée de rouge quelques secondes,
  et plus seulement dans le bandeau de Jeedom : sur un mur, ce bandeau est à un
  mètre de ce qui a raté.

Si votre système est réglé pour **limiter les animations**, jeeGlow s'y conforme
et n'anime plus rien. Pour qui souffre de troubles vestibulaires, ce mouvement
est un malaise, pas une élégance.

**Quand l'onglet passe en arrière-plan, jeeGlow cesse de redessiner.** Les
valeurs continuent d'être suivies, le dessin attend le réveil et tout est repeint
d'un coup. Jeedom diffuse ses changements à tous les clients, quelle que soit la
vue affichée : une tablette murale reçoit les cent mises à jour par seconde
d'une installation active même écran éteint, et repeindre alors est du travail
pur perdu — c'est précisément ce qui fait ramer les dalles bon marché.

La liste des équipements, elle, est relue quand la page redevient visible après
plus de cinq minutes. Un équipement ajouté, renommé ou rangé dans une autre
pièce apparaît donc tout seul sur une tablette murale, sans qu'on ait à la
toucher.

Seules les commandes **visibles** apparaissent, plus celles dont la carte a
besoin. Pour retirer une information du dashboard, décochez *Afficher* sur la
commande ; pour la faire apparaître, cochez-la.

## Les couleurs, et ce qu'elles veulent dire

Un équipement en marche porte une **surface teintée** : le fond bouge assez pour
se repérer d'un bout à l'autre de la pièce, la saturation pleine se concentre
sur la pastille d'icône et sur un liseré latéral, et le texte garde son encre.

Ce n'était pas le cas avant, et le motif est mesurable : sur l'aplat saturé, le
sous-titre d'une carte allumée n'atteignait pas le rapport de contraste de
4,5:1 exigé par le niveau AA, sur aucune des sept catégories, et l'anneau de
focus au clavier y devenait presque invisible. Une teinte posée en surface
laisse l'encre tranquille, et les sept catégories redeviennent lisibles d'office
au lieu qu'il faille choisir sept encres.

La teinte est celle de la **catégorie** que vous avez cochée sur l'équipement —
lumière, chauffage, ouvrant, sécurité, énergie, multimédia, automatisme. Sans
catégorie, c'est l'ambre.

**Le remplissage plein rouge est réservé aux alarmes** : fumée, gaz, monoxyde,
inondation, fuite d'eau, sabotage, alarme déclenchée. C'est le seul endroit de
la page où une carte entière se remplit, et c'est ce qui lui donne sa force —
une couleur saturée ne garde son pouvoir d'alerte que si elle est rare.

**Une caméra qui détecte du mouvement se teinte en rouge**, et non en ambre :
elle n'est pas « allumée », elle réclame un regard. Sans aller jusqu'au
remplissage plein, qui reste aux alarmes véritables.

Le thème suit celui de Jeedom, clair ou sombre. jeeGlow ne lit pas un nom de
thème — il mesure la luminosité du fond, ce qui fonctionne aussi avec un thème
qu'il ne connaît pas.

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

## Masquer ce qu'on ne veut pas voir

Une installation qui a vécu porte des équipements qui n'ont rien à faire sur un
mur : la passerelle qui ne sert qu'à ses propres capteurs, le plugin d'essai
qu'on n'a jamais désinstallé, les quatre sondes d'un onduleur. Les masquer dans
Jeedom les masquerait partout, y compris là où ils servent. jeeGlow décide donc
pour lui seul : **le dashboard d'origine n'est pas touché** et continue
d'afficher tout ce que Jeedom lui donne.

Chaque chose réglable a trois positions, et non une case à cocher :

- **Comme Jeedom**, l'état par défaut, celui de tout ce à quoi on n'a jamais
  touché. Ce n'est pas « affiché » : c'est l'absence de décision. jeeGlow suit
  alors la visibilité que Jeedom connaît, aujourd'hui et après tout changement
  qu'on y fera plus tard.
- **Toujours affiché** : jeeGlow le montre même si Jeedom le masque.
- **Masqué** : jeeGlow ne le montre pas, quoi que Jeedom en dise.

Rétablir, c'est donc revenir à « Comme Jeedom » et non enregistrer « affiché » :
cesser de décider plutôt que décider l'inverse. Il n'y a ainsi aucun état
d'origine à deviner, et ce qui est rétabli suit Jeedom de nouveau, y compris si
la visibilité y change des mois après.

Cinq portées, de la plus précise à la plus large : un **élément** dans une
carte, une **carte** entière, **tout un plugin** — tous les aspirateurs, toutes
les sondes d'un même type — et **toute une pièce**. La cinquième ne masque rien :
elle **refuse le widget écrit par le plugin** pour une commande, que jeeGlow
redessine alors à sa façon. Un aspirateur dont les dix-neuf commandes portent
chacune un rendu conçu pour le dashboard d'origine redevient ainsi une carte
comme les autres, sans rien perdre au passage.

Les décisions se lisent du plus précis au plus général : l'équipement d'abord,
son plugin ensuite, Jeedom en dernier. C'est ce qui permet de dire « tous les
aspirateurs sauf celui-là » : le plugin masque, l'équipement rattrape. La pièce,
elle, tranche avant tout le monde — un équipement rangé dans une pièce masquée
ne se rattrape pas équipement par équipement, c'est la pièce qu'on rétablit.

**Le mode réglage.** Un bouton en forme de curseurs apparaît dans la barre du
haut, pour les administrateurs seulement. Il fait relire au serveur un modèle
qui porte aussi ce qui est masqué, sans quoi un masquage serait sans retour : ce
qui disparaît du dashboard disparaît aussi de l'interface capable de le faire
revenir. Y entrer depuis l'Accueil bascule vers les Fonctions — l'Accueil dit
l'état de la maison, il ne montre pas des cartes à régler.

Dans ce mode, **une carte ne pilote plus : elle se règle**. Un appui n'allume
plus la lampe, il ouvre les réglages de la carte — et c'est par là que passe le
masquage élément par élément. Sans cela, la seule porte vers les éléments était
la petite pastille d'icône dans un coin, et une carte de lumière s'allumait
quand on croyait l'ouvrir. Chaque carte porte par ailleurs un œil en haut à
droite, et une flèche de retour dès qu'une décision a été prise sur elle. Les cartes masquées restent
dessinées, estompées et en pointillé : on ne règle bien que ce qu'on voit. La
vue Système donne un œil par plugin, la vue Pièces un œil par pièce. Les
domaines et les résultats de recherche n'en ont pas : ils se recoupent, et
masquer « Lumières » ne voudrait rien dire pour une lampe qui est aussi une
prise.

L'Accueil et la vue Santé, eux, ne montrent jamais ce qui est masqué, même dans
ce mode : on n'y règle rien, et ils doivent dire ce que le dashboard dira. Une
tuile de domaine, une pièce, une mesure de l'accueil ou une pile faible ne
comptent donc jamais un équipement masqué. Révéler sert à régler, pas à changer
les comptes.

Le panneau de détail d'un équipement s'ouvre alors sur un bloc **Affichage dans
jeeGlow** — en tête, avant les valeurs : on ouvre ce panneau pour régler, pas
pour lire. Il contient : le réglage de la carte entière, la raison du masquage quand il vient
d'ailleurs — le plugin, la pièce, Jeedom — avec le bouton qui le défait là où il
a été décidé, puis la liste de **tous** ses éléments, y compris ceux que Jeedom
masque, chacun avec ses trois positions et le bouton qui refuse le widget du
plugin. Un bouton **Rétablir cet équipement** efface d'un geste les décisions
prises sur lui et sur ses éléments : après avoir réglé une carte élément par
élément, personne ne se souvient desquels il a touchés, et un rétablissement
partiel laisse une carte dans un état que l'on n'a jamais choisi.

Certains éléments portent une étiquette **rôle** : ce sont ceux qui donnent sa
forme à la carte, l'état d'une lampe ou la consigne d'un thermostat. Rien
n'interdit de les masquer, mais la carte retombe alors en carte générique. C'est
un aveu honnête plutôt qu'une carte lumière dont l'état aurait disparu.

**Ce que le masquage a de radical.** Le tri a lieu sur le serveur, avant que la
page ne reçoive quoi que ce soit. Un équipement masqué disparaît donc de toutes
les vues, **la vue Santé comprise : il n'est plus signalé du tout**, ni pour une
pile faible, ni parce qu'il ne répond plus. Masquer une passerelle bavarde est
un bon calcul ; masquer un capteur sur pile en est un moins bon. Une pièce dont
tous les équipements sont masqués disparaît de la navigation, et ce qui est
masqué ne compte plus dans la limite de quatre cents équipements : masquer,
c'est aussi faire de la place.

Dans l'autre sens, **Toujours affiché** fait venir dans jeeGlow une commande ou
un équipement que Jeedom masque — la mesure technique qu'on veut lire ici sans
l'exposer partout ailleurs. Cela ne ressuscite jamais un équipement
**désactivé** : un équipement désactivé n'a aucune valeur à montrer, seulement
un nom.

La configuration du plugin affiche le **nombre de décisions en cours** et un
bouton **Tout rétablir** qui les efface toutes, après confirmation : jeeGlow
réaffiche alors exactement ce que Jeedom prévoit. Un réglage dont on ne sait pas
revenir est un réglage qu'on n'ose pas essayer.

Ces décisions vivent dans la configuration de jeeGlow et sont réservées aux
administrateurs. Le serveur revérifie ce droit à chaque appel : un bouton absent
n'est pas une porte fermée.

## Ranger une pièce sans quitter le dashboard

Le panneau de détail propose un sélecteur de **pièce** aux administrateurs. La
moitié d'une installation ordinaire n'appartient à aucun objet, et personne ne
va ouvrir la page d'un plugin pour corriger ça : la seule occasion de ranger est
celle où l'on a l'équipement sous les yeux.

L'écriture est directe, sans déclencher les traitements du plugin propriétaire :
changer de pièce est un attribut Jeedom, il n'y a aucune raison de faire tourner
le code d'un plugin de caméra pour ça.

## Courbes

Dans le panneau de détail, les commandes **numériques historisées** sont tracées
sur les dernières 24 heures, deux courbes au maximum. C'est le moteur de
graphiques de Jeedom qui dessine : mêmes données, mêmes couleurs que partout
ailleurs.

## Recherche

Le champ en haut à droite cherche dans le **nom affiché**, le **plugin** et la
**pièce**. Chercher « cuisine » et ne rien trouver parce qu'aucun équipement ne
porte le mot dans son nom serait une fausse réponse.

La recherche traverse toutes les vues : chercher « volet » depuis la vue Caméras
et ne rien trouver alors que le volet existe n'aurait aucun sens.

## Mode kiosque

Le kiosque n'est pas un mode d'affichage à part, c'est **une distance de
lecture**. Il fait deux choses : il retire le menu et la barre du haut de
Jeedom, ainsi que le pied de page, et il agrandit tout — toute la typographie,
la largeur des cartes, l'écart de la grille et la taille des cibles tactiles,
d'un seul facteur. Les noms de carte restaient sinon à quatorze pixels, à lire à
deux mètres. Au-delà de 1800 pixels de large, l'écran n'est plus une tablette au
mur mais un téléviseur, et tout grandit encore d'un cran.

Trois façons de l'obtenir, de la plus directe à la plus durable :

1. **Le bouton « Kiosque »**, en bas du rail de gauche, qui dit ce qu'il fait et
   comment en sortir. Celui en haut à droite fait la même chose.
2. **L'adresse**, pour un favori ou une page de démarrage (voir plus bas).
3. **Le réglage « Démarrer en kiosque »**, dans la configuration du plugin :
   jeeGlow s'ouvre alors sans le menu, sur tous les appareils, sans rien avoir à
   cliquer. C'est ce qu'il faut pour une tablette murale.

Le mode est **retenu par l'appareil** : une tablette qui rouvre la page la
retrouve en kiosque, sans paramètre dans l'adresse et sans intervention. Ce
choix l'emporte sur le réglage de l'installation : si « Démarrer en kiosque » est
coché mais que vous quittez le kiosque sur votre ordinateur, cet ordinateur
garde son menu. Le même bouton en sort, et Jeedom retrouve son menu.

L'adresse fonctionne aussi, pour un favori ou une page de démarrage :

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe&fullscreen=1
```

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

## Réglages

**Plugins → Gestion des plugins → jeeGlow → Configuration** :

- **Titre affiché** : le nom en haut du dashboard.
- **Noms courts** : le raccourcissement décrit plus haut, actif par défaut.
- **Afficher les équipements sans objet** : les regroupe dans une pièce
  « Non classé ». Utile tant que le rangement n'est pas fait.
- **Démarrer en kiosque**, **Retour à l'accueil après** et **Atténuation de
  nuit** : voir le mode kiosque.

## Utilisateurs en lecture seule

Un utilisateur qui a le droit de **voir** un équipement sans celui de l'**agir**
ne reçoit aucun bouton, aucun curseur, aucune liste : la carte affiche l'état et
s'arrête là. Le cœur refuserait de toute façon l'exécution, mais un dashboard
couvert de commandes qui répondent par une alerte rouge n'aurait aucun sens.

Les scénarios suivent la même règle : seuls ceux que vous avez le droit de
lancer apparaissent en scènes, et le serveur revérifie ce droit à chaque appui —
une liste filtrée n'est pas une porte fermée.

## Ce que jeeGlow ne fait pas

- Il ne modifie **aucun** équipement, aucune commande, aucun réglage de Jeedom.
  Les seules écritures possibles, réservées aux administrateurs, sont le nom
  d'affichage et les décisions d'affichage — qui vivent dans la configuration de
  jeeGlow — et la pièce d'un équipement.
- Il part de ce que vous avez déjà décidé : un objet masqué du dashboard reste
  masqué et un équipement invisible n'apparaît pas, tant que vous n'en décidez
  pas autrement dans jeeGlow lui-même. Un équipement désactivé, lui, n'apparaît
  jamais.
- Il ne réutilise pas les widgets natifs : les cartes sont les siennes. Un widget
  personnalisé installé sur une commande ne se retrouve donc pas ici.
