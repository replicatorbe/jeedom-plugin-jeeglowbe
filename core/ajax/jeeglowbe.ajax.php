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

try {
    require_once __DIR__ . '/../../../../core/php/core.inc.php';
    include_file('core', 'authentification', 'php');

    /*
     * isConnect() sans argument, et non isConnect('admin') : le dashboard est
     * fait pour être consulté par les habitants de la maison, dont le compte
     * tablette au profil restreint. Une porte réservée aux administrateurs
     * rendrait la page inutilisable pour eux — le filtrage par droits a lieu
     * dans jeeglowbe::model(), équipement par équipement.
     */
    if (!isConnect()) {
        throw new Exception(__('401 - Accès non autorisé', __FILE__));
    }

    ajax::init();

    if (init('action') == 'model') {
        $user = isset($_SESSION['user']) ? $_SESSION['user'] : null;
        /* Le mode édition demande un modèle qui porte aussi ce qui est masqué.
         * Il n'est pas refusé aux autres, il leur est simplement sans effet :
         * model() revérifie le profil, et un dashboard ordinaire qui enverrait
         * reveal=1 recevrait le modèle ordinaire. */
        ajax::success(jeeglowbe::model($user, init('reveal') == 1));
    }

    /*
     * Les dérogations d'affichage. Écriture, donc administrateurs seulement,
     * comme le renommage et le rangement.
     *
     * Une seule action pour les cinq portées : c'est la même décision, prise
     * sur une cible plus ou moins large. Cinq actions auraient surtout donné
     * cinq contrôles de droits à tenir à jour ensemble.
     */
    if (init('action') == 'override') {
        if (!isConnect('admin')) {
            throw new Exception(__('401 - Accès non autorisé', __FILE__));
        }
        ajax::success(jeeglowbe::applyOverride(init('scope'), init('key'), init('state')));
    }

    /* Rétablir un équipement : sa dérogation et celles de ses commandes. */
    if (init('action') == 'resetDevice') {
        if (!isConnect('admin')) {
            throw new Exception(__('401 - Accès non autorisé', __FILE__));
        }
        ajax::success(jeeglowbe::resetDevice(init('id')));
    }

    /* Tout rétablir : jeeGlow ne décide plus rien. Appelé depuis la page de
     * configuration, où l'on va justement quand on ne sait plus ce qu'on a
     * masqué. */
    if (init('action') == 'resetAll') {
        if (!isConnect('admin')) {
            throw new Exception(__('401 - Accès non autorisé', __FILE__));
        }
        ajax::success(jeeglowbe::resetAll());
    }

    /*
     * Renommer écrit dans la configuration du plugin : réservé aux
     * administrateurs. Le contrôle est ici, et non dans la page, parce qu'une
     * porte ouverte côté serveur ne se referme pas en masquant un bouton.
     */
    if (init('action') == 'rename') {
        if (!isConnect('admin')) {
            throw new Exception(__('401 - Accès non autorisé', __FILE__));
        }
        $eqLogic = eqLogic::byId(init('id'));
        if (!is_object($eqLogic)) {
            throw new Exception(__('Équipement introuvable', __FILE__));
        }
        ajax::success(array(
            'id' => intval($eqLogic->getId()),
            'name' => jeeglowbe::rename($eqLogic->getId(), init('name')),
            'realName' => $eqLogic->getName(),
        ));
    }

    /*
     * Ranger un équipement dans une pièce. Réservé aux administrateurs, comme
     * toute écriture.
     *
     * save(true) : l'écriture est directe, sans déclencher les preSave et
     * postSave du plugin propriétaire. Changer d'objet est un attribut Jeedom,
     * pas une affaire de plugin ; faire tourner les hooks d'un plugin de caméra
     * ou d'aspirateur — qui peuvent parler au matériel ou reconstruire des
     * commandes — pour déplacer un équipement d'une pièce à l'autre serait un
     * risque pris pour rien.
     */
    if (init('action') == 'setRoom') {
        if (!isConnect('admin')) {
            throw new Exception(__('401 - Accès non autorisé', __FILE__));
        }
        $eqLogic = eqLogic::byId(init('id'));
        if (!is_object($eqLogic)) {
            throw new Exception(__('Équipement introuvable', __FILE__));
        }
        $roomId = init('room');
        if ($roomId === '' || intval($roomId) <= 0) {
            $eqLogic->setObject_id(null);
        } else {
            $object = jeeObject::byId($roomId);
            if (!is_object($object)) {
                throw new Exception(__('Pièce introuvable', __FILE__));
            }
            $eqLogic->setObject_id($object->getId());
        }
        $eqLogic->save(true);
        ajax::success(array(
            'id' => intval($eqLogic->getId()),
            'room' => ($eqLogic->getObject_id() == '') ? 0 : intval($eqLogic->getObject_id()),
        ));
    }

    /*
     * Lancer un scénario. Le contrôle de droit est ici et nulle part ailleurs :
     * jeeglowbe::model() n'envoie que les scénarios exécutables, mais une liste
     * filtrée n'est pas une porte fermée — l'identifiant d'un scénario se
     * devine, et core/ajax/scenario.ajax.php oppose exactement le même
     * hasRight('x') à son action « changeState ».
     *
     * Les trois étiquettes reprennent celles du coeur (scenario.ajax.php,
     * lignes 42-44) : sans elles le journal du scénario dit qu'il s'est lancé
     * tout seul, alors que quelqu'un a appuyé. launch(false) laisse le mode de
     * lancement au scénario, qui sait s'il doit tourner en synchrone
     * (core/class/scenario.class.php, ligne 835).
     */
    if (init('action') == 'scenario') {
        $scenario = scenario::byId(init('id'));
        if (!is_object($scenario)) {
            throw new Exception(__('Scénario introuvable', __FILE__));
        }
        $user = isset($_SESSION['user']) ? $_SESSION['user'] : null;
        if (!$scenario->hasRight('x', $user)) {
            throw new Exception(__('401 - Accès non autorisé', __FILE__));
        }
        /* Un seul état pour l'instant. Refuser les autres nommément, plutôt que
         * de les ignorer en silence : une page qui demanderait « stop » verrait
         * sinon une réponse de succès et un scénario qui tourne toujours. */
        if (init('state') != 'start') {
            throw new Exception(__('État de scénario non géré :', __FILE__) . ' ' . init('state'));
        }
        if ($scenario->getIsActive() != 1) {
            throw new Exception(__('Impossible de lancer le scénario car il est désactivé', __FILE__));
        }
        $scenario->addTag('trigger', 'user');
        $scenario->addTag('trigger_value', is_object($user) ? $user->getLogin() : '');
        $scenario->addTag('trigger_message', $GLOBALS['JEEDOM_SCLOG_TEXT']['startManual']['txt']);
        /* launch() rend false quand les scénarios sont coupés dans la
         * configuration de Jeedom : rien n'est lancé, et répondre « ok » ferait
         * croire le contraire. */
        if ($scenario->launch(false) === false) {
            throw new Exception(__('Impossible de lancer le scénario car les scénarios sont désactivés dans Jeedom', __FILE__));
        }
        ajax::success(array(
            'id' => intval($scenario->getId()),
            /* L'état relu après coup, et non « start » supposé : en mode
             * asynchrone launch() ne fait que poser « starting » dans le cache
             * et rendre la main, et c'est ce que la page doit afficher. */
            'state' => $scenario->getState(),
        ));
    }

    throw new Exception(__('Aucune méthode correspondante à :', __FILE__) . ' ' . init('action'));
} catch (Throwable $e) {
    /* Throwable et non Exception : en PHP 8 une erreur de type n'est pas une
     * Exception, et la laisser filer rendrait un HTTP 500 muet côté page. */
    ajax::error(displayException($e), $e->getCode());
}
