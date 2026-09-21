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
			<label class="col-md-4 control-label">{{Afficher les équipements sans objet}}</label>
			<div class="col-md-1">
				<input type="checkbox" class="configKey" data-l1key="showUnassigned" checked>
			</div>
			<div class="col-md-7">
				<span class="help-block" style="margin:0;">{{Les équipements qui n'appartiennent à aucun objet sont regroupés dans une pièce « Non classé ». Les masquer donne un dashboard plus propre, mais fait oublier qu'ils existent.}}</span>
			</div>
		</div>
	</fieldset>
</form>
