<?php
/* This file is part of Jeedom.
 *
 * Jeedom is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Jeedom is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Jeedom. If not, see <http://www.gnu.org/licenses/>.
 */

require_once __DIR__ . '/../../../../core/php/core.inc.php';

/*
 * jeeGlow ne crée aucun équipement : il relit ceux des autres plugins et en
 * dessine un second dashboard. La classe existe quand même, et hérite d'eqLogic,
 * parce que le coeur la charge par réflexion dès que le plugin est actif — un
 * plugin sans classe homonyme tombe en erreur sans message exploitable.
 *
 * Elle ne porte donc que des méthodes statiques : la construction du modèle
 * envoyé à la page. Aucune propriété n'y est déclarée, ce qui écarte d'office le
 * piège des colonnes inconnues de DB::save().
 */
class jeeglowbe extends eqLogic {

    /*
     * Ce que jeeGlow sait reconnaître, et dans quel ordre.
     *
     * Le coeur décrit 171 types génériques répartis en familles
     * (jeedom::getConfiguration('cmd::generic_type')). Plutôt que de dépendre de
     * cette table à l'exécution, on nomme ici les seuls types dont le dashboard
     * a besoin, et le rôle que chacun joue dans sa carte : « qui dit l'état »,
     * « qui allume », « qui ferme ». Le rendu n'a alors plus à connaître la
     * domotique, seulement des rôles.
     *
     * L'ordre compte : un équipement qui répond à plusieurs cartes prend la
     * première. Une lampe sur prise commandée est d'abord une lampe.
     */
    const CARDS = array(
        'light' => array(
            'state'      => array('LIGHT_STATE', 'LIGHT_STATE_BOOL'),
            'slider'     => array('LIGHT_SLIDER'),
            'brightness' => array('LIGHT_BRIGHTNESS'),
            'on'         => array('LIGHT_ON'),
            'off'        => array('LIGHT_OFF'),
            'toggle'     => array('LIGHT_TOGGLE'),
            'color'      => array('LIGHT_COLOR'),
            'setColor'   => array('LIGHT_SET_COLOR'),
        ),
        'cover' => array(
            'state'  => array('FLAP_STATE', 'FLAP_BSO_STATE'),
            'slider' => array('FLAP_SLIDER'),
            'up'     => array('FLAP_UP', 'FLAP_BSO_UP'),
            'down'   => array('FLAP_DOWN', 'FLAP_BSO_DOWN'),
            'stop'   => array('FLAP_STOP'),
        ),
        'switch' => array(
            'state'  => array('ENERGY_STATE'),
            'slider' => array('ENERGY_SLIDER'),
            'on'     => array('ENERGY_ON'),
            'off'    => array('ENERGY_OFF'),
        ),
    );

    /* Les rôles qui suffisent à eux seuls à choisir une carte : sans aucun
     * d'eux, un équipement qui porte par exemple LIGHT_BRIGHTNESS sans rien
     * d'allumable n'est qu'un capteur de plus. */
    const PRIMARY_ROLES = array('state', 'on', 'off', 'toggle', 'slider', 'up', 'down');

    /*
     * Le domaine d'un équipement : ce qu'il est pour celui qui habite la
     * maison, et non le plugin qui le pilote. C'est l'axe de rangement
     * principal du dashboard, parce qu'il fonctionne toujours — là où le
     * rangement par pièce dépend d'un travail que personne ne fait jamais
     * entièrement.
     *
     * La table part des familles du coeur (familyid dans cmd::generic_type) :
     * dix-huit familles, tenues à jour par Jeedom, qu'on regroupe en domaines
     * lisibles. L'ordre est une priorité : un équipement qui relève de
     * plusieurs domaines prend le premier. Une lampe sur prise commandée est
     * d'abord une lampe, une caméra qui mesure la température est d'abord une
     * caméra.
     */
    const DOMAINS = array(
        'light'     => array('Light'),
        'cover'     => array('Shutter'),
        'climate'   => array('Thermostat', 'Heating'),
        'socket'    => array('Outlet'),
        'camera'    => array('Camera'),
        'security'  => array('Security', 'Opening'),
        'media'     => array('Multimedia'),
        'appliance' => array('Robot', 'Fan'),
        'weather'   => array('Weather'),
        'energy'    => array('Electricity'),
        'sensor'    => array('Environment', 'Battery'),
    );

    /* Catégories du coeur, par ordre de spécificité : la première cochée donne
     * sa teinte à la carte. 'default' est volontairement absente, elle ne dit
     * rien de plus que l'absence de catégorie. */
    const CATEGORIES = array('light', 'heating', 'opening', 'security', 'energy', 'multimedia', 'automatism');

    /* La clé de configuration qui porte les noms choisis par l'utilisateur.
     * Renommer l'équipement dans Jeedom aurait des effets partout — scénarios,
     * historique, autres plugins ; jeeGlow garde donc ses noms pour lui. */
    const ALIAS_KEY = 'aliases';

    /* Les alias du modèle en cours de construction. Statique — donc jamais une
     * colonne pour DB::save() — et rechargée à chaque appel de model() : un
     * cache de fonction gardait la table d'un appel à l'autre, si bien qu'un
     * renommage n'apparaissait pas dans le modèle relu juste après. */
    private static $_aliases = array();

    /* Le raccourcissement des noms est un réglage, relu à chaque modèle. */
    private static $_shortNames = false;

    /* La clé de configuration qui porte les dérogations d'affichage.
     *
     * Une dérogation n'est pas une liste de masqués : c'est ce que jeeGlow
     * décide EN PLUS de ce que Jeedom prévoit, et rien d'autre. Une entrée
     * absente — le cas de tout ce à quoi on n'a jamais touché — laisse le
     * dernier mot à isVisible et à hideOnDashboard, exactement comme avant que
     * ce réglage existe. C'est aussi ce qui rend le rétablissement possible :
     * effacer l'entrée suffit, il n'y a pas d'état d'origine à deviner ni à
     * conserver quelque part.
     *
     * Cinq portées, chacune une table à part :
     *   cmd   un élément dans une carte          id de commande   -> hide|show
     *   eq    la carte entière                   id d'équipement  -> hide|show
     *   type  toutes les cartes d'un plugin      eqType_name      -> hide|show
     *   room  toutes les cartes d'une pièce      id d'objet       -> hide|show
     *   flat  le gabarit du plugin, refusé       id de commande   -> hide
     *
     * « flat » est le seul qui ne masque rien : la commande reste, c'est le
     * widget écrit par son plugin qu'on écarte, et jeeGlow la dessine alors
     * avec son propre rendu. Un aspirateur dont les dix-neuf commandes portent
     * toutes un widget conçu pour le dashboard d'origine redevient ainsi une
     * carte comme les autres, sans rien perdre. */
    const OVERRIDE_KEY = 'overrides';

