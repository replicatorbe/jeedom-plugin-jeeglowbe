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

    /* Un modèle complet coûte une lecture de cache par commande renvoyée. Au
     * delà de ce seuil on n'a plus affaire à un dashboard mais à un inventaire :
     * on tronque, et la page le dit. */
    const MAX_DEVICES = 400;

    /*
     * Le modèle envoyé à la page : des pièces, des équipements, et pour chacun
     * la carte à dessiner. Tout le filtrage de droits a lieu ici, une fois, côté
     * serveur ; le navigateur ne reçoit jamais ce que l'utilisateur n'a pas le
     * droit de voir.
     *
     * $_user est l'utilisateur de la session. Passé à null (appel en ligne de
     * commande, test), aucun filtre par équipement n'est appliqué.
     */
    public static function model($_user = null) {
        $started = microtime(true);
        self::$_aliases = self::aliases();
        self::$_shortNames = (config::byKey('shortNames', 'jeeglowbe', 1) == 1);
        $rooms = array();
        $devices = array();

        foreach (jeeObject::buildTree(null, true) as $object) {
            /* Une pièce masquée du dashboard d'origine le reste ici : jeeGlow
             * change la présentation, pas les intentions déjà exprimées. */
            if ($object->getConfiguration('hideOnDashboard', 0) == 1) {
                continue;
            }
            /* buildTree() a déjà écarté les objets interdits, mais en
             * s'appuyant sur la session. Le contrôle est refait avec
             * l'utilisateur reçu : ainsi le modèle est juste même appelé hors
             * d'une session — depuis un test, une tâche, un autre plugin. */
            if (is_object($_user) && !$object->hasRight('r', $_user)) {
                continue;
            }
            $ids = array();
            foreach ($object->getEqLogic(true, true) as $eqLogic) {
                if (is_object($_user) && !$eqLogic->hasRight('r', $_user)) {
                    continue;
                }
                if (count($devices) >= self::MAX_DEVICES) {
                    break;
                }
                $device = self::deviceModel($eqLogic, intval($object->getId()), $_user);
                if ($device === null) {
                    continue;
                }
                $devices[$device['id']] = $device;
                $ids[] = $device['id'];
            }
            /* Seulement ce que la page dessine. La hiérarchie des objets et leur
             * image ont l'air utiles, mais personne ne les lit : les calculer
             * coûte une lecture de fichier par pièce et grossit le modèle. */
            $rooms[] = array(
                'id'      => intval($object->getId()),
                'name'    => $object->getName(),
                'devices' => $ids,
            );
        }

        /*
         * Les équipements sans pièce. Les ignorer serait le plus simple, mais
         * c'est justement ce qui fait qu'on ne les range jamais : une
         * installation vivante en compte toujours, et un dashboard qui les
         * escamote laisse croire qu'ils n'existent pas.
         */
        if (config::byKey('showUnassigned', 'jeeglowbe', 1) == 1) {
            $orphans = array();
            foreach (eqLogic::all() as $eqLogic) {
                /* Le coeur reconnaît deux façons de n'avoir aucun objet :
                 * eqLogic::byObjectId() interroge « object_id IS NULL OR
                 * object_id = -1 ». Ne tester que la chaîne vide laissait les
                 * seconds nulle part — ni dans une pièce, ni dans « Non classé ». */
                $objectId = $eqLogic->getObject_id();
                if ($objectId !== null && $objectId !== '' && intval($objectId) > 0) {
                    continue;
                }
                if ($eqLogic->getIsEnable() != 1 || $eqLogic->getIsVisible() != 1) {
                    continue;
                }
                if (is_object($_user) && !$eqLogic->hasRight('r', $_user)) {
                    continue;
                }
                if (count($devices) >= self::MAX_DEVICES) {
                    break;
                }
                $device = self::deviceModel($eqLogic, 0, $_user);
                if ($device === null) {
                    continue;
                }
                $devices[$device['id']] = $device;
                $orphans[] = $device['id'];
            }
            if (count($orphans) > 0) {
                $rooms[] = array(
                    'id'      => 0,
                    'name'    => __('Non classé', __FILE__),
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

        log::add('jeeglowbe', 'debug', 'modèle construit en ' . round((microtime(true) - $started) * 1000) . ' ms : '
            . count($rooms) . ' pièce(s), ' . count($devices) . ' équipement(s)');

        return array(
            'rooms'     => $rooms,
            'devices'   => $devices,
            'truncated' => (count($devices) >= self::MAX_DEVICES),
            'title'     => trim(config::byKey('title', 'jeeglowbe', '')),
            /* Renommer touche à la configuration du plugin : réservé aux
             * administrateurs, comme toute écriture. */
            'admin'     => (is_object($_user) && $_user->getProfils() == 'admin'),
            'kiosk'     => self::kioskSettings(),
            /* Toutes les pièces, y compris celles qui n'ont encore aucun
             * équipement : c'est justement là qu'on veut pouvoir ranger. */
            'objects'   => self::objectList($_user),
            /* La langue de Jeedom, et non celle du navigateur : une tablette
             * murale livrée en anglais afficherait « Monday, September 21 » sur
             * une installation entièrement française. Le format BCP 47 attendu
             * par Intl s'obtient en remplaçant le souligné. */
            'lang'      => str_replace('_', '-', config::byKey('language', 'core', 'fr_FR')),
        );
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
     * Un équipement, tel que la page le dessinera. Deux passes sur ses
     * commandes : la première ne lit que des métadonnées et sert à choisir la
     * carte, la seconde ne relit la valeur que des commandes réellement
     * envoyées. Sur une installation d'un millier de commandes, la différence
     * est celle entre un dashboard qui s'ouvre et un dashboard qui rame.
     */
    private static function deviceModel($_eqLogic, $_roomId, $_user = null) {
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
            $entry = array(
                'id'      => intval($cmd->getId()),
                'name'    => $cmd->getName(),
                'type'    => $cmd->getType(),
                'subType' => $cmd->getSubType(),
                'unit'    => $cmd->getUnite(),
                'generic' => $cmd->getGeneric_type(),
                'visible' => ($cmd->getIsVisible() == 1),
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
                $entry['widget'] = true;
            }
            if ($entry['type'] == 'action' && !$canExecute) {
                continue;
            }
            $meta[$entry['id']] = $entry;
            $objects[$entry['id']] = $cmd;
            if ($entry['generic'] != '' && !isset($byGeneric[$entry['generic']])) {
                $byGeneric[$entry['generic']] = $entry['id'];
            }
        }
        if (count($meta) == 0) {
            return null;
        }

        $classification = self::classify($meta, $byGeneric);

        /* Ne sont envoyées que les commandes utiles : celles qui tiennent un
         * rôle dans la carte, et celles que l'utilisateur a rendues visibles. Le
         * reste — commandes de diagnostic, rafraîchissements internes — n'a rien
         * à faire sur un dashboard. */
        $keep = $classification['roles'];
        $cmds = array();
        foreach ($meta as $id => $entry) {
            if (!$entry['visible'] && !in_array($id, $keep)) {
                continue;
            }
            if ($entry['type'] == 'info') {
                try {
                    $entry['value'] = $objects[$id]->execCmd();
                } catch (Throwable $e) {
                    $entry['value'] = null;
                }
            }
            $cmds[] = $entry;
        }

        /* Un équipement dont toutes les commandes sont masquées et qui ne tient
         * aucun rôle n'a rien à montrer : une carte vide porterait son nom et
         * un tiret. C'est du bruit, pas une information. */
        if (count($cmds) == 0) {
            return null;
        }

        $battery = '';
        try {
            $battery = $_eqLogic->getStatus('battery', '');
        } catch (Throwable $e) {
            $battery = '';
        }

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

        return array(
            'id'       => $id,
            'name'     => $shown,
            'realName' => ($shown !== $real) ? $real : '',
            'domain'   => self::domainOf($meta),
            'roomId'   => $_roomId,
            'eqType'   => $_eqLogic->getEqType_name(),
            'category' => self::categoryOf($_eqLogic),
            'order'    => intval($_eqLogic->getOrder()),
            'battery'  => ($battery === '' || $battery === null) ? null : intval($battery),
            'card'     => $classification['card'],
            'roles'    => $classification['named'],
            'cmds'     => $cmds,
        );
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
