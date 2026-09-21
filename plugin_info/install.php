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
 * jeeGlow ne crée rien et ne migre rien : il lit. L'installation se limite donc
 * à poser les réglages par défaut, une fois, pour que la page de configuration
 * ne s'ouvre pas sur des champs vides dont personne ne sait ce qu'ils valent.
 */
function jeeglowbe_install() {
    /* config::byKey() ne renvoie jamais null sur une clé absente : elle place le
     * défaut en cache puis retourne '' parce que isset() est faux sur null. Le
     * test doit donc porter sur la chaîne vide, sans quoi la valeur par défaut
     * n'est jamais écrite et la fonction ne sert à rien. */
    if (config::byKey('showUnassigned', 'jeeglowbe', '') === '') {
        config::save('showUnassigned', 1, 'jeeglowbe');
    }
}

function jeeglowbe_update() {
    jeeglowbe_install();
}

/*
 * Rien à retirer : aucun équipement, aucune commande, aucun fichier produit à
 * l'exécution. Les clés de configuration du plugin sont supprimées par le coeur
 * avec le plugin lui-même.
 */
function jeeglowbe_remove() {
}