    /* Les dérogations du modèle en cours de construction, rechargées à chaque
     * appel de model() comme les alias, et pour la même raison : un réglage
     * changé doit se voir dans le modèle relu juste après. Statique, donc
     * jamais une colonne pour DB::save(). */
    private static $_overrides = array();

    /* Le mode édition : le modèle porte alors aussi ce qui est masqué, pour
     * que l'administrateur puisse le rétablir. Faux partout ailleurs — un
     * dashboard ordinaire ne doit pas transporter ce qu'il ne dessine pas. */
    private static $_reveal = false;

    /* Un modèle complet coûte une lecture de cache par commande renvoyée. Au
     * delà de ce seuil on n'a plus affaire à un dashboard mais à un inventaire :
     * on tronque, et la page le dit. */
    const MAX_DEVICES = 400;

    /* Les scénarios coûtent trois lectures de cache chacun — l'état, le dernier
     * lancement, et l'icône qui relit l'état pour savoir s'il tourne. Quarante
     * est déjà plus que ce qu'on peut présenter sans menu ; au delà, la liste
     * n'aide plus personne et se paie quand même. */
    const MAX_SCENARIOS = 40;

    /*
     * Le modèle envoyé à la page : des pièces, des équipements, et pour chacun
     * la carte à dessiner. Tout le filtrage de droits a lieu ici, une fois, côté
     * serveur ; le navigateur ne reçoit jamais ce que l'utilisateur n'a pas le
     * droit de voir.
     *
     * $_user est l'utilisateur de la session. Passé à null (appel en ligne de
     * commande, test), aucun filtre par équipement n'est appliqué.
     *
     * $_reveal est le mode édition : le modèle porte alors aussi ce que jeeGlow
     * masque, marqué comme tel, pour qu'un administrateur puisse le rétablir.
     * Sans lui, un masquage serait sans retour — ce qui disparaît du modèle
     * disparaît aussi de toute interface capable de le faire revenir.
     */
    public static function model($_user = null, $_reveal = false) {
        $started = microtime(true);
        self::$_aliases = self::aliases();
        self::$_shortNames = (config::byKey('shortNames', 'jeeglowbe', 1) == 1);
        self::$_overrides = self::overrides();
        /* Le contrôle est ici en plus d'être dans l'ajax : model() est aussi
         * appelée par la page et par les outils, et une porte gardée à un seul
         * endroit finit toujours par être contournée par le second appelant. */
        self::$_reveal = ($_reveal === true && (!is_object($_user) || $_user->getProfils() == 'admin'));
        $rooms = array();
        $devices = array();
        /* Le plafond ne compte QUE ce qui se dessine. En mode normal cela ne
         * change rien — tout ce qui est dans le tableau se dessine — mais en
         * mode édition les masqués auraient mangé les quatre cents places, et
         * la troncature serait tombée sur la queue de liste : précisément les
         * équipements masqués qu'on venait chercher pour les rétablir, et qui
         * n'auraient plus eu aucune prise dans la page. */
        $drawnCount = 0;

        /*
         * buildTree(null, false) et non (null, true) : le second argument est
         * « seulement les visibles », et il descend jusqu'à rootObject() et
         * getChild() qui ajoutent tous deux « AND isVisible = 1 »
         * (core/class/jeeObject.class.php, ligne 1184). Le laisser à true
         * rendait une dérogation « Toujours affiché » posée sur une pièce
         * invisible silencieusement inopérante : l'objet n'arrivait jamais
         * jusqu'ici. « Show » doit vouloir dire la même chose aux quatre
         * portées, sans quoi il faut se souvenir de l'exception.
         *
         * Le coût est celui des objets invisibles hydratés — aucun sur
         * l'installation d'essai, seize objets en tout — et buildTree filtre
         * déjà les droits, que la boucle revérifie avec l'utilisateur reçu.
         */
        foreach (jeeObject::buildTree(null, false) as $object) {
            /* Ce que Jeedom dit de la pièce : invisible, ou masquée du
             * dashboard d'origine. La dérogation se pose par-dessus, dans les
             * deux sens. */
            $roomOvr = isset(self::$_overrides['room'][intval($object->getId())])
                ? self::$_overrides['room'][intval($object->getId())] : '';
            $roomShown = ($roomOvr === '')
                ? ($object->getIsVisible() == 1 && $object->getConfiguration('hideOnDashboard', 0) != 1)
                : ($roomOvr === 'show');
            /* Pas de « continue » sur une pièce masquée : ses équipements sont
             * parcourus quand même, parce qu'une dérogation posée sur l'un
             * d'eux doit pouvoir l'en sortir — « toute la pièce sauf celui-là »
             * est la même phrase que « tous les aspirateurs sauf celui-là », et
             * elle doit se dire de la même façon. C'est une requête par pièce
             * masquée, sur des pièces qu'on compte sur les doigts. */
            /* buildTree() a déjà écarté les objets interdits, mais en
             * s'appuyant sur la session. Le contrôle est refait avec
             * l'utilisateur reçu : ainsi le modèle est juste même appelé hors
             * d'une session — depuis un test, une tâche, un autre plugin. */
            if (is_object($_user) && !$object->hasRight('r', $_user)) {
                continue;
            }
            $ids = array();
            /* getEqLogic(true, false) et non (true, true) : la visibilité n'est
             * plus une affaire de requête depuis qu'une dérogation peut
             * rétablir un équipement que Jeedom masque. Le tri descend donc
             * d'un cran, de la clause SQL à deviceDecision(). Le surcoût est
             * l'hydratation des équipements invisibles — deux sur soixante-sept
             * sur l'installation d'essai ; le gain est qu'un équipement masqué
             * dans Jeedom peut vivre ici, ce qui était impossible autrement. */
            foreach ($object->getEqLogic(true, false) as $eqLogic) {
                if (is_object($_user) && !$eqLogic->hasRight('r', $_user)) {
                    continue;
                }
                $decision = self::deviceDecision($eqLogic, $roomShown);
                if (!$decision['shown'] && !self::$_reveal) {
                    continue;
                }
                /* Le budget est compté après le masquage : un équipement que
                 * personne ne verra n'a pas à occuper une des quatre cents
                 * places, ni à payer ses lectures de cache. Masquer, c'est donc
                 * aussi faire de la place. */
                if ($drawnCount >= self::MAX_DEVICES) {
                    break;
                }
                $device = self::deviceModel($eqLogic, intval($object->getId()), $_user, $decision);
                if ($device === null) {
                    continue;
                }
                if ($decision['shown']) {
                    $drawnCount++;
                }
                $devices[$device['id']] = $device;
                $ids[] = $device['id'];
            }
            /* L'identité de la pièce, telle que l'utilisateur l'a déjà donnée
             * au dashboard d'origine. Les quatre champs sortent de colonnes
             * que buildTree() a chargées avec l'objet : getDisplay() et
             * getConfiguration() ne font que décoder le JSON déjà en mémoire
             * (core/class/jeeObject.class.php, lignes 1326 et 1337). La
             * lecture de fichier qu'on redoutait ici est celle de
             * findCodeIcon() (core/php/utils.inc.php, ligne 1479), qui relit
             * font-awesome pour retrouver un point de code — on ne l'appelle
             * pas, la page n'a besoin que de la classe.
             *
             * 'depth' vient de la configuration et non de parentNumber() : le
             * coeur y inscrit la profondeur à chaque enregistrement
             * (jeeObject::preSave, ligne 803), là où la méthode remonte la
             * chaîne des pères par autant de byId(). */
            $room = array(
                'id'      => intval($object->getId()),
                'name'    => $object->getName(),
                'icon'    => self::iconClass($object->getDisplay('icon', '')),
                'color'   => $object->getDisplay('tagColor', ''),
                'father'  => intval($object->getFather_id(0)),
                'depth'   => intval($object->getConfiguration('parentNumber', 0)),
                'devices' => $ids,
            );
            if (self::$_reveal) {
                $room['ovr'] = $roomOvr;
                $room['drawn'] = $roomShown;
                /* Ce que Jeedom dit de la pièce, dérogation mise à part. La
                 * page en a besoin pour savoir si rétablir veut dire « efface
                 * la décision » ou « affiche-la quand même » : sans ce
                 * renseignement, elle ne pouvait qu'épingler la pièce sur
                 * « toujours affichée », définitivement. C'est le pendant de
                 * 'jeedom' sur les commandes. */
                $room['jeedom'] = ($object->getIsVisible() == 1
                    && $object->getConfiguration('hideOnDashboard', 0) != 1);
            }
            $rooms[] = $room;
        }

        /*
         * Les équipements sans pièce. Les ignorer serait le plus simple, mais
         * c'est justement ce qui fait qu'on ne les range jamais : une
         * installation vivante en compte toujours, et un dashboard qui les
         * escamote laisse croire qu'ils n'existent pas.
         */
        if (config::byKey('showUnassigned', 'jeeglowbe', 1) == 1) {
            $orphans = array();
            /* byObjectId(null) et non all() filtré à la main. Le coeur
             * reconnaît deux façons de n'avoir aucun objet — « object_id IS
             * NULL OR object_id = -1 » (core/class/eqLogic.class.php, ligne
             * 116) — et l'argument suivant ajoute « AND isEnable = 1 » à la
             * même requête : all() hydratait toute la table eqLogic pour n'en
             * garder que les orphelins.
             *
             * Le troisième argument, « seulement les visibles », est resté à
             * false depuis qu'une dérogation peut rétablir un équipement que
             * Jeedom masque : ce tri-là appartient désormais à
             * deviceDecision(). Les désactivés, eux, restent écartés par la
             * base, et aucune dérogation ne les ramène. */
            foreach (eqLogic::byObjectId(null, true, false) as $eqLogic) {
                if (is_object($_user) && !$eqLogic->hasRight('r', $_user)) {
                    continue;
                }
                /* Aucune pièce, donc aucune pièce à masquer : la décision se
                 * joue entre l'équipement, son type et Jeedom. */
                $decision = self::deviceDecision($eqLogic, true);
                if (!$decision['shown'] && !self::$_reveal) {
                    continue;
                }
                if ($drawnCount >= self::MAX_DEVICES) {
                    break;
                }
                $device = self::deviceModel($eqLogic, 0, $_user, $decision);
                if ($device === null) {
                    continue;
                }
                if ($decision['shown']) {
                    $drawnCount++;
                }
                $devices[$device['id']] = $device;
                $orphans[] = $device['id'];
            }
            if (count($orphans) > 0) {
                /* Les mêmes clés que les vraies pièces, vides : « Non classé »
                 * n'existe dans aucune table, mais la page ne doit pas avoir à
                 * distinguer deux formes de pièce pour dessiner un titre. */
                $rooms[] = array(
                    'id'      => 0,
                    'name'    => __('Non classé', __FILE__),
                    'icon'    => '',
                    'color'   => '',
                    'father'  => 0,
                    'depth'   => 0,
                    'devices' => $orphans,
                );
            }
        }

        /* Une pièce sans rien à montrer n'est pas une information : les étages
         * et les objets de rangement n'ont pas à occuper une ligne de titre et
         * une pastille de filtre. */
        $rooms = array_values(array_filter($rooms, function ($_room) {
            return count($_room['devices']) > 0;
        }));

        $scenarios = self::scenarioList($_user);

        /* L'ambiance du dashboard. « auto » laisse la page mesurer le fond de
         * Jeedom et s'y accorder, ce qui reste le comportement par défaut ;
         * « light » et « dark » l'imposent. Le besoin est celui d'une tablette
         * murale : un Jeedom en thème clair interdisait jusqu'ici tout rendu
         * sombre, alors que c'est justement là qu'on le veut. Toute autre
         * valeur — réglage jamais ouvert, clé vide, configuration héritée —
         * retombe sur la mesure : le réglage absent doit se comporter comme
         * avant qu'il existe. */
        $tone = (string) config::byKey('tone', 'jeeglowbe', 'auto');

        log::add('jeeglowbe', 'debug', 'modèle construit en ' . round((microtime(true) - $started) * 1000) . ' ms : '
            . count($rooms) . ' pièce(s), ' . count($devices) . ' équipement(s), '
            . count($scenarios) . ' scénario(s)');

        $return = array(
            'rooms'     => $rooms,
            'devices'   => $devices,
            'truncated' => ($drawnCount >= self::MAX_DEVICES),
            'title'     => trim(config::byKey('title', 'jeeglowbe', '')),
            /* Renommer touche à la configuration du plugin : réservé aux
             * administrateurs, comme toute écriture. */
            'admin'     => (is_object($_user) && $_user->getProfils() == 'admin'),
            'kiosk'     => self::kioskSettings(),
            'tone'      => in_array($tone, array('light', 'dark'), true) ? $tone : 'auto',
            /* Toutes les pièces, y compris celles qui n'ont encore aucun
             * équipement : c'est justement là qu'on veut pouvoir ranger. */
            'objects'   => self::objectList($_user),
            /* La langue de Jeedom, et non celle du navigateur : une tablette
             * murale livrée en anglais afficherait « Monday, September 21 » sur
             * une installation entièrement française. Le format BCP 47 attendu
             * par Intl s'obtient en remplaçant le souligné. */
            'lang'      => str_replace('_', '-', config::byKey('language', 'core', 'fr_FR')),
        );

        /* La table des dérogations ne part qu'à l'administrateur, et seulement
         * en mode édition : c'est un réglage, pas une donnée du dashboard, et
         * un compte tablette n'a rien à en faire. Elle porte aussi les types et
         * les pièces, que les équipements reçus ne suffisent pas à déduire — un
         * plugin entièrement masqué n'a plus un seul équipement dans le modèle,
         * et sa ligne doit pourtant rester réglable. */
        if (self::$_reveal) {
            $return['reveal'] = true;
            $return['overrides'] = self::$_overrides;
        }

        /* Une installation sans scénario visible — ou un utilisateur qui n'a le
         * droit d'en lancer aucun — ne reçoit pas une liste vide à tester : la
         * clé est absente, et la page n'a rien à dessiner. */
        if (count($scenarios) > 0) {
            $return['scenarios'] = $scenarios;
        }

        return $return;
    }

