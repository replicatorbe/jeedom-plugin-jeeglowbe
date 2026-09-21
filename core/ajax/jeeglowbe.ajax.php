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
        ajax::success(jeeglowbe::model($user));
    }

    throw new Exception(__('Aucune méthode correspondante à :', __FILE__) . ' ' . init('action'));
} catch (Throwable $e) {
    /* Throwable et non Exception : en PHP 8 une erreur de type n'est pas une
     * Exception, et la laisser filer rendrait un HTTP 500 muet côté page. */
    ajax::error(displayException($e), $e->getCode());
}
