<?php
/* Fabrique l'icône du plugin.
 *
 *   php tools/make-icon.php
 *
 * Dessinée ici plutôt que déposée en binaire opaque : trois couleurs et quatre
 * formes, qu'on peut relire et refaire.
 *
 * Le sujet est la lueur : un point chaud et ses halos sur un fond de nuit,
 * parce que c'est ce que fait le plugin — rallumer une interface. À la taille du
 * menu de Jeedom, une trentaine de pixels, il ne reste de toute icône qu'une
 * silhouette et une couleur : celles-ci survivent.
 *
 * Dessin en 1024 puis réduction en 256 : GD n'anticrénèle pas les arcs, la
 * réduction s'en charge.
 */

const TAILLE = 256;
const ECHELLE = 4;

$grand = imagecreatetruecolor(TAILLE * ECHELLE, TAILLE * ECHELLE);
imagesavealpha($grand, true);
imagealphablending($grand, false);
imagefill($grand, 0, 0, imagecolorallocatealpha($grand, 0, 0, 0, 127));
imagealphablending($grand, true);

$e = function ($_valeur) { return (int) round($_valeur * ECHELLE); };

$nuit = imagecolorallocate($grand, 0x1B, 0x20, 0x2B);

/* Fond : carré aux angles arrondis, comme les autres plugins du dossier. */
$rayon = 44;
imagefilledrectangle($grand, $e($rayon), 0, $e(TAILLE - $rayon), $e(TAILLE), $nuit);
imagefilledrectangle($grand, 0, $e($rayon), $e(TAILLE), $e(TAILLE - $rayon), $nuit);
foreach (array(array($rayon, $rayon), array(TAILLE - $rayon, $rayon),
               array($rayon, TAILLE - $rayon), array(TAILLE - $rayon, TAILLE - $rayon)) as $coin) {
    imagefilledarc($grand, $e($coin[0]), $e($coin[1]), $e($rayon * 2), $e($rayon * 2), 0, 360, $nuit, IMG_ARC_PIE);
}

/* Les halos : une rampe continue du fond de nuit vers l'or. Quatre cercles
 * laissaient voir des anneaux, et une icône de plugin ne doit pas ressembler à
 * une cible. Seize pas suffisent à ce que l'oeil n'en distingue plus aucun. */
$fond = array(0x1B, 0x20, 0x2B);
$lueur = array(0xFF, 0xB8, 0x45);
for ($pas = 16; $pas >= 1; $pas--) {
    $rayon = 24 + $pas * 5.5;
    /* Progression quadratique : la lumière décroît vite en s'éloignant, une
     * rampe linéaire donnerait un disque plat. */
    $part = pow(1 - ($pas / 16), 2.2);
    $couleur = imagecolorallocate($grand,
        (int) round($fond[0] + ($lueur[0] - $fond[0]) * $part),
        (int) round($fond[1] + ($lueur[1] - $fond[1]) * $part),
        (int) round($fond[2] + ($lueur[2] - $fond[2]) * $part));
    imagefilledarc($grand, $e(TAILLE / 2), $e(TAILLE / 2), $e($rayon * 2), $e($rayon * 2), 0, 360, $couleur, IMG_ARC_PIE);
}

/* Le coeur lumineux. */
$or = imagecolorallocate($grand, 0xFF, 0xC4, 0x5C);
$blanc = imagecolorallocate($grand, 0xFF, 0xF2, 0xD6);
imagefilledarc($grand, $e(TAILLE / 2), $e(TAILLE / 2), $e(48), $e(48), 0, 360, $or, IMG_ARC_PIE);
imagefilledarc($grand, $e(TAILLE / 2 - 4), $e(TAILLE / 2 - 5), $e(20), $e(20), 0, 360, $blanc, IMG_ARC_PIE);

$petit = imagecreatetruecolor(TAILLE, TAILLE);
imagesavealpha($petit, true);
imagealphablending($petit, false);
imagefill($petit, 0, 0, imagecolorallocatealpha($petit, 0, 0, 0, 127));
imagecopyresampled($petit, $grand, 0, 0, 0, 0, TAILLE, TAILLE, TAILLE * ECHELLE, TAILLE * ECHELLE);

imagepng($petit, __DIR__ . '/../plugin_info/jeeglowbe_icon.png');
echo "plugin_info/jeeglowbe_icon.png écrit\n";
