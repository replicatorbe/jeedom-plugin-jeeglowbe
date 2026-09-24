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

require_once __DIR__ . '/../../../core/php/core.inc.php';

/*
 * jeeGlow ne crée rien et ne migre rien : il lit. Les réglages par défaut vivent
 * dans core/config/jeeglowbe.config.ini, que le coeur consulte pour toute clé
 * absente de la base : rien à écrire ici. Les installations qui ont déjà une
 * valeur en base la gardent, puisque la base l'emporte sur le fichier.
 */
function jeeglowbe_install() {
}

function jeeglowbe_update() {
}

/*
 * Rien à retirer : aucun équipement, aucune commande, aucun fichier produit à
 * l'exécution. Les clés de configuration du plugin sont supprimées par le coeur
 * avec le plugin lui-même.
 */
function jeeglowbe_remove() {
}
