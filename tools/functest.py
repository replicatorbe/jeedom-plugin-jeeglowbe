#!/usr/bin/env python3
"""Banc d'essai du dashboard, hors de Jeedom.

    install -m 644 tools/dump-model.php /tmp/jeeglowbe-dump.php
    sudo -u www-data php /tmp/jeeglowbe-dump.php > /tmp/jeeglowbe-model.json
    python3 tools/functest.py /tmp/jeeglowbe-model.json /tmp/jeeglow
    chromium --headless=new --no-sandbox --disable-gpu --virtual-time-budget=8000 \
        --dump-dom file:///tmp/jeeglow/functest.html | grep -o 'ECHEC[^<]*'

Il n'y a pas de node sur la machine de développement, et une page de plugin ne
s'ouvre pas sans session Jeedom : ce script fabrique une page autonome à partir
des VRAIS fichiers du plugin — le balisage de desktop/php/jeeglowbe.php, la
CSS, le JS — et du vrai modèle de l'installation. jeedom.cmd.execute() est
bouchonné, si bien qu'on peut appuyer sur les cartes sans rien allumer.

Deux pages sont écrites :

  functest.html  joue une quarantaine de gestes et vérifie le DOM après chacun.
                 Le résultat est dans <pre id="results">. Y figure notamment le
                 rechargement de page façon Jeedom, qui ré-exécute le script :
                 c'est le scénario qui a déjà cassé le dashboard une fois.
  preview.html   la même page, sans assertions, pour la regarder ou la
                 photographier (--screenshot).

Les valeurs manquantes sont comblées et cinq équipements de démonstration sont
ajoutés — lumière, bascule, volet, capteur, prise — parce qu'une installation
réelle n'a pas forcément un exemplaire de chaque carte, et qu'on veut quand
même les voir.
"""

import json
import os
import pathlib
import random
import re
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
JEEDOM = os.environ.get('JEEDOM_ROOT', '/var/www/html')


def cmd(cid, name, ctype, sub, generic, value=None, unit='', extra=None):
    entry = {'id': cid, 'name': name, 'type': ctype, 'subType': sub, 'unit': unit,
             'generic': generic, 'visible': True, 'invert': False}
    if value is not None:
        entry['value'] = value
    if extra:
        entry.update(extra)
    return entry


