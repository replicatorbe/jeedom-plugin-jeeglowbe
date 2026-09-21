<?php
/* Exporte le modèle que la page enverrait au navigateur.
 *
 *   install -m 644 tools/dump-model.php /tmp/jeeglowbe-dump.php
 *   sudo -u www-data php /tmp/jeeglowbe-dump.php > /tmp/jeeglowbe-model.json
 *
 * Le détour par /tmp n'est pas une coquetterie : www-data n'a pas accès au
 * dossier personnel du développeur, et lancer le script depuis le dépôt échoue
 * sur un « Could not open input file » qui ne dit pas pourquoi.
 *
 * www-data est indispensable : les valeurs des commandes vivent dans le cache
 * fichier de Jeedom, que l'utilisateur de développement ne peut pas lire. Sans
 * cela le modèle sort complet mais entièrement vide, ce qui ressemble beaucoup
 * à un bug du plugin.
 *
 * La session est simulée parce que jeeObject::hasRight() la consulte : sans
 * elle, buildTree() ne renvoie aucun objet et le modèle paraît désert.
 */

/* tools/ n'est pas déployé : ce script tourne donc depuis le dépôt, où le
 * chemin relatif vers le coeur ne mène nulle part. La racine de Jeedom est
 * nommée, et surchargeable comme pour l'outil de déploiement. */
$racine = getenv('JEEDOM_ROOT');
if ($racine === false || $racine === '') {
    $racine = '/var/www/html';
}
require_once $racine . '/core/php/core.inc.php';

/* La classe est chargée depuis l'installation, par l'autoload du coeur : c'est
 * le code réellement en service que l'on veut mesurer, pas celui du dépôt. */
if (!class_exists('jeeglowbe')) {
    fwrite(STDERR, "Le plugin jeeglowbe n'est pas installé dans $racine, ou n'est pas actif.\n");
    exit(1);
}

$login = isset($argv[1]) ? $argv[1] : 'admin';
$user = user::byLogin($login);
if (!is_object($user)) {
    fwrite(STDERR, "Utilisateur introuvable : $login\n");
    exit(1);
}
$_SESSION['user'] = $user;

echo json_encode(jeeglowbe::model($user), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