    /*
     * Les scénarios que l'utilisateur peut lancer. Le filtrage de droits a lieu
     * ici, comme pour les équipements : scenario::hasRight()
     * (core/class/scenario.class.php, ligne 1506) est le même contrôle que
     * core/ajax/scenario.ajax.php oppose à « changeState », et envoyer un
     * scénario que le serveur refusera ensuite ne ferait qu'un bouton qui
     * répond par une erreur.
     *
     * Trois lectures de cache par scénario : getState(), getLastLaunch(), et
     * getIcon(true) qui relit l'état pour rendre le sablier d'un scénario en
     * cours. Le reste — nom, groupe, objet, activité, visibilité — sort des
     * colonnes que scenario::all() a déjà chargées.
     */
    private static function scenarioList($_user) {
        $return = array();
        foreach (scenario::all() as $scenario) {
            if ($scenario->getIsActive() != 1 || $scenario->getIsVisible() != 1) {
                continue;
            }
            /* Le droit « x » et non « r » : un scénario qu'on ne peut que voir
             * n'a pas de carte, puisque la carte ne sait qu'une chose, le
             * lancer. */
            if (is_object($_user) && !$scenario->hasRight('x', $_user)) {
                continue;
            }
            $return[] = array(
                'id'     => intval($scenario->getId()),
                'name'   => $scenario->getName(),
                /* getIcon(true) rend la classe FontAwesome nue, sans la balise
                 * — c'est ce que la page recolle elle-même. Le trim n'est pas
                 * superflu : le découpage du coeur laisse l'espace qui
                 * précédait « class= », et « <i class=" fas fa-flask"> » n'est
                 * pas une classe qu'on veut écrire dans la page. */
                'icon'   => trim($scenario->getIcon(true)),
                'group'  => $scenario->getGroup(),
                'roomId' => intval($scenario->getObject_id(0)),
                'state'  => $scenario->getState(),
                'last'   => $scenario->getLastLaunch(),
            );
            if (count($return) >= self::MAX_SCENARIOS) {
                break;
            }
        }
        return $return;
    }