DEMOS = [
    {'id': 90001, 'name': 'Plafonnier salon', 'roomId': 9001, 'eqType': 'demo', 'category': 'light',
     'order': 0, 'battery': None, 'card': 'light', 'domain': 'light',
     'roles': {'state': 90011, 'on': 90012, 'off': 90013, 'slider': 90014},
     'cmds': [cmd(90011, 'État', 'info', 'binary', 'LIGHT_STATE', 1),
              cmd(90012, 'On', 'action', 'other', 'LIGHT_ON'),
              cmd(90013, 'Off', 'action', 'other', 'LIGHT_OFF'),
              cmd(90014, 'Luminosité', 'action', 'slider', 'LIGHT_SLIDER', extra={'min': 0, 'max': 100}),
              cmd(90015, 'Puissance', 'info', 'numeric', 'POWER', 42.5, 'W')]},
    {'id': 90002, 'name': 'Lampe bureau', 'roomId': 9001, 'eqType': 'demo', 'category': 'light',
     'order': 1, 'battery': None, 'card': 'light', 'domain': 'light',
     'roles': {'state': 90021, 'toggle': 90022},
     'cmds': [cmd(90021, 'État', 'info', 'binary', 'LIGHT_STATE', 0),
              cmd(90022, 'Basculer', 'action', 'other', 'LIGHT_TOGGLE')]},
    {'id': 90003, 'name': 'Volet salon', 'roomId': 9001, 'eqType': 'demo', 'category': 'opening',
     'order': 2, 'battery': 18, 'card': 'cover', 'domain': 'cover',
     'roles': {'state': 90031, 'up': 90032, 'down': 90033, 'stop': 90034, 'slider': 90035},
     'cmds': [cmd(90031, 'Position', 'info', 'numeric', 'FLAP_STATE', 65, '%', {'min': 0, 'max': 100}),
              cmd(90032, 'Monter', 'action', 'other', 'FLAP_UP'),
              cmd(90033, 'Descendre', 'action', 'other', 'FLAP_DOWN'),
              cmd(90034, 'Stop', 'action', 'other', 'FLAP_STOP'),
              cmd(90035, 'Position', 'action', 'slider', 'FLAP_SLIDER', extra={'min': 0, 'max': 100})]},
    {'id': 90004, 'name': 'Salon', 'roomId': 9001, 'eqType': 'demo', 'category': '',
     'order': 3, 'battery': 12, 'card': 'sensor', 'domain': 'sensor', 'roles': {},
     'cmds': [cmd(90041, 'Température', 'info', 'numeric', 'TEMPERATURE', 21.4, '°C'),
              cmd(90042, 'Humidité', 'info', 'numeric', 'HUMIDITY', 48, '%'),
              cmd(90043, 'CO2', 'info', 'numeric', 'CO2', 612, 'ppm'),
              cmd(90044, 'Présence', 'info', 'binary', 'PRESENCE', 1)]},
    {'id': 90006, 'name': 'Applique sans retour', 'roomId': 9001, 'eqType': 'demo', 'category': 'light',
     'order': 5, 'battery': None, 'card': 'light', 'domain': 'light',
     'roles': {'on': 90061, 'off': 90062},
     'cmds': [cmd(90061, 'On', 'action', 'other', 'LIGHT_ON'),
              cmd(90062, 'Off', 'action', 'other', 'LIGHT_OFF')]},
    {'id': 90007, 'name': 'Porte garage', 'roomId': 9001, 'eqType': 'demo', 'category': 'opening',
     'order': 6, 'battery': None, 'card': 'sensor', 'domain': 'sensor', 'roles': {},
     'cmds': [dict(cmd(90071, 'Ouverture', 'info', 'binary', 'OPENING', 1), invert=True)]},
    {'id': 90008, 'name': 'Variateur seul', 'roomId': 9001, 'eqType': 'demo', 'category': 'light',
     'order': 7, 'battery': None, 'card': 'light', 'domain': 'light',
     'roles': {'slider': 90081},
     'cmds': [cmd(90081, 'Intensite', 'action', 'slider', 'LIGHT_SLIDER', extra={'min': 0, 'max': 255})]},
    {'id': 90009, 'name': 'Veille Jobpol', 'roomId': 9001, 'eqType': 'demo', 'category': '',
     'order': 8, 'battery': None, 'card': 'sensor', 'domain': 'sensor', 'roles': {},
     'cmds': [cmd(90091, 'Veille', 'info', 'string', 'GENERIC_INFO',
                  json.dumps({'offres': 1, 'erreurs': 0, 'verifie': '21/09 09:01',
                              'unites': [{'l': 'PJF Mons-Tournai', 'e': 'RIEN', 's': 1},
                                         {'l': 'PJF Namur', 'e': 'MUETTE', 's': 0}]},
                             ensure_ascii=False)),
              cmd(90092, 'Vu le', 'info', 'numeric', 'GENERIC_INFO', 1789913135)]},
    {'id': 90010, 'name': 'Prochaine collecte', 'roomId': 9001, 'eqType': 'demo', 'category': '',
     'order': 9, 'battery': None, 'card': 'sensor', 'domain': 'sensor', 'roles': {},
     'cmds': [cmd(90101, 'Collecte', 'info', 'string', 'GENERIC_INFO',
                  json.dumps({'label': 'jeudi 24/09', 'days': 3, 'countdown': 'dans 3 jours',
                              'fractions': ['Organique', 'PMC']}, ensure_ascii=False))]},
    {'id': 90011, 'name': 'Robot bavard', 'roomId': 9001, 'eqType': 'demo', 'category': '',
     'order': 10, 'battery': None, 'card': 'generic', 'domain': 'info', 'roles': {},
     'cmds': [cmd(90110 + i, 'Mesure %d' % i, 'info', 'numeric', 'GENERIC_INFO', i) for i in range(1, 10)] +
             [cmd(90130 + i, 'Nettoyer piece %d' % i, 'action', 'other', 'GENERIC_ACTION') for i in range(1, 13)] +
             [cmd(90160, 'Carte', 'info', 'string', '', 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='),
              cmd(90161, 'Plan absent', 'info', 'string', '', 'plugins/inexistant/core/php/map.php?id=1')]},
    {'id': 90012, 'name': 'Alerte caméra', 'roomId': 9001, 'eqType': 'demo', 'category': 'security',
     'order': 11, 'battery': None, 'card': 'sensor', 'domain': 'sensor', 'roles': {},
     'cmds': [dict(cmd(90201, 'Images de alerte', 'info', 'string', '', '{"a":"x","d":"quelque chose"}'),
                   widget=True),
              cmd(90202, 'Déclenchée', 'info', 'binary', 'GENERIC_INFO', 1)]},
    {'id': 90013, 'name': 'Prise bavarde', 'roomId': 9001, 'eqType': 'demo', 'category': 'energy',
     'order': 12, 'battery': None, 'card': 'switch', 'domain': 'socket',
     'roles': {'state': 90211, 'on': 90212, 'off': 90213},
     'cmds': [cmd(90211, 'État', 'info', 'binary', 'ENERGY_STATE', 1),
              cmd(90212, 'On', 'action', 'other', 'ENERGY_ON'),
              cmd(90213, 'Off', 'action', 'other', 'ENERGY_OFF'),
              cmd(90214, 'Événement entrée 1', 'info', 'binary', 'BUTTON', 0),
              cmd(90215, 'Appui long 1', 'info', 'binary', 'BUTTON', 0),
              dict(cmd(90216, 'Puissance', 'info', 'numeric', 'POWER', 64.5, 'W'), history=True)]},
    {'id': 90005, 'name': 'Prise TV', 'roomId': 9001, 'eqType': 'demo', 'category': 'energy',
     'order': 4, 'battery': None, 'card': 'switch', 'domain': 'socket',
     'roles': {'state': 90051, 'on': 90052, 'off': 90053},
     'cmds': [cmd(90051, 'État', 'info', 'binary', 'ENERGY_STATE', 1),
              cmd(90052, 'On', 'action', 'other', 'ENERGY_ON'),
              cmd(90053, 'Off', 'action', 'other', 'ENERGY_OFF'),
              cmd(90054, 'Puissance', 'info', 'numeric', 'POWER', 87.2, 'W'),
              cmd(90055, 'Consommation', 'info', 'numeric', 'CONSUMPTION', 1.8, 'kWh')]},
]

TEXTES = ['Terminé', 'En veille', 'Mardi 23 septembre', 'Aucun', 'Salon', 'OK']


def prepare(model):
    """Comble les valeurs absentes, ajoute les équipements de démonstration."""
    random.seed(7)
    for device in model['devices'].values():
        for entry in device['cmds']:
            if entry['type'] != 'info' or entry.get('value') not in (None, ''):
                continue
            if entry['subType'] == 'binary':
                entry['value'] = random.choice([0, 1])
            elif entry['subType'] == 'numeric':
                entry['value'] = round(random.uniform(entry.get('min', 0), entry.get('max', 100) or 100), 1)
            else:
                entry['value'] = random.choice(TEXTES)
    model['admin'] = True
    # Une veille de 120 ms et une nuit permanente : le banc ne peut pas
    # attendre cinq minutes ni changer d'heure.
    model['kiosk'] = {'idle': 0.002, 'dim': 40, 'night': '00:00', 'day': '23:59'}
    for device in DEMOS:
        model['devices'][str(device['id'])] = device
    model['rooms'].insert(0, {'id': 9001, 'name': 'Salon (démonstration)', 'fatherId': 0,
                              'depth': 0, 'img': '', 'devices': [d['id'] for d in DEMOS]})
    return model


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    model = prepare(json.loads(pathlib.Path(sys.argv[1]).read_text()))
    out_dir = pathlib.Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    tone = sys.argv[3] if len(sys.argv) > 3 else 'light'

    page = (REPO / 'desktop/php/jeeglowbe.php').read_text()
    body = page[page.index('<div id="jg-root"'):page.index('<?php include_file')]
    css = (REPO / 'desktop/css/jeeglowbe.css').read_text()
    js = (REPO / 'desktop/js/jeeglowbe.js').read_text()

    # translate::exec() retire les accolades en français : on fait pareil.
    strip = lambda text: re.sub(r'\{\{(.*?)\}\}', r'\1', text, flags=re.S)
    body = strip(body)
    js = strip(js)

    root_bg = '30,32,38' if tone == 'dark' else '232,232,234'
    page_bg = '#15171c' if tone == 'dark' else '#eef0f4'

    html = """<!doctype html>
    <html><head><meta charset="utf-8">
    <link rel="stylesheet" href="file://""" + JEEDOM + """/3rdparty/font-awesome5/css/all.min.css">
    <style>
    /* --bg-color est la variable du thème Jeedom : c'est elle que le dashboard
     * mesure pour décider de son ambiance. La fixer ici suffit à jouer le thème
     * clair ou le thème sombre. */
    :root { --bg-color: """ + root_bg + """; }
    /* Reproduction exacte de desktop/css/desktop.main.css:4274 : selecteur de
     * type, donc n'importe quel header descendant. */
    body.fullscreen header, body.fullscreen footer { display: none; }
    body { margin:0; padding:18px; background:""" + page_bg + """;
           font-family: Roboto, "Helvetica Neue", Arial, sans-serif; }
    """ + css + """
    </style></head><body>
    <header id="jeedomMenuBar">menu de Jeedom</header>
    <div id="host">""" + body + """</div>
    <pre id="results"></pre>
    <script id="jgsrc" type="text/plain">""" + js + """</script>
    <script>
    var MARKUP = document.getElementById('host').innerHTML
    var SRC = document.getElementById('jgsrc').textContent
    var CALLS = []
    var ERRORS = []
    var WIDGET_HTML = '<div class="cmd-widget faux">vignette du plugin</div>' +
      '<scr' + 'ipt>window.WIDGET_RAN = true</scr' + 'ipt>'
    window.WIDGET_RAN = false
    var FETCHES = []
    var RENAMED = null
    window.fetch = function (url, options) {
      FETCHES.push(url)
      var action = (options && options.body && options.body.get) ? options.body.get('action') : ''
      if (action === 'rename') {
        RENAMED = options.body.get('name')
        return Promise.resolve({
          json: function () {
            return Promise.resolve({ state: 'ok', result: { id: 90013, name: RENAMED, realName: 'Prise bavarde' } })
          }
        })
      }
      if (action === 'toHtml') {
        return Promise.resolve({
          json: function () {
            return Promise.resolve({ state: 'ok', result: { '90201': { id: 90201, html: WIDGET_HTML } } })
          }
        })
      }
      return new Promise(function () {})
    }
    window.onerror = function (message, source, line) { ERRORS.push(message + ' @' + line) }
    window.jeeglowbeModel = """ + json.dumps(model, ensure_ascii=False) + """
    var CHARTS = []
    window.jeedom = {
      cmd: { execute: function (p) { CALLS.push(p) } },
      history: { drawChart: function (p) { CHARTS.push(p) } }
    }
    window.jeedomUtils = { showAlert: function () {} }

    var results = []
    function check(name, condition, detail) {
      results.push((condition ? 'OK   ' : 'ECHEC') + ' | ' + name + (detail ? ' | ' + detail : ''))
    }
    function run() { try { (0, eval)(SRC) } catch (e) { ERRORS.push('eval: ' + e.message) } }
    function reload() { document.getElementById('host').innerHTML = MARKUP; run() }
    function card(id) { return document.querySelector('.jg-card[data-device-id="' + id + '"]') }
    function update(cmdId, value) {
      document.body.dispatchEvent(new CustomEvent('cmd::update', { detail: [{ cmd_id: cmdId, value: value }] }))
    }

    run()

    // --- construction -------------------------------------------------------
    var cards = document.querySelectorAll('.jg-card')
    check('cartes construites', cards.length === Object.keys(jeeglowbeModel.devices).length,
          cards.length + ' cartes pour ' + Object.keys(jeeglowbeModel.devices).length + ' équipements')
    check('aucune erreur au chargement', ERRORS.length === 0, ERRORS.join(' / '))
    var domains = {}
    Object.keys(jeeglowbeModel.devices).forEach(function (k) { domains[jeeglowbeModel.devices[k].domain] = 1 })
    check('vue par défaut : les fonctions', document.getElementById('jg-root').dataset.view === 'functions',
          document.getElementById('jg-root').dataset.view)
    check('une section par domaine présent',
          document.querySelectorAll('.jg-section').length === Object.keys(domains).length,
          document.querySelectorAll('.jg-section').length + ' sections pour ' + Object.keys(domains).length + ' domaines')
    check('rail : quatre vues', document.querySelectorAll('.jg-rail-item').length === 4)
    check('rail : la vue courante est marquée',
          document.querySelector('.jg-rail-item.jg-rail-on').dataset.view === 'functions')
    check('sous-onglets : Tout plus les domaines',
          document.querySelectorAll('.jg-tab').length === Object.keys(domains).length + 1,
          document.querySelectorAll('.jg-tab').length + ' onglets')

    // --- carte lumière allumée (90001 : state 90011 = 1, on 90012, off 90013) --
    var light = card(90001)
    check('lumière : carte présente', light !== null)
    check('lumière : état allumé', light.dataset.on === '1', 'data-on=' + light.dataset.on)
    check('lumière : libellé', light.querySelector('.jg-state').textContent === 'Allumée',
          light.querySelector('.jg-state').textContent)
    CALLS = []
    light.click()
    check('lumière allumée : un appui éteint', CALLS.length === 1 && CALLS[0].id === 90013,
          JSON.stringify(CALLS))
    check('lumière : notify désactivé', CALLS.length === 1 && CALLS[0].notify === false)

    // valeur qui revient du serveur
    update(90011, 0)
    check('lumière : état suit cmd::update', light.dataset.on === '0' && light.querySelector('.jg-state').textContent === 'Éteinte',
          light.dataset.on + ' / ' + light.querySelector('.jg-state').textContent)
    CALLS = []
    light.click()
    check('lumière éteinte : un appui allume', CALLS.length === 1 && CALLS[0].id === 90012, JSON.stringify(CALLS))

    // mesure secondaire
    update(90015, 133.7)
    check('lumière : mesure secondaire suivie', light.textContent.indexOf('133.7 W') !== -1)

    // curseur
    CALLS = []
    var slider = light.querySelector('input[type=range]')
    slider.value = 42
    slider.dispatchEvent(new Event('change'))
    check('lumière : curseur envoie une valeur nommée',
          CALLS.length === 1 && CALLS[0].id === 90014 && CALLS[0].value && CALLS[0].value.slider === 42,
          JSON.stringify(CALLS))
    slider.value = 0
    slider.dispatchEvent(new Event('change'))
    check('curseur : le zéro survit', CALLS.length === 2 && CALLS[1].value.slider === 0, JSON.stringify(CALLS[1]))

    // --- variateur sans allumage (90008) ------------------------------------
    var dimmer = card(90008)
    check('variateur seul : pas annoncé comme bouton', !dimmer.classList.contains('jg-tappable') &&
          dimmer.getAttribute('role') !== 'button')
    var dimmerSlider = dimmer.querySelector('input[type=range]')
    dimmerSlider.value = 180
    dimmerSlider.dispatchEvent(new Event('change'))
    check('variateur seul : curseur opérant', CALLS.length === 3 && CALLS[2].value.slider === 180,
          JSON.stringify(CALLS[2]))
    update(90081, 200)
    check('variateur seul : pas de pourcentage inventé sur une échelle 0-255',
          dimmer.querySelector('.jg-slider-value').textContent === '200',
          dimmer.querySelector('.jg-slider-value').textContent)

    // --- bascule unique (90002 : toggle) ------------------------------------
    CALLS = []
    card(90002).click()
    check('bascule : commande toggle utilisée', CALLS.length === 1 && CALLS[0].id === 90022, JSON.stringify(CALLS))

    // --- volet (90003) ------------------------------------------------------
    var cover = card(90003)
    var buttons = cover.querySelectorAll('.jg-actions .jg-btn')
    check('volet : trois boutons', buttons.length === 3, buttons.length + ' boutons')
    CALLS = []
    buttons[0].click(); buttons[1].click(); buttons[2].click()
    check('volet : monter/stop/descendre',
          CALLS.length === 3 && CALLS[0].id === 90032 && CALLS[1].id === 90034 && CALLS[2].id === 90033,
          JSON.stringify(CALLS.map(function (c) { return c.id })))
    check('volet : position affichée', cover.querySelector('.jg-state').textContent === '65 %',
          cover.querySelector('.jg-state').textContent)
    update(90031, 0)
    check('volet : fermé après mise à jour', cover.dataset.on === '0' && cover.querySelector('.jg-state').textContent === '0 %',
          cover.dataset.on + ' / ' + cover.querySelector('.jg-state').textContent)

    // --- capteur (90004) ----------------------------------------------------
    var sensor = card(90004)
    check('capteur : valeur principale', sensor.querySelector('.jg-value').textContent === '21.4 °C',
          sensor.querySelector('.jg-value').textContent)
    check('capteur : sous-titre = nom de la mesure', sensor.querySelector('.jg-card-sub').textContent === 'Température')
    update(90041, 19.25)
    check('capteur : valeur suit cmd::update', sensor.querySelector('.jg-value').textContent === '19.3 °C',
          sensor.querySelector('.jg-value').textContent)
    update(90044, 0)
    check('capteur : binaire relibellé', sensor.textContent.indexOf('Absent') !== -1,
          sensor.textContent.slice(0, 80))

    // --- valeur JSON (90009) ------------------------------------------------
    var jsonCard = card(90009)
    check('JSON : aucune accolade affichée', jsonCard.textContent.indexOf('{') === -1,
          jsonCard.textContent.slice(0, 70))
    check('horodatage : rendu en date, pas en nombre',
          jsonCard.textContent.indexOf('1789913135') === -1, jsonCard.textContent.slice(0, 90))
    var jsonNode = jsonCard.querySelector('.jg-row .jg-expand')
    check('JSON : la valeur est dépliable', jsonNode !== null && jsonNode.getAttribute('role') === 'button')
    check('JSON : résumé lisible', jsonNode !== null && /offres|verifie/.test(jsonNode.textContent),
          jsonNode ? jsonNode.textContent : 'pas de valeur')
    check('JSON : détail fermé au départ', jsonCard.querySelector('.jg-json') === null)
    jsonNode.click()
    var details = jsonCard.querySelector('.jg-json')
    check('JSON : détail ouvert au clic', details !== null)
    check('JSON : chaque élément garde son état',
          details !== null && /PJF Mons-Tournai[^]*RIEN/.test(details.textContent),
          details ? details.textContent.slice(0, 120) : '')
    check('JSON : les champs sont listés', details !== null && details.textContent.indexOf('offres') !== -1 &&
          details.textContent.indexOf('PJF Mons-Tournai') !== -1, details ? details.textContent.slice(0, 80) : '')
    check('JSON : le tableau est compté', details !== null && details.textContent.indexOf('2 éléments') !== -1,
          details ? details.textContent.slice(0, 120) : '')
    jsonNode.click()
    check('JSON : détail refermé', jsonCard.querySelector('.jg-json') === null)
    update(90091, JSON.stringify({ offres: 4, erreurs: 0, verifie: '21/09 10:30' }))
    check('JSON : le résumé suit la mise à jour', /4|10:30/.test(jsonCard.querySelector('.jg-row .jg-expand').textContent),
          jsonCard.querySelector('.jg-row .jg-expand').textContent)

    // --- structure seule (90010) --------------------------------------------
    var alone = card(90010)
    check('JSON seul : mis en avant comme texte',
          alone.querySelector('.jg-value').classList.contains('jg-value-text'))
    check('JSON seul : résumé et non structure', alone.querySelector('.jg-value').textContent.indexOf('{') === -1,
          alone.querySelector('.jg-value').textContent)
    alone.querySelector('.jg-value').click()
    check('JSON seul : détail accessible', alone.querySelector('.jg-json') !== null)

    // --- carte générique ----------------------------------------------------
    var generic = document.querySelector('.jg-card[data-card-type="generic"]')
    check('générique : au moins une carte', generic !== null)
    var messageButtons = 0
    document.querySelectorAll('.jg-card[data-card-type="generic"]').forEach(function (c) {
      var device = jeeglowbeModel.devices[c.dataset.deviceId]
      device.cmds.forEach(function (cmd) {
        if (cmd.type === 'action' && cmd.subType === 'message' && cmd.visible) { messageButtons++ }
      })
    })
    check('générique : aucune commande message proposée sans paramètres', messageButtons === 0,
          messageButtons + ' commande(s) message dans le modèle')

    // --- clavier ------------------------------------------------------------
    var tappable = document.querySelector('.jg-tappable')
    check('clavier : carte focalisable', tappable !== null && tappable.getAttribute('tabindex') === '0')
    check('clavier : rôle bouton', tappable !== null && tappable.getAttribute('role') === 'button')
    CALLS = []
    tappable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    check('clavier : Entrée déclenche la bascule', CALLS.length === 1, JSON.stringify(CALLS))
    CALLS = []
    tappable.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    check('clavier : une autre touche ne fait rien', CALLS.length === 0)

    // --- lumière sans commande d'état (90006) -------------------------------
    var blind = card(90006)
    var blindButtons = blind.querySelectorAll('.jg-actions .jg-btn')
    check('sans état : deux boutons explicites', blindButtons.length === 2, blindButtons.length + ' bouton(s)')
    check('sans état : pas de carte cliquable', !blind.classList.contains('jg-tappable'))
    CALLS = []
    blindButtons[0].click(); blindButtons[1].click()
    check('sans état : allumer puis éteindre',
          CALLS.length === 2 && CALLS[0].id === 90061 && CALLS[1].id === 90062,
          JSON.stringify(CALLS.map(function (c) { return c.id })))

    // --- binaire inversé (90007) --------------------------------------------
    var door = card(90007)
    check('inversion : 1 affiché comme fermé', door.querySelector('.jg-value').textContent === 'Fermé',
          door.querySelector('.jg-value').textContent)
    update(90071, 0)
    check('inversion : 0 affiché comme ouvert', door.querySelector('.jg-value').textContent === 'Ouvert',
          door.querySelector('.jg-value').textContent)

    // --- ce qu'une carte ne montre pas d'emblée (90011) ----------------------
    var talkative = card(90011)
    var shownRows = talkative.querySelectorAll('.jg-row').length
    check('carte bavarde : la carte reste une tuile', shownRows <= 3, shownRows + ' lignes')
    var shownButtons = talkative.querySelectorAll('.jg-actions .jg-btn').length
    check('carte bavarde : actions limitées', shownButtons === 4, shownButtons + ' boutons')
    var mores = talkative.querySelectorAll('.jg-more')
    check('carte bavarde : le reste est annoncé', mores.length === 2, mores.length + ' invitations')

    // --- le panneau de détail -----------------------------------------------
    mores[0].click()
    check('panneau : ouvert par le bouton de détail',
          document.getElementById('jg-panel').hidden === false)
    var detail = document.querySelector('jg-card-detail')
    check('panneau : toutes les actions y sont',
          detail !== null && detail.querySelectorAll('.jg-actions .jg-btn').length === 12,
          detail ? detail.querySelectorAll('.jg-actions .jg-btn').length + ' boutons' : 'pas de detail')
    check('panneau : toutes les lignes y sont',
          detail !== null && detail.querySelectorAll('.jg-row').length >= 9,
          detail ? detail.querySelectorAll('.jg-row').length + ' lignes' : '')
    check('panneau : le titre porte le nom', document.querySelector('.jg-panel-title').textContent === 'Robot bavard',
          document.querySelector('.jg-panel-title').textContent)
    document.getElementById('jg-panel-backdrop').click()
    check('panneau : refermé par le voile', document.getElementById('jg-panel').hidden === true)
    check('panneau : vidé en se fermant', document.querySelector('jg-card-detail') === null)

    // L'en-tête d'une carte ouvre le détail sans déclencher la bascule.
    CALLS = []
    card(90001).querySelector('.jg-card-head').click()
    check('en-tête : ouvre le détail', document.getElementById('jg-panel').hidden === false)
    check('en-tête : ne bascule pas la lumière', CALLS.length === 0, JSON.stringify(CALLS))
    document.getElementById('jg-panel-close').click()
    check('panneau : refermé par la croix', document.getElementById('jg-panel').hidden === true)

    // --- images -------------------------------------------------------------
    var picture = talkative.querySelector('.jg-media img')
    check('image : rendue comme une image et non comme une adresse', picture !== null,
          talkative.querySelectorAll('.jg-row').length + ' lignes, media=' +
          talkative.querySelectorAll('.jg-media').length + ', contenu=' + talkative.textContent.slice(0, 60))
    check('image : aucune adresse en clair', talkative.textContent.indexOf('map.php') === -1,
          talkative.textContent.slice(-60))

    // --- widget de plugin (90012) -------------------------------------------
    var holder = document.querySelector('.jg-widget[data-cmd-id="90201"]')
    check('widget : place réservée', holder !== null)
    check('widget : repli affiché en attendant', holder !== null && holder.querySelector('.jg-row') !== null)
    check('widget : pas encore chargé', holder !== null && !holder.classList.contains('jg-widget-ready'))
    check('widget : un seul appel groupé', FETCHES.length === 1, FETCHES.length + ' appel(s) : ' + FETCHES.join(', '))
    check('widget : la commande ordinaire reste une ligne',
          card(90012).querySelectorAll('.jg-row').length >= 1)

    // --- mesures secondaires : le bruit d'entrée écarté ---------------------
    var chatty = card(90013)
    check('mesures : les entrées physiques sont écartées',
          chatty.textContent.indexOf('Appui long') === -1 && chatty.textContent.indexOf('Événement entrée') === -1,
          chatty.textContent.slice(0, 70))
    check('mesures : la puissance est montrée', chatty.textContent.indexOf('64.5 W') !== -1,
          chatty.textContent.slice(0, 70))

    // --- courbes dans le panneau -------------------------------------------
    CHARTS = []
    chatty.querySelector('.jg-card-head').click()
    check('panneau : une courbe par commande historisée', document.querySelectorAll('.jg-chart').length === 1,
          document.querySelectorAll('.jg-chart').length + ' conteneurs')
    check('panneau : la courbe a un identifiant unique',
          document.querySelector('.jg-chart') !== null && document.querySelector('.jg-chart').id === 'jg-chart-90216',
          document.querySelector('.jg-chart') ? document.querySelector('.jg-chart').id : '')

    // --- renommer ------------------------------------------------------------
    var renameBtn = document.getElementById('jg-panel-rename')
    check('renommer : bouton offert à l administrateur', renameBtn.hidden === false)
    renameBtn.click()
    var renameInput = document.querySelector('.jg-rename')
    check('renommer : champ de saisie ouvert', renameInput !== null)
    RENAMED = null
    renameInput.value = 'Prise du salon'
    renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    check('renommer : envoyé au serveur', RENAMED === 'Prise du salon', String(RENAMED))
    document.getElementById('jg-panel-close').click()

    // --- recherche ----------------------------------------------------------
    var search = document.getElementById('jg-search')
    function goToAll() {
      window.location.hash = 'view=functions&tab=all'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
    search.value = 'plafonnier'
    search.dispatchEvent(new Event('input'))
    var shown = document.querySelectorAll('.jg-card')
    check('recherche : une seule carte trouvée', shown.length === 1 && shown[0].dataset.deviceId === '90001',
          shown.length + ' carte(s)')
    check('recherche : une section de résultats',
          document.querySelectorAll('.jg-section').length === 1)
    search.value = ''
    search.dispatchEvent(new Event('input'))
    check('recherche : tout revient',
          document.querySelectorAll('.jg-card').length === cards.length,
          document.querySelectorAll('.jg-card').length + ' cartes')

    // --- navigation : vues et sous-onglets ----------------------------------
    var tabs = document.querySelectorAll('.jg-tab')
    tabs[1].click()
    check('onglet : une seule section', document.querySelectorAll('.jg-section').length === 1,
          document.querySelectorAll('.jg-section').length + ' sections')
    check('onglet : marqué comme actif',
          document.querySelectorAll('.jg-tab')[1].classList.contains('jg-tab-on'))
    check('onglet : adresse mise à jour', window.location.hash.indexOf('tab=') !== -1, window.location.hash)

    document.querySelector('.jg-rail-item[data-view="rooms"]').click()
    check('vue Pièces : sections = pièces',
          document.querySelectorAll('.jg-section').length === jeeglowbeModel.rooms.length,
          document.querySelectorAll('.jg-section').length + ' sections')
    check('vue Pièces : rail à jour',
          document.querySelector('.jg-rail-item.jg-rail-on').dataset.view === 'rooms')

    document.querySelector('.jg-rail-item[data-view="home"]').click()
    check('accueil : pas de sous-onglets', document.getElementById('jg-subtabs').hidden === true)
    check('accueil : une tuile par domaine',
          document.querySelectorAll('.jg-domain').length === Object.keys(domains).length,
          document.querySelectorAll('.jg-domain').length + ' tuiles')
    check('accueil : des pastilles de mesure', document.querySelectorAll('.jg-badge').length > 0,
          document.querySelectorAll('.jg-badge').length + ' pastilles')
    document.querySelector('.jg-domain[data-domain="light"]').click()
    check('accueil : une tuile mène à son domaine',
          window.location.hash.indexOf('tab=light') !== -1, window.location.hash)

    document.querySelector('.jg-rail-item[data-view="functions"]').click()
    goToAll()

    // --- plein écran --------------------------------------------------------
    document.getElementById('jg-fullscreen').click()
    check('kiosque : body.fullscreen posé', document.body.classList.contains('fullscreen'))
    check('kiosque : le menu de Jeedom disparaît',
          getComputedStyle(document.getElementById('jeedomMenuBar')).display === 'none')
    check('kiosque : la barre du dashboard reste',
          getComputedStyle(document.querySelector('.jg-topbar')).display !== 'none',
          getComputedStyle(document.querySelector('.jg-topbar')).display)
    check('kiosque : bouton de sortie atteignable',
          document.getElementById('jg-fullscreen').offsetParent !== null)
    check('kiosque : attribut sur la racine', document.getElementById('jg-root').dataset.kiosk === '1')
    check('kiosque : adresse porte fullscreen=1', window.location.search.indexOf('fullscreen=1') !== -1,
          window.location.search)
    document.getElementById('jg-fullscreen').click()
    check('kiosque : retour arrière', !document.body.classList.contains('fullscreen') && window.location.search.indexOf('fullscreen') === -1)
    check('kiosque : oublié en sortant', window.localStorage.getItem('jeeglowbe.kiosk') === '0',
          String(window.localStorage.getItem('jeeglowbe.kiosk')))

    // --- veille et nuit : on rallume le kiosque et on laisse faire ----------
    document.getElementById('jg-fullscreen').click()
    check('kiosque : mémorisé pour la prochaine ouverture',
          window.localStorage.getItem('jeeglowbe.kiosk') === '1')
    check('kiosque : la nuit assombrit', document.getElementById('jg-root').dataset.dim === '1',
          document.getElementById('jg-root').dataset.dim)

    // --- rechargement de page façon Jeedom (loadPage ré-exécute le script) ---
    var errorsBefore = ERRORS.length
    reload()
    check('rechargement : pas de nouvelle erreur', ERRORS.length === errorsBefore, ERRORS.slice(errorsBefore).join(' / '))
    var light2 = card(90001)
    check('rechargement : cartes reconstruites', light2 !== null && document.querySelectorAll('.jg-card').length === cards.length)
    CALLS = []
    if (light2) { light2.click() }
    check('rechargement : la carte réagit encore', CALLS.length === 1, JSON.stringify(CALLS))
    update(90011, 1)
    check('rechargement : temps réel encore branché',
          light2 !== null && light2.dataset.on === '1', light2 ? light2.dataset.on : 'pas de carte')

    setTimeout(function () {
      // --- la tablette est revenue à l'accueil toute seule -------------------
      check('kiosque : retour à l accueil après inactivité',
            document.getElementById('jg-root').dataset.view === 'home',
            document.getElementById('jg-root').dataset.view)
      document.getElementById('jg-fullscreen').click()
      check('kiosque : éteint, plus d assombrissement',
            document.getElementById('jg-root').dataset.dim === '0',
            'dim=' + document.getElementById('jg-root').dataset.dim +
            ' kiosk=' + document.getElementById('jg-root').dataset.kiosk +
            ' body=' + document.body.classList.contains('fullscreen'))
      window.location.hash = 'view=functions&tab=all'
      window.dispatchEvent(new HashChangeEvent('hashchange'))

      // --- le widget est arrivé --------------------------------------------
      var ready = document.querySelector('.jg-widget[data-cmd-id="90201"]')
      check('widget : inséré', ready !== null && ready.classList.contains('jg-widget-ready'))
      check('widget : contenu du plugin affiché',
            ready !== null && ready.textContent.indexOf('vignette du plugin') !== -1,
            ready ? ready.textContent.slice(0, 40) : '')
      check('widget : son script est exécuté', window.WIDGET_RAN === true)
      check('widget : la ligne de repli a cédé la place',
            ready !== null && ready.querySelector('.jg-row') === null)

      // --- sortie de page : Jeedom doit retrouver son menu -------------------
      document.getElementById('jg-fullscreen').click()
      document.getElementById('host').innerHTML = ''
      var fetched = 0
      window.fetch = function () { fetched++; return new Promise(function () {}) }
      document.dispatchEvent(new Event('visibilitychange'))

      setTimeout(function () {
        check('sortie : la classe fullscreen est retirée du body',
              !document.body.classList.contains('fullscreen'))
        check('sortie : le menu de Jeedom revient',
              getComputedStyle(document.getElementById('jeedomMenuBar')).display !== 'none')
        check('sortie : plus de relecture du modèle', fetched === 0, fetched + ' appel(s)')
        document.getElementById('results').textContent = results.join('\\n') +
          '\\nERREURS JS: ' + (ERRORS.length ? ERRORS.join(' / ') : 'aucune')
      }, 80)
    }, 220)
    </script>
    </body></html>"""


    (out_dir / 'functest.html').write_text(html)

    # La page d'aperçu : le même contenu, sans banc d'essai ni bouchon
    # d'assertions — de quoi regarder le dashboard ou le photographier.
    head = html[:html.index('<pre id="results">')].replace('<div id="host">', '<div>')
    preview = head + (
        '<script>window.jeeglowbeModel = ' + json.dumps(model, ensure_ascii=False) + '\n'
        'window.jeedom = { cmd: { execute: function () {} } }\n'
        'window.jeedomUtils = { showAlert: function () {} }\n'
        '</script>\n<script>' + js + '</script>\n</body></html>')
    (out_dir / 'preview.html').write_text(preview)

    print(out_dir / 'functest.html')
    print(out_dir / 'preview.html')


if __name__ == '__main__':
    main()
