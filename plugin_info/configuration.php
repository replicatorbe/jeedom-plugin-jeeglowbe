<?php
if (!isConnect('admin')) {
	throw new Exception('{{401 - Accès non autorisé}}');
}

/* Le compte des décisions déjà prises. Un réglage qui vit ailleurs — dans le
 * dashboard, carte par carte — doit au moins dire ici combien il pèse : sans
 * ce nombre, « tout rétablir » propose d'annuler on ne sait quoi. */
/* class_exists : la page de configuration ne doit jamais tomber en erreur
 * fatale. Un plugin dont la classe ne se charge pas laisserait sinon une
 * fenêtre blanche, sans même le moyen de le désactiver. */
$jgOverrides = class_exists('jeeglowbe') ? jeeglowbe::overrides() : array();
$jgCount = 0;
foreach ($jgOverrides as $jgScope) {
	$jgCount += count($jgScope);
}
?>
<form class="form-horizontal">
	<fieldset>
		<legend><i class="fas fa-tv"></i> {{Dashboard}}</legend>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Titre affiché}}</label>
			<div class="col-md-3">
				<input class="configKey form-control" data-l1key="title" placeholder="jeeGlow">
			</div>
			<div class="col-md-5">
				<span class="help-block" style="margin:0;">{{Nom affiché en haut du dashboard. Vide, c'est « jeeGlow ».}}</span>
			</div>
		</div>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Ambiance}}</label>
			<div class="col-md-3">
				<select class="configKey form-control" data-l1key="tone">
					<option value="auto">{{Suivre Jeedom}}</option>
					<option value="light">{{Toujours clair}}</option>
					<option value="dark">{{Toujours sombre}}</option>
				</select>
			</div>
			<div class="col-md-5">
				<span class="help-block" style="margin:0;">{{jeeGlow mesure la luminosité du thème de Jeedom et s'y accorde, y compris quand le thème bascule en cours de journée. Imposer une ambiance rend le dashboard sombre sur un Jeedom resté clair — ce que veut souvent une tablette murale — et le thème de Jeedom ne le ramènera plus. L'atténuation de nuit du mode kiosque, elle, s'applique dans les deux cas.}}</span>
			</div>
		</div>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Noms courts}}</label>
			<div class="col-md-1">
				<input type="checkbox" class="configKey" data-l1key="shortNames" checked>
			</div>
			<div class="col-md-7">
				<span class="help-block" style="margin:0;">{{Retire des noms affichés les identifiants matériels et ce qui précède un tiret : « OpenMQTTGateway 1629AC — OMG_ESP32_BLE_SALON » devient « OMG_ESP32_BLE_SALON ». N'affecte que l'affichage dans jeeGlow, jamais le nom dans Jeedom, et un nom donné à la main l'emporte toujours.}}</span>
			</div>
		</div>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Afficher les équipements sans objet}}</label>
			<div class="col-md-1">
				<input type="checkbox" class="configKey" data-l1key="showUnassigned" checked>
			</div>
			<div class="col-md-7">
				<span class="help-block" style="margin:0;">{{Les équipements qui n'appartiennent à aucun objet sont regroupés dans une pièce « Non classé ». Les masquer donne un dashboard plus propre, mais fait oublier qu'ils existent.}}</span>
			</div>
		</div>
	</fieldset>
	<fieldset>
		<legend><i class="fas fa-eye-slash"></i> {{Ce que jeeGlow affiche}}</legend>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Décisions en cours}}</label>
			<div class="col-md-3">
				<span class="label label-info" style="font-size:14px;"><?php echo $jgCount; ?></span>
				<a class="btn btn-warning btn-sm" id="bt_jeeglowbeResetAll" style="margin-left:8px;<?php echo ($jgCount == 0) ? 'display:none;' : ''; ?>">
					<i class="fas fa-undo"></i> {{Tout rétablir}}
				</a>
			</div>
			<div class="col-md-5">
				<span class="help-block" style="margin:0;">{{jeeGlow peut masquer une carte, un élément d'une carte, tout un plugin ou toute une pièce — sans rien changer au dashboard d'origine, qui continue d'afficher ce que Jeedom lui donne. Ces décisions se prennent dans le dashboard lui-même, par le bouton de réglage en haut à droite. Ce qui n'a jamais été décidé suit Jeedom, aujourd'hui et plus tard. « Tout rétablir » efface les décisions, toutes, et jeeGlow réaffiche exactement ce que Jeedom prévoit.}}</span>
			</div>
		</div>
	</fieldset>
	<fieldset>
		<legend><i class="fas fa-tablet-alt"></i> {{Mode kiosque}}</legend>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Démarrer en kiosque}}</label>
			<div class="col-md-1">
				<input type="checkbox" class="configKey" data-l1key="kioskStart">
			</div>
			<div class="col-md-7">
				<span class="help-block" style="margin:0;">{{jeeGlow s'ouvre directement sans le menu ni la barre du haut de Jeedom, sur tous les appareils. Le bouton en haut à droite du dashboard reste maître sur l'appareil où on s'en sert : ce qu'on y choisit est retenu et l'emporte sur ce réglage.}}</span>
			</div>
		</div>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Retour à l'accueil après}}</label>
			<div class="col-md-2">
				<input type="number" min="0" max="240" class="configKey form-control" data-l1key="kioskIdle" placeholder="0">
			</div>
			<div class="col-md-5">
				<span class="help-block" style="margin:0;">{{Minutes d'inactivité au bout desquelles une tablette revient à l'accueil. 0 pour ne jamais revenir. Ne s'applique qu'en mode kiosque.}}</span>
			</div>
		</div>
		<div class="form-group">
			<label class="col-md-4 control-label">{{Atténuation de nuit}}</label>
			<div class="col-md-2">
				<input type="number" min="0" max="70" class="configKey form-control" data-l1key="kioskDim" placeholder="0">
			</div>
			<div class="col-md-5">
				<span class="help-block" style="margin:0;">{{Pourcentage d'assombrissement de l'écran la nuit, de 0 à 70. Les heures de nuit sont celles que vous avez données à Jeedom pour changer de thème.}}</span>
			</div>
		</div>
	</fieldset>
</form>

<script>
/* Le rétablissement général. Une confirmation d'abord : le geste est bref, ce
 * qu'il défait peut représenter une demi-heure de réglages. */
document.getElementById('bt_jeeglowbeResetAll').addEventListener('click', function () {
	var bouton = this
	if (!window.confirm('{{Effacer toutes les décisions d\'affichage de jeeGlow ? Le dashboard réaffichera ce que Jeedom prévoit.}}')) {
		return
	}
	var form = new FormData()
	form.append('action', 'resetAll')
	fetch('plugins/jeeglowbe/core/ajax/jeeglowbe.ajax.php', {
		method: 'POST', body: form, credentials: 'same-origin'
	}).then(function (reponse) {
		return reponse.json()
	}).then(function (data) {
		if (!data || data.state !== 'ok') {
			throw new Error('')
		}
		bouton.style.display = 'none'
		bouton.parentNode.querySelector('.label').textContent = '0'
		if (typeof jeedomUtils !== 'undefined' && jeedomUtils.showAlert) {
			jeedomUtils.showAlert({ message: '{{jeeGlow réaffiche ce que Jeedom prévoit.}}', level: 'success' })
		}
	}).catch(function () {
		if (typeof jeedomUtils !== 'undefined' && jeedomUtils.showAlert) {
			jeedomUtils.showAlert({ message: '{{Le rétablissement a échoué.}}', level: 'danger' })
		}
	})
})
</script>
