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
     'order': 0, 'battery': None, 'card': 'light',
     'roles': {'state': 90011, 'on': 90012, 'off': 90013, 'slider': 90014},
     'cmds': [cmd(90011, 'État', 'info', 'binary', 'LIGHT_STATE', 1),
              cmd(90012, 'On', 'action', 'other', 'LIGHT_ON'),
              cmd(90013, 'Off', 'action', 'other', 'LIGHT_OFF'),
              cmd(90014, 'Luminosité', 'action', 'slider', 'LIGHT_SLIDER', extra={'min': 0, 'max': 100}),
              cmd(90015, 'Puissance', 'info', 'numeric', 'POWER', 42.5, 'W')]},
    {'id': 90002, 'name': 'Lampe bureau', 'roomId': 9001, 'eqType': 'demo', 'category': 'light',
     'order': 1, 'battery': None, 'card': 'light',
     'roles': {'state': 90021, 'toggle': 90022},
     'cmds': [cmd(90021, 'État', 'info', 'binary', 'LIGHT_STATE', 0),
              cmd(90022, 'Basculer', 'action', 'other', 'LIGHT_TOGGLE')]},
    {'id': 90003, 'name': 'Volet salon', 'roomId': 9001, 'eqType': 'demo', 'category': 'opening',
     'order': 2, 'battery': 18, 'card': 'cover',
     'roles': {'state': 90031, 'up': 90032, 'down': 90033, 'stop': 90034, 'slider': 90035},
     'cmds': [cmd(90031, 'Position', 'info', 'numeric', 'FLAP_STATE', 65, '%', {'min': 0, 'max': 100}),
              cmd(90032, 'Monter', 'action', 'other', 'FLAP_UP'),
              cmd(90033, 'Descendre', 'action', 'other', 'FLAP_DOWN'),
              cmd(90034, 'Stop', 'action', 'other', 'FLAP_STOP'),
              cmd(90035, 'Position', 'action', 'slider', 'FLAP_SLIDER', extra={'min': 0, 'max': 100})]},
    {'id': 90004, 'name': 'Salon', 'roomId': 9001, 'eqType': 'demo', 'category': '',
     'order': 3, 'battery': 12, 'card': 'sensor', 'roles': {},
     'cmds': [cmd(90041, 'Température', 'info', 'numeric', 'TEMPERATURE', 21.4, '°C'),
              cmd(90042, 'Humidité', 'info', 'numeric', 'HUMIDITY', 48, '%'),
              cmd(90043, 'CO2', 'info', 'numeric', 'CO2', 612, 'ppm'),
              cmd(90044, 'Présence', 'info', 'binary', 'PRESENCE', 1)]},
    {'id': 90006, 'name': 'Applique sans retour', 'roomId': 9001, 'eqType': 'demo', 'category': 'light',
     'order': 5, 'battery': None, 'card': 'light',
     'roles': {'on': 90061, 'off': 90062},
     'cmds': [cmd(90061, 'On', 'action', 'other', 'LIGHT_ON'),
              cmd(90062, 'Off', 'action', 'other', 'LIGHT_OFF')]},
    {'id': 90007, 'name': 'Porte garage', 'roomId': 9001, 'eqType': 'demo', 'category': 'opening',
     'order': 6, 'battery': None, 'card': 'sensor', 'roles': {},
     'cmds': [dict(cmd(90071, 'Ouverture', 'info', 'binary', 'OPENING', 1), invert=True)]},
    {'id': 90008, 'name': 'Variateur seul', 'roomId': 9001, 'eqType': 'demo', 'category': 'light',
     'order': 7, 'battery': None, 'card': 'light',
     'roles': {'slider': 90081},
     'cmds': [cmd(90081, 'Intensite', 'action', 'slider', 'LIGHT_SLIDER', extra={'min': 0, 'max': 255})]},
    {'id': 90005, 'name': 'Prise TV', 'roomId': 9001, 'eqType': 'demo', 'category': 'energy',
     'order': 4, 'battery': None, 'card': 'switch',
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
    window.onerror = function (message, source, line) { ERRORS.push(message + ' @' + line) }
    window.jeeglowbeModel = """ + json.dumps(model, ensure_ascii=False) + """
    window.jeedom = { cmd: { execute: function (p) { CALLS.push(p) } } }
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
    check('sections construites', document.querySelectorAll('.jg-section').length === jeeglowbeModel.rooms.length)
    check('pastilles construites', document.querySelectorAll('.jg-chip').length === jeeglowbeModel.rooms.length + 1)

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
    check('capteur : binaire relibellé', sensor.textContent.indexOf('Aucune') !== -1)

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

    // --- recherche ----------------------------------------------------------
    var search = document.getElementById('jg-search')
    search.value = 'plafonnier'
    search.dispatchEvent(new Event('input'))
    var shown = Array.prototype.filter.call(document.querySelectorAll('.jg-card'), function (c) { return !c.hidden })
    check('recherche : filtre les cartes', shown.length === 1 && shown[0].dataset.deviceId === '90001',
          shown.length + ' carte(s)')
    check('recherche : sections vides masquées',
          document.querySelectorAll('.jg-section:not([hidden])').length === 1)
    search.value = ''
    search.dispatchEvent(new Event('input'))
    check('recherche : tout revient',
          Array.prototype.filter.call(document.querySelectorAll('.jg-card'), function (c) { return !c.hidden }).length === cards.length)

    // --- filtre par pièce ---------------------------------------------------
    var chips = document.querySelectorAll('.jg-chip')
    chips[1].click()
    check('pièce : une seule section visible', document.querySelectorAll('.jg-section:not([hidden])').length === 1)
    check('pièce : pastille active', chips[1].classList.contains('jg-chip-on'))
    check('pièce : adresse mise à jour', window.location.hash.indexOf('room=') !== -1, window.location.hash)
    // recherche pendant un filtre de pièce : doit traverser les pièces
    search.value = 'robot'
    search.dispatchEvent(new Event('input'))
    check('recherche traverse les pièces malgré le filtre',
          Array.prototype.filter.call(document.querySelectorAll('.jg-card'), function (c) { return !c.hidden }).length >= 1)
    search.value = ''
    search.dispatchEvent(new Event('input'))
    chips[0].click()
    check('pièce : retour à tout', document.querySelectorAll('.jg-section:not([hidden])').length === jeeglowbeModel.rooms.length)

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

    // --- sortie de page : Jeedom doit retrouver son menu ---------------------
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
