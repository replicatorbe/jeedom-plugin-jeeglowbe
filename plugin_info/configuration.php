<?php
if (!isConnect('admin')) {
	throw new Exception('{{401 - Accès non autorisé}}');
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