    /*
     * La classe FontAwesome d'une icône, que Jeedom stocke sous forme de
     * balise complète (« <i class="fas fa-home"></i> » dans object.display).
     * Le découpage est celui du coeur, scenario::getIcon(true)
     * (core/class/scenario.class.php, ligne 1050) : c'est la seule écriture
     * dont on soit sûr qu'elle accepte tout ce que les pages de configuration
     * ont pu enregistrer au fil des versions.
     */
    private static function iconClass($_icon) {
        if ($_icon === '' || !is_string($_icon)) {
            return '';
        }
        if (strpos($_icon, '<') === false) {
            return trim($_icon);
        }
        if (strpos($_icon, '<i') !== 0) {
            return '';
        }
        return trim(str_replace(array('<i', 'class=', '"', "'", '/>', '></i>'), '', $_icon));
    }

    /*
     * Les réglages du mode kiosque. Les heures de nuit ne sont pas réinventées :
     * ce sont celles que l'utilisateur a déjà données à Jeedom pour basculer son
     * thème. Un réglage de moins à tenir, et deux interfaces qui s'accordent.
     */
    private static function objectList($_user) {
        if (!is_object($_user) || $_user->getProfils() != 'admin') {
            return array();
        }
        $return = array();
        foreach (jeeObject::buildTree(null, false) as $object) {
            $return[] = array(
                'id'   => intval($object->getId()),
                'name' => str_repeat('· ', intval($object->getConfiguration('parentNumber', 0))) . $object->getName(),
            );
        }
        return $return;
    }

    private static function kioskSettings() {
        $theme = jeedom::getThemeConfig();
        return array(
            /* Le kiosque au démarrage : un réglage de l'installation, et non
             * une préférence d'appareil. Il sert le cas le plus fréquent — on
             * veut jeeGlow en plein écran, point — sans obliger à trouver un
             * bouton. Le bouton, lui, garde le dernier mot sur l'appareil où on
             * s'en sert. */
            'start' => (config::byKey('kioskStart', 'jeeglowbe', 0) == 1),
            'idle'  => intval(config::byKey('kioskIdle', 'jeeglowbe', 0)),
            'dim'   => intval(config::byKey('kioskDim', 'jeeglowbe', 0)),
            'night' => isset($theme['theme_end_day_hour']) ? $theme['theme_end_day_hour'] : '20:00',
            'day'   => isset($theme['theme_start_day_hour']) ? $theme['theme_start_day_hour'] : '08:00',
        );
    }

    /*
     * Le nom raccourci d'un équipement, pour l'affichage seulement.
     *
     * Les plugins nomment pour eux-mêmes : « OpenMQTTGateway 1629AC —
     * OMG_ESP32_BLE_SALON » dit le modèle, le numéro de série et enfin ce qui
     * intéresse l'habitant. Sur cette installation, trente-neuf noms sur
     * soixante-quatre dépassent vingt-quatre caractères et ne tiennent pas sur
     * une carte.
     *
     * Deux règles seulement, et prudentes : ce qui suit un tiret ENTOURÉ
     * D'ESPACES — « Detection OUEST-NORD » n'est donc pas touché — et les jetons
     * qui ne sont qu'un identifiant matériel, hexadécimaux d'au moins six
     * caractères et portant un chiffre, ce qui épargne « EDPNET ». Si le
     * résultat est vide ou trop court, on garde le nom d'origine : mieux vaut un
     * nom long qu'un nom faux.
     */
    public static function shorten($_name) {
        $name = $_name;
        if (preg_match('/^.+?\s[—–-]\s(.+)$/u', $name, $found)) {
            $name = $found[1];
        }
        $name = preg_replace_callback('/\b[0-9A-Fa-f]{6,}\b/', function ($_match) {
            return preg_match('/[0-9]/', $_match[0]) ? '' : $_match[0];
        }, $name);
        $name = trim(preg_replace('/\s{2,}/', ' ', $name), " \t-—–_");
        return ($name === '' || mb_strlen($name) < 2) ? $_name : $name;
    }

