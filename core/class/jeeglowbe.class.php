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

    /* Catégories du coeur, par ordre de spécificité : la première cochée donne
     * sa teinte à la carte. 'default' est volontairement absente, elle ne dit
     * rien de plus que l'absence de catégorie. */
    const CATEGORIES = array('light', 'heating', 'opening', 'security', 'energy', 'multimedia', 'automatism');

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
        $rooms = array();
        $devices = array();
        $seen = array();

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
                $device = self::deviceModel($eqLogic, intval($object->getId()));
                if ($device === null) {
                    continue;
                }
                $devices[$device['id']] = $device;
                $seen[$device['id']] = true;
                $ids[] = $device['id'];
            }
            $rooms[] = array(
                'id'       => intval($object->getId()),
                'name'     => $object->getName(),
                'fatherId' => ($object->getFather_id() == '') ? 0 : intval($object->getFather_id()),
                'depth'    => intval($object->getConfiguration('parentNumber', 0)),
                'img'      => $object->getImgLink(),
                'devices'  => $ids,
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
                if ($eqLogic->getObject_id() != '' && $eqLogic->getObject_id() !== null) {
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
                $device = self::deviceModel($eqLogic, 0);
                if ($device === null) {
                    continue;
                }
                $devices[$device['id']] = $device;
                $orphans[] = $device['id'];
            }
            if (count($orphans) > 0) {
                $rooms[] = array(
                    'id'       => 0,
                    'name'     => __('Non classé', __FILE__),
                    'fatherId' => 0,
                    'depth'    => 0,
                    'img'      => '',
                    'devices'  => $orphans,
                );
            }
        }

        if (config::byKey('hideEmptyRooms', 'jeeglowbe', 1) == 1) {
            $rooms = array_values(array_filter($rooms, function ($_room) {
                return count($_room['devices']) > 0;
            }));
        }

        log::add('jeeglowbe', 'debug', 'modèle construit en ' . round((microtime(true) - $started) * 1000) . ' ms : '
            . count($rooms) . ' pièce(s), ' . count($devices) . ' équipement(s)');

        return array(
            'rooms'     => $rooms,
            'devices'   => $devices,
            'truncated' => (count($devices) >= self::MAX_DEVICES),
            'title'     => trim(config::byKey('title', 'jeeglowbe', '')),
        );
    }

    /*
     * Un équipement, tel que la page le dessinera. Deux passes sur ses
     * commandes : la première ne lit que des métadonnées et sert à choisir la
     * carte, la seconde ne relit la valeur que des commandes réellement
     * envoyées. Sur une installation d'un millier de commandes, la différence
     * est celle entre un dashboard qui s'ouvre et un dashboard qui rame.
     */
    private static function deviceModel($_eqLogic, $_roomId) {
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
            );
            if ($cmd->getSubType() == 'slider' || $cmd->getSubType() == 'numeric') {
                $entry['min'] = ($cmd->getConfiguration('minValue', '') === '') ? 0 : floatval($cmd->getConfiguration('minValue'));
                $entry['max'] = ($cmd->getConfiguration('maxValue', '') === '') ? 100 : floatval($cmd->getConfiguration('maxValue'));
            }
            if ($cmd->getConfiguration('listValue', '') != '') {
                $entry['list'] = self::parseListValue($cmd->getConfiguration('listValue'));
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
                    $entry['date'] = $objects[$id]->getValueDate();
                } catch (Throwable $e) {
                    $entry['value'] = null;
                    $entry['date'] = '';
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

        return array(
            'id'       => intval($_eqLogic->getId()),
            'name'     => $_eqLogic->getName(),
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
