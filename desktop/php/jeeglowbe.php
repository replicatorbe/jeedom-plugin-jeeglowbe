<?php
/*
 * Le dashboard jeeGlow.
 *
 * isConnect() sans argument : cette page n'est pas une page d'administration,
 * c'est celle que l'on regarde tous les jours. Le compte tablette au profil
 * restreint doit pouvoir l'ouvrir ; ce qu'il a le droit de voir est décidé
 * équipement par équipement dans jeeglowbe::model().
 *
 * Le modèle est rendu ici, en PHP, plutôt que demandé en ajax au chargement :
 * la page s'affiche remplie du premier coup, sans écran vide ni aller-retour,
 * et les droits sont appliqués avant que quoi que ce soit ne parte au
 * navigateur.
 */
if (!isConnect()) {
	throw new Exception('{{401 - Accès non autorisé}}');
}

$jeeglowbeUser = isset($_SESSION['user']) ? $_SESSION['user'] : null;
sendVarToJS('jeeglowbeModel', jeeglowbe::model($jeeglowbeUser));
?>

<div id="jg-root" class="jg-root" data-kiosk="0" data-tone="light" data-view="functions" data-panel="0">

	<script>
		/* L'ambiance est posée ici, pendant l'analyse de la page, et non dans
		 * jeeglowbe.js qui est chargé à la fin : sur un Jeedom en thème sombre,
		 * l'écart suffirait à faire apparaître un dashboard blanc le temps d'un
		 * battement de cil. Le script qui suit se contente d'entretenir la
		 * valeur quand le thème change. */
		(function () {
			var root = document.getElementById('jg-root')
			var raw = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim()
			var parts = raw.split(',').map(function (part) { return parseInt(part, 10) })
			if (parts.length < 3 || parts.some(isNaN)) {
				return
			}
			var luminance = (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255
			root.dataset.tone = (luminance < 0.5) ? 'dark' : 'light'
		})()
	</script>

	<!-- Le rail des vues. Sur téléphone il descend en barre basse : c'est la
	     même liste, au même endroit dans le document, déplacée par la CSS. -->
	<nav class="jg-rail" id="jg-rail" aria-label="{{Vues}}"></nav>

	<div class="jg-main">
		<!-- Un div, et surtout pas un header : la règle du coeur en mode plein
		     écran est « body.fullscreen header { display: none } », un sélecteur de
		     type qui frappe n'importe quel header descendant. Notre barre
		     disparaîtrait donc en kiosque, emportant avec elle le seul bouton
		     permettant d'en sortir. -->
		<div class="jg-topbar">
			<div class="jg-brand">
				<i class="fas fa-circle-notch jg-brand-mark"></i>
				<span class="jg-brand-name"></span>
			</div>
			<div class="jg-topbar-tools">
				<label class="jg-search">
					<i class="fas fa-search"></i>
					<input type="search" id="jg-search" placeholder="{{Rechercher}}" autocomplete="off">
				</label>
				<button type="button" class="jg-icon-btn" id="jg-fullscreen" title="{{Plein écran}}">
					<i class="fas fa-expand"></i>
				</button>
			</div>
		</div>

		<nav class="jg-subtabs" id="jg-subtabs" hidden></nav>

		<main class="jg-sections" id="jg-sections"></main>

		<div class="jg-empty" id="jg-empty" hidden>
			<i class="far fa-compass"></i>
			<p class="jg-empty-title">{{Rien à afficher pour le moment}}</p>
			<p class="jg-empty-hint">{{jeeGlow lit les équipements visibles et actifs de vos objets. Vérifiez qu'au moins un équipement est visible, ou élargissez votre recherche.}}</p>
		</div>
	</div>

	<div class="jg-panel-backdrop" id="jg-panel-backdrop" hidden></div>

	<aside class="jg-panel" id="jg-panel" hidden aria-label="{{Détail de l'équipement}}">
		<div class="jg-panel-head">
			<span class="jg-panel-title"></span>
			<button type="button" class="jg-icon-btn" id="jg-panel-close" title="{{Fermer}}">
				<i class="fas fa-times"></i>
			</button>
		</div>
		<div class="jg-panel-body" id="jg-panel-body"></div>
	</aside>

</div>

<?php include_file('desktop', 'jeeglowbe', 'css', 'jeeglowbe'); ?>
<?php include_file('desktop', 'jeeglowbe', 'js', 'jeeglowbe'); ?>