    public static function aliases() {
        $raw = config::byKey(self::ALIAS_KEY, 'jeeglowbe', '');
        if ($raw === '' || $raw === null) {
            return array();
        }
        $decoded = is_array($raw) ? $raw : json_decode($raw, true);
        return is_array($decoded) ? $decoded : array();
    }

    /*
     * Pose ou retire le nom choisi pour un équipement. Un nom vide efface
     * l'entrée plutôt que d'enregistrer une chaîne vide : sans quoi la table des
     * alias enflerait d'entrées qui ne disent rien.
     */
    public static function rename($_id, $_name) {
        $aliases = self::aliases();
        $id = intval($_id);
        $name = trim($_name);
        if ($name === '') {
            unset($aliases[$id]);
        } else {
            $aliases[$id] = mb_substr($name, 0, 60);
        }
        config::save(self::ALIAS_KEY, json_encode($aliases, JSON_UNESCAPED_UNICODE), 'jeeglowbe');
        return isset($aliases[$id]) ? $aliases[$id] : '';
    }

    /*
     * La table des dérogations, rangée par portée.
     *
     * Toujours les cinq clés, même vides : le reste du code n'a pas à vérifier
     * leur existence à chaque lecture, et une table incomplète — écrite par une
     * version antérieure du plugin, ou à la main dans la configuration — se
     * comporte comme une table vide au lieu d'échouer.
     */
    public static function overrides() {
        $raw = config::byKey(self::OVERRIDE_KEY, 'jeeglowbe', '');
        $decoded = is_array($raw) ? $raw : json_decode((string) $raw, true);
        $return = array('cmd' => array(), 'eq' => array(), 'type' => array(), 'room' => array(), 'flat' => array());
        if (!is_array($decoded)) {
            return $return;
        }
        foreach (array_keys($return) as $scope) {
            if (!isset($decoded[$scope]) || !is_array($decoded[$scope])) {
                continue;
            }
            /* Seules deux valeurs existent. Les autres — table écrite à la
             * main, valeur d'une version ultérieure, faute de frappe — sont
             * écartées ici plutôt que d'être interprétées différemment selon
             * l'endroit : les lectures testent tantôt « === show », tantôt
             * « !== hide », et une valeur parasite produisait une commande
             * ni affichée ni masquée, qui gardait pourtant son rôle. Ce qui
             * n'est pas une décision ne décide rien. */
            foreach ($decoded[$scope] as $key => $state) {
                if ($state === 'hide' || $state === 'show') {
                    $return[$scope][$key] = $state;
                }
            }
        }
        return $return;
    }

    /*
     * Pose ou retire une dérogation. Nommée « applyOverride » et non
     * « setOverride » : le coeur appelle « set » + le nom de chaque clé reçue
     * par un formulaire (utils::a2o), et une méthode qui commence par « set »
     * sur une classe qu'il instancie par réflexion est un piège connu. Le
     * préfixe coûte deux lettres et écarte la question.
     *
     * $_state vaut « hide », « show », ou « auto » qui EFFACE l'entrée. Cette
     * troisième valeur est tout l'intérêt du mécanisme : rétablir n'est pas
     * enregistrer « affiché », c'est cesser de décider — l'équipement repart
     * alors sur ce que Jeedom en dit, aujourd'hui et après tout changement
     * qu'on y fera plus tard.
     */
    public static function applyOverride($_scope, $_key, $_state) {
        $overrides = self::overrides();
        if (!isset($overrides[$_scope])) {
            throw new Exception(__('Portée inconnue :', __FILE__) . ' ' . $_scope);
        }
        /* Le type est un nom de plugin, tout le reste un identifiant. Les
         * ramener à la même forme ici évite qu'une clé « 236 » et une clé 236
         * désignent deux entrées différentes selon le chemin d'écriture. */
        /* Le type est un nom de plugin, borné comme les alias : la table des
         * dérogations part dans une colonne de configuration, et une clé
         * inventée par un appel forgé n'a pas à pouvoir la faire enfler. */
        $key = ($_scope === 'type') ? mb_substr(trim((string) $_key), 0, 64) : strval(intval($_key));
        if ($key === '' || ($_scope !== 'type' && intval($key) <= 0)) {
            throw new Exception(__('Dérogation sans cible', __FILE__));
        }
        if ($_state === 'auto' || $_state === '') {
            unset($overrides[$_scope][$key]);
        } elseif ($_state === 'hide' || ($_state === 'show' && $_scope !== 'flat')) {
            $overrides[$_scope][$key] = $_state;
        } else {
            throw new Exception(__('État de dérogation non géré :', __FILE__) . ' ' . $_state);
        }
        self::saveOverrides($overrides);
        return $overrides;
    }

    /*
     * Rétablit un équipement : sa propre dérogation, et celles de toutes ses
     * commandes. C'est le bouton qu'il faut, et pas seulement une commodité :
     * après avoir réglé une carte élément par élément, personne ne se souvient
     * desquels il a touchés, et un rétablissement partiel laisse une carte dans
     * un état que l'on n'a jamais choisi.
     *
     * La dérogation de type ou de pièce n'est pas effacée : elle ne porte pas
     * sur cet équipement, et l'effacer masquerait ou révélerait au passage tous
     * ses voisins.
     */
    public static function resetDevice($_id) {
        $eqLogic = eqLogic::byId($_id);
        if (!is_object($eqLogic)) {
            throw new Exception(__('Équipement introuvable', __FILE__));
        }
        $overrides = self::overrides();
        unset($overrides['eq'][intval($_id)]);
        foreach ($eqLogic->getCmd() as $cmd) {
            unset($overrides['cmd'][intval($cmd->getId())]);
            unset($overrides['flat'][intval($cmd->getId())]);
        }
        self::saveOverrides($overrides);
        return $overrides;
    }

    /* Tout rétablir : jeeGlow ne décide plus rien et réaffiche exactement ce
     * que Jeedom prévoit. Un réglage dont on ne sait pas revenir est un réglage
     * qu'on n'ose pas essayer. */
    public static function resetAll() {
        config::save(self::OVERRIDE_KEY, '', 'jeeglowbe');
        return self::overrides();
    }

    /*
     * L'écriture, et le ménage qui va avec.
     *
     * Une dérogation désigne quelque chose qui peut disparaître : un
     * équipement supprimé, une commande qu'un plugin a reconstruite, une pièce
     * effacée. La table décrirait alors une installation qui n'existe plus, et
     * grossirait indéfiniment. Le tri se fait ici, à l'écriture — un geste
     * d'administrateur, jamais dans le chemin d'affichage.
     *
     * Les types ne sont pas vérifiés : un plugin désinstallé puis réinstallé
     * doit retrouver son réglage, et rien ne distingue « absent pour de bon »
     * de « absent ce matin ».
     */
    private static function saveOverrides($_overrides) {
        foreach (array_keys($_overrides['eq']) as $id) {
            if (!is_object(eqLogic::byId($id))) {
                unset($_overrides['eq'][$id]);
            }
        }
        foreach (array('cmd', 'flat') as $scope) {
            foreach (array_keys($_overrides[$scope]) as $id) {
                if (!is_object(cmd::byId($id))) {
                    unset($_overrides[$scope][$id]);
                }
            }
        }
        foreach (array_keys($_overrides['room']) as $id) {
            if (!is_object(jeeObject::byId($id))) {
                unset($_overrides['room'][$id]);
            }
        }
        config::save(self::OVERRIDE_KEY, json_encode($_overrides, JSON_UNESCAPED_UNICODE), 'jeeglowbe');
    }

    /*
     * Ce que jeeGlow décide d'un équipement, et pourquoi.
     *
     * La cascade va du plus précis au plus général : la dérogation posée sur
     * l'équipement, puis celle posée sur son type — « tous les aspirateurs » —
     * et à défaut la visibilité que Jeedom lui connaît. S'arrêter à la première
     * réponse est ce qui permet de dire « tous les aspirateurs sauf celui-là » :
     * le type masque, l'équipement rétablit.
     *
     * La pièce est le troisième cran, et non un veto posé après coup : un
     * équipement explicitement affiché sort de sa pièce masquée, exactement
     * comme il sort d'un plugin masqué. Sans cela le modèle se contredisait
     * sur une même carte — un réglage sur « Toujours affiché » à côté d'une
     * carte éteinte.
     *
     * « show » ne ressuscite jamais un équipement désactivé : les requêtes qui
     * alimentent le modèle ne demandent que les actifs, et c'est voulu — un
     * équipement désactivé n'a pas de valeur à montrer, seulement un nom.
     */
    private static function deviceDecision($_eqLogic, $_roomShown) {
        $own = isset(self::$_overrides['eq'][intval($_eqLogic->getId())])
            ? self::$_overrides['eq'][intval($_eqLogic->getId())] : '';
        $state = $own;
        $from = 'eq';
        if ($state === '') {
            $type = $_eqLogic->getEqType_name();
            $state = isset(self::$_overrides['type'][$type]) ? self::$_overrides['type'][$type] : '';
            $from = 'type';
        }
        if ($state === '' && !$_roomShown) {
            $state = 'hide';
            $from = 'room';
        }
        if ($state === '') {
            $state = ($_eqLogic->getIsVisible() == 1) ? 'show' : 'hide';
            $from = 'jeedom';
        }
        $shown = ($state === 'show');
        return array(
            'shown' => $shown,
            'ovr'   => $own,
            /* Ce qui a décidé le masquage, et donc ce qu'il faudra rétablir
             * pour le défaire. Sans cela le mode édition montre une carte
             * éteinte sans dire d'où vient l'extinction, et l'administrateur
             * cherche la case à cocher là où elle n'est pas. */
            'why'   => $shown ? '' : $from,
        );
    }

    /* La dérogation posée sur une commande, ou '' quand jeeGlow n'a rien
     * décidé. Pas de cascade ici : masquer la carte masque déjà tout ce
     * qu'elle contient, il n'y a rien à hériter. */
    private static function cmdState($_id) {
        return isset(self::$_overrides['cmd'][intval($_id)]) ? self::$_overrides['cmd'][intval($_id)] : '';
    }

    /*
     * Un équipement, tel que la page le dessinera. Deux passes sur ses
     * commandes : la première ne lit que des métadonnées et sert à choisir la
     * carte, la seconde ne relit la valeur que des commandes réellement
     * envoyées. Sur une installation d'un millier de commandes, la différence
     * est celle entre un dashboard qui s'ouvre et un dashboard qui rame.
     *
     * $_decision vient de deviceDecision() : elle dit si l'équipement est
     * affiché et, sinon, ce qui le masque. Absente — appel direct depuis un
     * test ou un outil — l'équipement est traité comme affiché.
     */
    private static function deviceModel($_eqLogic, $_roomId, $_user = null, $_decision = null) {
        if (!is_array($_decision)) {
            $_decision = array('shown' => true, 'ovr' => '', 'why' => '');
        }
        /* Voir sans pouvoir agir est un droit à part entière dans Jeedom, et
         * core/ajax/cmd.ajax.php refuse l'exécution sans le droit « x ». Envoyer
         * quand même les boutons donnerait un dashboard qui répond par une
         * alerte rouge à chaque appui : on les retire à la source. */
        $canExecute = (!is_object($_user) || $_eqLogic->hasRight('x', $_user));

        $meta = array();
        $byGeneric = array();
        /* Les objets commande sont conservés : les relire par cmd::byId() à la
         * seconde passe coûterait une requête par commande, soit un millier sur
         * une installation ordinaire. */
        $objects = array();
        foreach ($_eqLogic->getCmd() as $cmd) {
            $state = self::cmdState($cmd->getId());
            $jeedom = ($cmd->getIsVisible() == 1);
            $entry = array(
                'id'      => intval($cmd->getId()),
                'name'    => $cmd->getName(),
                'type'    => $cmd->getType(),
                'subType' => $cmd->getSubType(),
                'unit'    => $cmd->getUnite(),
                'generic' => $cmd->getGeneric_type(),
                /* La visibilité EFFECTIVE, dérogation comprise, et non celle
                 * de Jeedom. Tout ce qui suit — le choix de la carte, le tri
                 * des commandes envoyées, et jusqu'aux filtres de la page qui
                 * lisent cmd.visible — obéit ainsi à la dérogation sans avoir à
                 * la connaître. La visibilité que Jeedom connaît, elle, ne
                 * repart qu'en mode édition, sous le nom 'jeedom'. */
                'visible' => ($state === '') ? $jeedom : ($state === 'show'),
                '_ovr'    => $state,
                '_jeedom' => $jeedom,
                'invert'  => ($cmd->getSubType() == 'binary' && $cmd->getDisplay('invertBinary') == 1),
                /* Une commande historisée peut être tracée : c'est la seule
                 * condition, le coeur se charge du reste. */
                'history' => ($cmd->getIsHistorized() == 1),
            );
            if ($cmd->getSubType() == 'slider' || $cmd->getSubType() == 'numeric') {
                $entry['min'] = ($cmd->getConfiguration('minValue', '') === '') ? 0 : floatval($cmd->getConfiguration('minValue'));
                $entry['max'] = ($cmd->getConfiguration('maxValue', '') === '') ? 100 : floatval($cmd->getConfiguration('maxValue'));
            }
            if ($cmd->getConfiguration('listValue', '') != '') {
                $entry['list'] = self::parseListValue($cmd->getConfiguration('listValue'));
            }
            /*
             * Quand un plugin a écrit son propre widget, il sait mieux que nous
             * ce qu'il a à montrer : les vignettes d'une alerte caméra, le plan
             * d'un robot, un bulletin météo. Réafficher la valeur brute à la
             * place, c'est remplacer un rendu pensé par une chaîne de trois
             * cents caractères.
             *
             * Seul le signalement voyage dans le modèle. Les dix-neuf widgets
             * visibles de l'installation d'essai pèsent 331 ko de HTML : les
             * coudre dans la page la ferait passer de 92 ko à plus de quatre
             * cents. Ils sont demandés après coup, en un seul appel groupé.
             */
            if (self::hasPluginWidget($cmd)) {
                $entry['_hasWidget'] = true;
                /* La dérogation « flat » ne masque rien : elle refuse le
                 * gabarit du plugin, et la commande repart dessinée par
                 * jeeGlow. C'est le seul réglage qui retire quelque chose de la
                 * carte sans retirer l'information. */
                if (!isset(self::$_overrides['flat'][$entry['id']])) {
                    $entry['widget'] = true;
                }
            }
            if ($entry['type'] == 'action' && !$canExecute) {
                continue;
            }
            $meta[$entry['id']] = $entry;
            $objects[$entry['id']] = $cmd;
            /* Une commande masquée ne prend aucun rôle : voir plus bas pourquoi
             * l'ordre compte ici. */
            if ($state !== 'hide' && $entry['generic'] != '' && !isset($byGeneric[$entry['generic']])) {
                $byGeneric[$entry['generic']] = $entry['id'];
            }
        }
        if (count($meta) == 0) {
            return null;
        }

        /*
         * La classification ne voit que ce qui reste.
         *
         * L'ordre n'est pas indifférent : classer d'abord et masquer ensuite
         * donnerait une carte lumière dont le rôle « état » désigne une
         * commande absente du modèle, et la page dessinerait une carte vide
         * sans que rien ne signale l'erreur. Masquer d'abord fait retomber la
         * carte en générique — un aveu honnête, et le comportement qu'attend
         * celui qui vient justement de masquer l'état.
         */
        $effective = array();
        foreach ($meta as $id => $entry) {
            if ($entry['_ovr'] !== 'hide') {
                $effective[$id] = $entry;
            }
        }
        $classification = self::classify($effective, $byGeneric);

        /* Ne sont envoyées que les commandes utiles : celles qui tiennent un
         * rôle dans la carte, et celles que l'utilisateur a rendues visibles. Le
         * reste — commandes de diagnostic, rafraîchissements internes — n'a rien
         * à faire sur un dashboard. */
        $keep = $classification['roles'];
        $cmds = array();
        $drawn = 0;
        foreach ($meta as $id => $entry) {
            /* Nommée « onCard » et non « shown » : plus bas, $shown désigne le
             * nom affiché de l'équipement. Deux sens pour un nom dans une même
             * fonction est le genre de détail qui se paie six mois plus tard. */
            $onCard = ($entry['visible'] || in_array($id, $keep));
            if (!$onCard && !self::$_reveal) {
                continue;
            }
            if ($onCard) {
                $drawn++;
            }
            /* La valeur n'est lue que pour ce qui se dessine. C'est ce qui rend
             * le mode édition tenable : il révèle les 661 commandes invisibles
             * de l'installation d'essai, mais n'en lit pas le cache — il n'a
             * besoin que de leur nom et de leur état pour proposer un réglage. */
            if ($onCard && $entry['type'] == 'info') {
                try {
                    $entry['value'] = $objects[$id]->execCmd();
                    /* La date sort de la lecture qu'on vient de faire :
                     * execCmd() range collectDate et valueDate dans l'objet en
                     * même temps que la valeur (core/class/cmd.class.php,
                     * lignes 1624-1634), et getValueDate() ne relit le cache
                     * que si la propriété est restée vide (ligne 3920). La lire
                     * ici, et seulement après un execCmd() réussi, ne coûte
                     * donc rien ; la lire ailleurs relancerait l'exécution. */
                    $date = $objects[$id]->getValueDate();
                    if ($date !== '' && $date !== null) {
                        $entry['date'] = $date;
                    }
                } catch (Throwable $e) {
                    $entry['value'] = null;
                }
            }
            if (self::$_reveal) {
                $entry['ovr'] = $entry['_ovr'];
                $entry['jeedom'] = $entry['_jeedom'];
                $entry['drawn'] = $onCard;
                if (isset($entry['_hasWidget'])) {
                    $entry['hasWidget'] = true;
                    $entry['flat'] = !isset($entry['widget']);
                }
            }
            unset($entry['_ovr'], $entry['_jeedom'], $entry['_hasWidget']);
            $cmds[] = $entry;
        }

        /* Un équipement dont toutes les commandes sont masquées et qui ne tient
         * aucun rôle n'a rien à montrer : une carte vide porterait son nom et
         * un tiret. C'est du bruit, pas une information. En mode édition il
         * reste au contraire indispensable — c'est la seule prise par laquelle
         * on peut le rétablir. */
        if ($drawn == 0 && !self::$_reveal) {
            return null;
        }

        /* getStatus() sans clé rend le tableau entier
         * (core/class/eqLogic.class.php, ligne 2041 : utils::getJsonAttr()
         * renvoie tout le JSON quand la clé est vide). La batterie coûtait
         * déjà cette lecture de cache ; le timeout, les alertes et la dernière
         * communication viennent donc par-dessus le marché. */
        $status = array();
        try {
            $status = $_eqLogic->getStatus();
        } catch (Throwable $e) {
            $status = array();
        }
        if (!is_array($status)) {
            $status = array();
        }
        $battery = isset($status['battery']) ? $status['battery'] : '';

        $id = intval($_eqLogic->getId());
        $alias = isset(self::$_aliases[$id]) ? self::$_aliases[$id] : '';
        $real = $_eqLogic->getName();
        /* L'alias posé à la main l'emporte toujours sur le raccourcissement
         * automatique : c'est une décision, pas une heuristique. */
        if ($alias !== '') {
            $shown = $alias;
        } elseif (self::$_shortNames) {
            $shown = self::shorten($real);
        } else {
            $shown = $real;
        }

        $device = array(
            'id'       => $id,
            'name'     => $shown,
            'realName' => ($shown !== $real) ? $real : '',
            /* $effective et non $meta : masquer toutes les commandes
             * pilotables d'une prise fait retomber sa carte en capteur, et son
             * domaine doit suivre — sans quoi une carte inerte continue
             * d'apparaître sous le filtre « Prises » et d'y être comptée. Le
             * domaine et la carte se déduisent du même ensemble. */
            'domain'   => self::domainOf($effective),
            'roomId'   => $_roomId,
            'eqType'   => $_eqLogic->getEqType_name(),
            'category' => self::categoryOf($_eqLogic),
            /* Le rang que l'utilisateur a donné à l'équipement DANS SA PIÈCE :
             * il repart de 1 dans chaque objet, et vaut 9999 pour tout ce qui
             * n'a jamais été rangé à la main. Trier par pièce a donc un sens,
             * trier un domaine ou une recherche n'en a aucun — deux « 1 » n'y
             * viennent pas de la même liste. */
            'order'    => intval($_eqLogic->getOrder()),
            'battery'  => ($battery === '' || $battery === null) ? null : intval($battery),
            'card'     => $classification['card'],
            'roles'    => $classification['named'],
            'cmds'     => $cmds,
        );

        $health = self::healthOf($status);
        if ($health !== null) {
            $device['status'] = $health;
        }

        if (self::$_reveal) {
            $device['ovr'] = $_decision['ovr'];
            $device['drawn'] = ($_decision['shown'] && $drawn > 0);
            /* Un équipement affiché dont plus aucune commande ne se dessine
             * n'est masqué par personne : ce sont ses éléments qui le sont, un
             * par un. Le dire évite de chercher une dérogation d'équipement qui
             * n'existe pas. */
            $device['why'] = $_decision['shown'] ? ($drawn > 0 ? '' : 'cmd') : $_decision['why'];
        }

        return $device;
    }

    /*
     * La santé d'un équipement, réduite à ce qui se dessine. Les cinq champs
     * sont ceux que le coeur écrit dans le même cache : « timeout » et
     * « lastCommunication » par eqLogic::checkAndUpdateCmd() (ligne 705) et le
     * veilleur eqLogic::checkAlive() (lignes 390-417), « warning » et
     * « danger » par cmd::actionAlertLevel() (core/class/cmd.class.php, ligne
     * 2651) qui n'y met que 0 ou 1, « battery » par eqLogic::batteryStatus()
     * (ligne 1228).
     *
     * Rien à émettre quand rien n'est renseigné : un équipement dont le plugin
     * ne tient aucun de ces compteurs — et il y en a — n'a pas à porter un
     * tableau de zéros dans la page.
     */
    private static function healthOf($_status) {
        $battery = isset($_status['battery']) ? $_status['battery'] : '';
        $comm = isset($_status['lastCommunication']) ? $_status['lastCommunication'] : '';
        $health = array(
            'timeout' => (isset($_status['timeout']) && $_status['timeout'] == 1) ? 1 : 0,
            'warning' => isset($_status['warning']) ? intval($_status['warning']) : 0,
            'danger'  => isset($_status['danger']) ? intval($_status['danger']) : 0,
            'battery' => ($battery === '' || $battery === null) ? null : intval($battery),
            'comm'    => ($comm === '' || $comm === null) ? null : $comm,
        );
        if ($health['timeout'] == 0 && $health['warning'] == 0 && $health['danger'] == 0
            && $health['battery'] === null && $health['comm'] === null) {
            return null;
        }
        return $health;
    }

    /*
     * Choisit la carte et distribue les rôles. Rendu public : c'est la règle la
     * plus facile à prendre en défaut sur une installation réelle, elle doit
     * pouvoir être vérifiée depuis un test sans construire tout un modèle.
     */
    public static function classify($_meta, $_byGeneric) {
        foreach (self::CARDS as $card => $roles) {
            $named = array();
            foreach ($roles as $role => $generics) {
                foreach ($generics as $generic) {
                    if (isset($_byGeneric[$generic])) {
                        $named[$role] = $_byGeneric[$generic];
                        break;
                    }
                }
            }
            $primary = array_intersect(array_keys($named), self::PRIMARY_ROLES);
            if (count($primary) > 0) {
                return array('card' => $card, 'named' => $named, 'roles' => array_values($named));
            }
        }

        /*
         * Rien de pilotable de connu. La distinction restante tient en une
         * question : l'équipement a-t-il quelque chose à commander ? Sinon c'est
         * un capteur, et il se dessine comme une liste de mesures. Sinon encore
         * c'est une carte générique, qui ne prétend rien comprendre et se
         * contente d'afficher proprement ce qu'elle trouve.
         */
        foreach ($_meta as $entry) {
            if ($entry['type'] == 'action' && $entry['visible']) {
                return array('card' => 'generic', 'named' => array(), 'roles' => array());
            }
        }
        return array('card' => 'sensor', 'named' => array(), 'roles' => array());
    }

    /*
     * Le nom du gabarit porte sa provenance : « core::line » vient du coeur,
     * « custom::… » et « customtemp::… » de la page Widgets, et tout autre
     * préfixe est l'identifiant d'un plugin. Seul ce dernier cas désigne un
     * rendu que son auteur a écrit pour cette commande précise.
     */
    private static function hasPluginWidget($_cmd) {
        $template = $_cmd->getTemplate('dashboard');
        if ($template == '' || strpos($template, '::') === false) {
            return false;
        }
        $prefix = substr($template, 0, strpos($template, '::'));
        return !in_array($prefix, array('core', 'custom', 'customtemp'));
    }

    /* « 1|Confort;2|Eco » -> [{value:'1', label:'Confort'}, ...] */
    private static function parseListValue($_listValue) {
        $return = array();
        foreach (explode(';', $_listValue) as $element) {
            if ($element === '') {
                continue;
            }
            $parts = explode('|', $element);
            $return[] = array(
                'value' => $parts[0],
                'label' => isset($parts[1]) ? $parts[1] : $parts[0],
            );
        }
        return $return;
    }

    /*
     * Le domaine, déduit des familles des types génériques présents. Sans
     * aucun type reconnu — la moitié des équipements d'une installation
     * ordinaire — l'équipement est rangé dans « information » : il dit
     * quelque chose sans rien piloter.
     */
    private static function domainOf($_meta) {
        static $families = null;
        if ($families === null) {
            $families = array();
            $config = jeedom::getConfiguration('cmd::generic_type');
            if (is_array($config)) {
                foreach ($config as $type => $definition) {
                    if (isset($definition['familyid'])) {
                        $families[$type] = $definition['familyid'];
                    }
                }
            }
        }

        $present = array();
        foreach ($_meta as $entry) {
            if ($entry['generic'] != '' && isset($families[$entry['generic']])) {
                $present[$families[$entry['generic']]] = true;
            }
        }
        foreach (self::DOMAINS as $domain => $keys) {
            foreach ($keys as $key) {
                if (isset($present[$key])) {
                    return $domain;
                }
            }
        }
        return 'info';
    }

    private static function categoryOf($_eqLogic) {
        $categories = $_eqLogic->getCategory();
        if (!is_array($categories)) {
            return '';
        }
        foreach (self::CATEGORIES as $category) {
            if (isset($categories[$category]) && $categories[$category] == 1) {
                return $category;
            }
        }
        return '';
    }
}

/*
 * Obligatoire même vide : le coeur instancie <plugin>Cmd par réflexion pour
 * toute commande du plugin. jeeGlow n'en crée aucune, mais son absence ferait
 * échouer le chargement de la classe au premier passage du coeur.
 */
class jeeglowbeCmd extends cmd {
}
