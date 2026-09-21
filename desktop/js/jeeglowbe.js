/* jeeGlow — dashboard alternatif pour Jeedom.
 *
 * Trois choix structurent ce fichier, et méritent d'être dits une fois pour
 * toutes plutôt que devinés à la lecture :
 *
 * 1. Le rendu est le nôtre. On n'appelle jamais eqLogic::toHtml() : le widget
 *    natif arrive avec Packery, ses scripts en ligne, son mode édition et
 *    coreWidgets.css. Le réutiliser, c'est obtenir du Jeedom repeint, jamais un
 *    dashboard neuf. Nous recevons donc un modèle de données et nous dessinons.
 *
 * 2. Des composants natifs, sans DOM fantôme. Chaque carte est un custom
 *    element, mais en DOM clair : les variables CSS du thème Jeedom doivent
 *    pouvoir descendre jusqu'à nos cartes, ce qu'un shadow root empêcherait.
 *
 * 3. Le temps réel est déjà là. jeedom.changes() tourne pour toute page servie
 *    par index.php ; il suffit d'écouter cmd::update sur document.body. Aucun
 *    transport à écrire, aucun démon.
 */
;(function () {
  'use strict'

  var ROOT = document.getElementById('jg-root')
  if (ROOT === null) {
    return
  }

  var MODEL = (typeof jeeglowbeModel !== 'undefined' && jeeglowbeModel) ? jeeglowbeModel : { rooms: [], devices: {} }

  /* Index plats : les cartes n'ont jamais à parcourir le modèle, elles
   * interrogent un identifiant.
   *
   * Ils vivent sur window et non dans cette fermeture, pour une raison précise :
   * Jeedom charge ses pages en ajax et RÉ-EXÉCUTE ce fichier à chaque retour sur
   * le dashboard. Les classes de cartes, elles, ne peuvent être enregistrées
   * qu'une fois dans le registre des éléments personnalisés — celles du second
   * passage seraient refusées. Les cartes construites plus tard sont donc
   * toujours des instances des classes du premier passage, et liraient un index
   * périmé s'il était capturé dans la fermeture. Un objet unique, réalimenté à
   * chaque chargement, règle les deux problèmes d'un coup. */
  var JG = window.jeeglowbeRuntime || (window.jeeglowbeRuntime = {})
  JG.CMDS = {}
  JG.VALUES = {}
  JG.WATCH = {}

  function indexModel() {
    JG.CMDS = {}
    JG.VALUES = {}
    JG.WATCH = {}
    Object.keys(MODEL.devices || {}).forEach(function (key) {
      MODEL.devices[key].cmds.forEach(function (cmd) {
        JG.CMDS[cmd.id] = cmd
        if (cmd.type === 'info') {
          JG.VALUES[cmd.id] = cmd.value
        }
      })
    })
  }

  /* ------------------------------------------------------------------ outils */

  function el(tag, className, text) {
    var node = document.createElement(tag)
    if (className) {
      node.className = className
    }
    if (text !== undefined && text !== null) {
      node.textContent = text
    }
    return node
  }

  function urlVar(name) {
    var found = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search)
    return found === null ? null : decodeURIComponent(found[1])
  }

  function isTrue(cmd, value) {
    var state = (value === true || value === 1 || value === '1' || value === 'true')
    if (cmd && cmd.invert) {
      state = !state
    }
    return state
  }

  /* Les mots qu'un humain emploie devant un état binaire. Le coeur ne les donne
   * pas : « 1 » sur un détecteur de fumée et « 1 » sur une porte ne se lisent
   * pas de la même façon, et « Oui / Non » partout est la marque des dashboards
   * qui n'ont pas regardé ce qu'ils affichaient. */
  var BINARY_LABELS = {
    OPENING: ['{{Ouvert}}', '{{Fermé}}'],
    OPENING_WINDOW: ['{{Ouverte}}', '{{Fermée}}'],
    GARAGE_STATE: ['{{Ouvert}}', '{{Fermé}}'],
    BARRIER_STATE: ['{{Ouverte}}', '{{Fermée}}'],
    LOCK_STATE: ['{{Déverrouillé}}', '{{Verrouillé}}'],
    PRESENCE: ['{{Détectée}}', '{{Aucune}}'],
    SMOKE: ['{{Fumée détectée}}', '{{Rien à signaler}}'],
    FLOOD: ['{{Inondation}}', '{{Rien à signaler}}'],
    WATER_LEAK: ['{{Fuite}}', '{{Rien à signaler}}'],
    SABOTAGE: ['{{Sabotage}}', '{{Rien à signaler}}'],
    SHOCK: ['{{Choc}}', '{{Rien à signaler}}'],
    ALARM_STATE: ['{{En alarme}}', '{{Au repos}}'],
    ONLINE: ['{{En ligne}}', '{{Hors ligne}}'],
    BATTERY_CHARGING: ['{{En charge}}', '{{Sur batterie}}'],
    LIGHT_STATE: ['{{Allumée}}', '{{Éteinte}}'],
    LIGHT_STATE_BOOL: ['{{Allumée}}', '{{Éteinte}}'],
    ENERGY_STATE: ['{{Allumée}}', '{{Éteinte}}']
  }

  function format(cmdId) {
    var cmd = JG.CMDS[cmdId]
    var value = JG.VALUES[cmdId]
    if (cmd === undefined) {
      return '—'
    }
    if (value === null || value === undefined || value === '') {
      return '—'
    }
    if (cmd.subType === 'binary') {
      var labels = BINARY_LABELS[cmd.generic] || ['{{Oui}}', '{{Non}}']
      return isTrue(cmd, value) ? labels[0] : labels[1]
    }
    if (cmd.subType === 'numeric') {
      var number = parseFloat(value)
      if (isNaN(number)) {
        return String(value)
      }
      var rounded = (Math.abs(number % 1) < 0.05) ? Math.round(number) : Math.round(number * 10) / 10
      return String(rounded) + (cmd.unit ? ' ' + cmd.unit : '')
    }
    return String(value) + (cmd.unit ? ' ' + cmd.unit : '')
  }

  var CARD_ICONS = { light: 'fas fa-lightbulb', switch: 'fas fa-plug', cover: 'fas fa-bars', sensor: 'fas fa-microchip', generic: 'fas fa-cube' }
  var GENERIC_ICONS = {
    TEMPERATURE: 'fas fa-thermometer-half', WEATHER_TEMPERATURE: 'fas fa-thermometer-half',
    HUMIDITY: 'fas fa-tint', WEATHER_HUMIDITY: 'fas fa-tint',
    CO2: 'fas fa-smog', CO: 'fas fa-smog', AIR_QUALITY: 'fas fa-wind',
    BRIGHTNESS: 'fas fa-sun', UV: 'fas fa-sun', NOISE: 'fas fa-volume-up',
    PRESENCE: 'fas fa-walking', SMOKE: 'fas fa-fire-alt', FLOOD: 'fas fa-water',
    POWER: 'fas fa-bolt', CONSUMPTION: 'fas fa-bolt', PRODUCTION: 'fas fa-solar-panel',
    VOLTAGE: 'fas fa-bolt', BATTERY: 'fas fa-battery-half',
    CAMERA_URL: 'fas fa-video', ALARM_STATE: 'fas fa-shield-alt',
    OPENING: 'fas fa-door-open', OPENING_WINDOW: 'fas fa-window-maximize',
    MEDIA_STATE: 'fas fa-music', WEATHER_CONDITION: 'fas fa-cloud-sun'
  }

  /* La batterie et l'état en ligne sont présents sur la moitié des
   * équipements : les laisser gagner donnerait une pile en guise d'icône à un
   * aspirateur. On ne les retient qu'à défaut de mieux. */
  var WEAK_ICONS = ['BATTERY', 'BATTERY_CHARGING', 'ONLINE']

  function deviceIcon(device) {
    if (device.card === 'sensor' || device.card === 'generic') {
      var fallback = null
      for (var i = 0; i < device.cmds.length; i++) {
        var icon = GENERIC_ICONS[device.cmds[i].generic]
        if (!icon) {
          continue
        }
        if (WEAK_ICONS.indexOf(device.cmds[i].generic) === -1) {
          return icon
        }
        fallback = fallback || icon
      }
      if (fallback) {
        return fallback
      }
    }
    return CARD_ICONS[device.card] || CARD_ICONS.generic
  }

  /* Exécution d'une commande.
   *
   * La valeur doit partir NOMMÉE — { slider: 60 }, { select: 'eco' } — et non
   * en scalaire. Le chemin est sans appel : jeedom.cmd.execute() ne sérialise
   * que les objets (core/js/cmd.class.js), et côté serveur
   * core/ajax/cmd.ajax.php fait is_json(init('value'), array()), qui renvoie un
   * tableau vide dès que la valeur n'est pas un JSON de tableau. Un « 60 » part
   * donc, ne provoque aucune erreur, et n'arrive jamais : $options['slider']
   * n'existe pas. Les templates du coeur envoient tous la forme nommée.
   *
   * Passer par l'objet règle du même coup le cas du zéro : dans le coeur,
   * value: _params.value || '' effacerait un 0 scalaire, alors qu'un objet
   * sérialisé est toujours une chaîne non vide.
   *
   * notify:false est volontaire : jeedom.cmd.execute() cherche sinon la tuile
   * native .eqLogic-widget correspondante pour l'animer, et nos cartes n'en
   * sont pas. On montre donc nous-mêmes que quelque chose se passe. */
  var VALUE_KEYS = { slider: 'slider', select: 'select', color: 'color' }

  function exec(cmdId, value, source) {
    if (cmdId === undefined || cmdId === null) {
      return
    }
    if (source) {
      source.classList.add('jg-busy')
      setTimeout(function () { source.classList.remove('jg-busy') }, 900)
    }
    var params = { id: cmdId, notify: false }
    if (value !== undefined && value !== null) {
      var cmd = JG.CMDS[cmdId]
      var key = (cmd && VALUE_KEYS[cmd.subType]) ? VALUE_KEYS[cmd.subType] : null
      if (key === null) {
        /* Sous-type sans paramètre attendu : on n'invente pas de nom de champ,
         * l'action part telle quelle. */
        params.value = value
      } else {
        params.value = {}
        params.value[key] = value
      }
    }
    params.error = function (error) {
      if (typeof jeedomUtils !== 'undefined' && jeedomUtils.showAlert) {
        jeedomUtils.showAlert({ message: (error && error.message) ? error.message : String(error), level: 'danger' })
      }
    }
    jeedom.cmd.execute(params)
  }

  /* --------------------------------------------------------------- les cartes */

  /* Un seul enregistrement pour toute la session : voir la note sur JG plus
   * haut. Le registre des éléments personnalisés refuse un second define, et
   * l'exception laisserait le dashboard vide au retour sur la page. */
  if (customElements.get('jg-card-generic') === undefined) {

  class JgCard extends HTMLElement {
    connectedCallback() {
      if (this._ready) {
        return
      }
      this._ready = true
      this.classList.add('jg-card')
      this.dataset.cardType = this.device.card
      if (this.device.category) {
        this.dataset.category = this.device.category
      }
      this.build()
      this.sync()
    }

    /* Identifiant de la commande tenant ce rôle, ou undefined. */
    role(name) {
      return this.device.roles ? this.device.roles[name] : undefined
    }

    value(name) {
      var id = this.role(name)
      return (id === undefined) ? null : JG.VALUES[id]
    }

    on() {
      var id = this.role('state')
      if (id === undefined) {
        return false
      }
      var cmd = JG.CMDS[id]
      if (cmd && cmd.subType === 'numeric') {
        return parseFloat(JG.VALUES[id]) > 0
      }
      return isTrue(cmd, JG.VALUES[id])
    }

    header(subtitle) {
      var head = el('div', 'jg-card-head')
      var icon = el('i', deviceIcon(this.device) + ' jg-card-icon')
      head.appendChild(icon)
      var titles = el('div', 'jg-card-titles')
      titles.appendChild(el('span', 'jg-card-name', this.device.name))
      this._subtitle = el('span', 'jg-card-sub', subtitle || '')
      titles.appendChild(this._subtitle)
      head.appendChild(titles)
      if (this.device.battery !== null && this.device.battery !== undefined && this.device.battery <= 25) {
        var battery = el('span', 'jg-battery')
        battery.appendChild(el('i', 'fas fa-battery-quarter'))
        battery.appendChild(el('span', null, this.device.battery + ' %'))
        head.appendChild(battery)
      }
      this.appendChild(head)
      return head
    }

    /* Les mesures secondaires d'une carte pilotable : la puissance d'une prise,
     * la température d'un thermostat. Ce sont elles qui font qu'on n'a pas
     * besoin d'ouvrir l'équipement pour savoir ce qu'il fait. */
    metrics(limit) {
      var used = Object.keys(this.device.roles || {}).map(function (key) { return this.device.roles[key] }, this)
      var extras = this.device.cmds.filter(function (cmd) {
        return cmd.type === 'info' && cmd.visible && used.indexOf(cmd.id) === -1
      }).slice(0, limit || 3)
      if (extras.length === 0) {
        return
      }
      var line = el('div', 'jg-metrics')
      this._metrics = []
      extras.forEach(function (cmd) {
        var item = el('span', 'jg-metric')
        item.appendChild(el('span', 'jg-metric-name', cmd.name))
        var value = el('span', 'jg-metric-value', format(cmd.id))
        item.appendChild(value)
        line.appendChild(item)
        this._metrics.push({ id: cmd.id, node: value })
        watch(cmd.id, this)
      }, this)
      this.appendChild(line)
    }

    syncMetrics() {
      (this._metrics || []).forEach(function (metric) {
        metric.node.textContent = format(metric.id)
      })
    }

    slider(roleName, onChange) {
      var id = this.role(roleName)
      if (id === undefined) {
        return null
      }
      var cmd = JG.CMDS[id]
      var wrap = el('div', 'jg-slider')
      var input = document.createElement('input')
      input.type = 'range'
      input.min = (cmd && cmd.min !== undefined) ? cmd.min : 0
      input.max = (cmd && cmd.max !== undefined) ? cmd.max : 100
      input.step = 1
      var bubble = el('span', 'jg-slider-value', '')
      /* Le pourcentage n'est pas garanti : un variateur peut aller de 0 à 255,
       * et afficher « 180 % » serait faux. L'unité déclarée sur la commande
       * l'emporte, et le signe n'apparaît que sur une échelle de 0 à 100. */
      var suffix = (cmd && cmd.unit) ? ' ' + cmd.unit : ((input.max == 100) ? ' %' : '')
      this._suffix = suffix
      input.addEventListener('input', function () { bubble.textContent = input.value + suffix })
      input.addEventListener('change', function () { onChange(parseInt(input.value, 10), input) })
      wrap.appendChild(input)
      wrap.appendChild(bubble)
      this._slider = { input: input, bubble: bubble }
      return wrap
    }

    syncSlider(value) {
      if (!this._slider) {
        return
      }
      var number = parseFloat(value)
      if (isNaN(number) || this._slider.input.matches(':active')) {
        return
      }
      this._slider.input.value = number
      this._slider.bubble.textContent = Math.round(number) + (this._suffix || '')
    }

    build() {}
    sync() { this.syncMetrics() }
  }

  /* Lumière et prise : même geste, un appui sur la carte. La différence
   * d'icône et de vocabulaire suffit à les distinguer, pas deux implémentations. */
  class JgToggle extends JgCard {
    build() {
      this.header()
      var body = el('div', 'jg-card-body')
      this._state = el('span', 'jg-state', '')
      body.appendChild(this._state)
      this.appendChild(body)

      var slider = this.slider('slider', function (value, input) {
        exec(this.role('slider'), value, input)
      }.bind(this))
      if (slider) {
        this.appendChild(slider)
      }

      /* Rien à basculer : un variateur qui n'expose qu'un curseur, une prise
       * qui ne rapporte que sa consommation. La carte reste informative — la
       * déclarer bouton la ferait répondre au clavier et se soulever au
       * survol pour ne rien faire. */
      var canToggle = (this.role('toggle') !== undefined || this.role('on') !== undefined || this.role('off') !== undefined)

      /* Sans commande d'état, on ne peut pas savoir sur quel pied danser : deux
       * boutons explicites valent mieux qu'une bascule qui se trompe. */
      if (!canToggle) {
        this.metrics(2)
        this.watchState()
        return
      }
      if (this.role('state') === undefined) {
        var pair = el('div', 'jg-actions')
        if (this.role('on') !== undefined) {
          var onBtn = el('button', 'jg-btn', '{{Allumer}}')
          onBtn.addEventListener('click', function () { exec(this.role('on'), null, onBtn) }.bind(this))
          pair.appendChild(onBtn)
        }
        if (this.role('off') !== undefined) {
          var offBtn = el('button', 'jg-btn', '{{Éteindre}}')
          offBtn.addEventListener('click', function () { exec(this.role('off'), null, offBtn) }.bind(this))
          pair.appendChild(offBtn)
        }
        this.appendChild(pair)
      } else {
        /* Une carte qui se comporte en bouton doit en être un pour le clavier
         * et pour les lecteurs d'écran : un div cliquable n'est atteignable ni
         * par tabulation, ni par la touche Entrée. */
        this.classList.add('jg-tappable')
        this.setAttribute('role', 'button')
        this.setAttribute('tabindex', '0')
        this.addEventListener('click', function (event) {
          if (event.target.closest('input, button, select')) {
            return
          }
          this.toggle()
        }.bind(this))
        this.addEventListener('keydown', function (event) {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return
          }
          if (event.target.closest('input, button, select')) {
            return
          }
          /* Espace fait défiler la page par défaut : sur une carte, c'est le
           * geste d'activation. */
          event.preventDefault()
          this.toggle()
        }.bind(this))
      }

      this.metrics(2)
      this.watchState()
    }

    watchState() {
      ;['state', 'brightness', 'slider'].forEach(function (role) {
        if (this.role(role) !== undefined) {
          watch(this.role(role), this)
        }
      }, this)
    }

    toggle() {
      if (this.role('toggle') !== undefined) {
        exec(this.role('toggle'), null, this)
        return
      }
      exec(this.on() ? this.role('off') : this.role('on'), null, this)
    }

    sync() {
      var on = this.on()
      this.dataset.on = on ? '1' : '0'
      var stateId = this.role('state')
      var text = (stateId === undefined) ? '' : format(stateId)
      var brightnessId = this.role('brightness')
      if (brightnessId !== undefined && on) {
        text = format(brightnessId)
      }
      this._state.textContent = text
      if (this.role('slider') !== undefined) {
        this.syncSlider(JG.VALUES[this.role('slider')])
      } else if (stateId !== undefined && JG.CMDS[stateId] && JG.CMDS[stateId].subType === 'numeric') {
        this.syncSlider(JG.VALUES[stateId])
      }
      this.syncMetrics()
    }
  }

  class JgCover extends JgCard {
    build() {
      this.header()
      var body = el('div', 'jg-card-body')
      this._state = el('span', 'jg-state', '')
      body.appendChild(this._state)
      this.appendChild(body)

      var slider = this.slider('slider', function (value, input) {
        exec(this.role('slider'), value, input)
      }.bind(this))
      if (slider) {
        this.appendChild(slider)
      }

      var bar = el('div', 'jg-actions')
      var buttons = [
        { role: 'up', icon: 'fas fa-chevron-up', label: '{{Monter}}' },
        { role: 'stop', icon: 'fas fa-stop', label: '{{Stop}}' },
        { role: 'down', icon: 'fas fa-chevron-down', label: '{{Descendre}}' }
      ]
      buttons.forEach(function (button) {
        if (this.role(button.role) === undefined) {
          return
        }
        var node = el('button', 'jg-btn jg-btn-icon')
        node.title = button.label
        node.appendChild(el('i', button.icon))
        node.addEventListener('click', function () { exec(this.role(button.role), null, node) }.bind(this))
        bar.appendChild(node)
      }, this)
      this.appendChild(bar)

      this.metrics(2)
      ;['state', 'slider'].forEach(function (role) {
        if (this.role(role) !== undefined) {
          watch(this.role(role), this)
        }
      }, this)
    }

    sync() {
      var stateId = this.role('state')
      if (stateId !== undefined) {
        var cmd = JG.CMDS[stateId]
        if (cmd && cmd.subType === 'numeric') {
          var percent = parseFloat(JG.VALUES[stateId])
          this._state.textContent = isNaN(percent) ? '—' : Math.round(percent) + ' %'
          this.dataset.on = (percent > 0) ? '1' : '0'
          this.syncSlider(percent)
        } else {
          this._state.textContent = format(stateId)
          this.dataset.on = isTrue(cmd, JG.VALUES[stateId]) ? '1' : '0'
        }
      }
      this.syncMetrics()
    }
  }

  /* Un capteur n'a rien à piloter : il dit ce qu'il mesure. La première mesure
   * est mise en avant, les autres suivent — c'est la lecture que l'on fait
   * réellement d'une carte de capteur, d'un coup d'oeil puis en détail. */
  class JgSensor extends JgCard {
    build() {
      var infos = this.device.cmds.filter(function (cmd) { return cmd.type === 'info' && cmd.visible })
      if (infos.length === 0) {
        infos = this.device.cmds.filter(function (cmd) { return cmd.type === 'info' })
      }
      this._primary = infos.length > 0 ? infos[0] : null
      this.header()

      var body = el('div', 'jg-card-body')
      this._value = el('span', 'jg-value', this._primary ? format(this._primary.id) : '—')
      body.appendChild(this._value)
      this.appendChild(body)
      if (this._primary) {
        this._subtitle.textContent = this._primary.name
        watch(this._primary.id, this)
      }

      this._rows = []
      var rest = infos.slice(1, 7)
      if (rest.length > 0) {
        var list = el('div', 'jg-rows')
        rest.forEach(function (cmd) {
          var row = el('div', 'jg-row')
          row.appendChild(el('span', 'jg-row-name', cmd.name))
          var value = el('span', 'jg-row-value', format(cmd.id))
          row.appendChild(value)
          list.appendChild(row)
          this._rows.push({ id: cmd.id, node: value })
          watch(cmd.id, this)
        }, this)
        this.appendChild(list)
      }
    }

    sync() {
      if (this._primary) {
        this._value.textContent = format(this._primary.id)
        var cmd = JG.CMDS[this._primary.id]
        if (cmd && cmd.subType === 'binary') {
          this.dataset.on = isTrue(cmd, JG.VALUES[this._primary.id]) ? '1' : '0'
        }
      }
      ;(this._rows || []).forEach(function (row) {
        row.node.textContent = format(row.id)
      })
    }
  }

  /* La carte de repli. Elle ne prétend rien comprendre : elle liste les infos
   * visibles et propose les actions visibles. C'est elle qui évite le trou noir
   * du dashboard qui ne sait pas afficher la moitié d'une installation. */
  class JgGeneric extends JgCard {
    build() {
      this.header()
      this._rows = []
      var infos = this.device.cmds.filter(function (cmd) { return cmd.type === 'info' && cmd.visible }).slice(0, 6)
      if (infos.length > 0) {
        var list = el('div', 'jg-rows')
        infos.forEach(function (cmd) {
          var row = el('div', 'jg-row')
          row.appendChild(el('span', 'jg-row-name', cmd.name))
          var value = el('span', 'jg-row-value', format(cmd.id))
          row.appendChild(value)
          list.appendChild(row)
          this._rows.push({ id: cmd.id, node: value })
          watch(cmd.id, this)
        }, this)
        this.appendChild(list)
      }

      /* Les commandes « message » attendent un titre et un corps ; un bouton qui
       * les enverrait vides ne rendrait service à personne, et l'échec est
       * silencieux côté équipement. Elles attendront leur propre carte. */
      var actions = this.device.cmds.filter(function (cmd) {
        if (cmd.type !== 'action' || !cmd.visible || cmd.subType === 'message') {
          return false
        }
        /* Une liste sans valeurs déclarées n'a rien à proposer : le bouton de
         * repli partirait sans le { select: … } que le coeur attend. */
        return !(cmd.subType === 'select' && !cmd.list)
      }).slice(0, 8)
      if (actions.length > 0) {
        var bar = el('div', 'jg-actions jg-actions-wrap')
        actions.forEach(function (cmd) {
          bar.appendChild(this.actionNode(cmd))
        }, this)
        this.appendChild(bar)
      }
    }

    actionNode(cmd) {
      if (cmd.subType === 'color') {
        /* Le coeur attend { color: '#rrggbb' } ; un bouton nu enverrait une
         * action sans couleur, que l'équipement refuse en silence. */
        var wrapColor = el('label', 'jg-color')
        var picker = document.createElement('input')
        picker.type = 'color'
        picker.addEventListener('change', function () { exec(cmd.id, picker.value, picker) })
        wrapColor.appendChild(picker)
        wrapColor.appendChild(el('span', null, cmd.name))
        return wrapColor
      }
      if (cmd.subType === 'select' && cmd.list) {
        var select = document.createElement('select')
        select.className = 'jg-select'
        select.appendChild(el('option', null, cmd.name))
        select.firstChild.value = ''
        cmd.list.forEach(function (option) {
          var node = el('option', null, option.label)
          node.value = option.value
          select.appendChild(node)
        })
        select.addEventListener('change', function () {
          if (select.value !== '') {
            exec(cmd.id, select.value, select)
            select.value = ''
          }
        })
        return select
      }
      if (cmd.subType === 'slider') {
        var wrap = el('div', 'jg-slider jg-slider-inline')
        var input = document.createElement('input')
        input.type = 'range'
        input.min = cmd.min !== undefined ? cmd.min : 0
        input.max = cmd.max !== undefined ? cmd.max : 100
        var bubble = el('span', 'jg-slider-value', cmd.name)
        input.addEventListener('change', function () { exec(cmd.id, parseInt(input.value, 10), input) })
        wrap.appendChild(input)
        wrap.appendChild(bubble)
        return wrap
      }
      var button = el('button', 'jg-btn', cmd.name)
      button.addEventListener('click', function () { exec(cmd.id, null, button) })
      return button
    }

    sync() {
      (this._rows || []).forEach(function (row) {
        row.node.textContent = format(row.id)
      })
    }
  }

  customElements.define('jg-card-light', class extends JgToggle {})
  customElements.define('jg-card-switch', class extends JgToggle {})
  customElements.define('jg-card-cover', JgCover)
  customElements.define('jg-card-sensor', JgSensor)
  customElements.define('jg-card-generic', JgGeneric)

  }

  function watch(cmdId, card) {
    if (!JG.WATCH[cmdId]) {
      JG.WATCH[cmdId] = []
    }
    if (JG.WATCH[cmdId].indexOf(card) === -1) {
      JG.WATCH[cmdId].push(card)
    }
  }

  function makeCard(device) {
    var tag = 'jg-card-' + device.card
    if (customElements.get(tag) === undefined) {
      tag = 'jg-card-generic'
    }
    var card = document.createElement(tag)
    card.device = device
    card.dataset.deviceId = device.id
    card.dataset.search = (device.name + ' ' + device.eqType).toLowerCase()
    return card
  }

  /* ------------------------------------------------------------- la structure */

  var sectionsNode = document.getElementById('jg-sections')
  var roomsNode = document.getElementById('jg-rooms')
  var emptyNode = document.getElementById('jg-empty')
  var searchNode = document.getElementById('jg-search')
  var brandNode = ROOT.querySelector('.jg-brand-name')

  brandNode.textContent = MODEL.title ? MODEL.title : 'jeeGlow'

  /* Le modèle s'arrête à un plafond d'équipements. Le taire donnerait un
   * dashboard incomplet sans que personne ne sache pourquoi. */
  if (MODEL.truncated) {
    var warning = el('div', 'jg-warning')
    warning.appendChild(el('i', 'fas fa-exclamation-triangle'))
    warning.appendChild(el('span', null, '{{Trop d\'équipements pour un seul dashboard : la liste est tronquée.}}'))
    ROOT.insertBefore(warning, sectionsNode)
  }

  var sections = {}

  function buildSections() {
    (MODEL.rooms || []).forEach(function (room) {
      if (!room.devices || room.devices.length === 0) {
        return
      }
      var section = el('section', 'jg-section')
      section.dataset.roomId = room.id
      var title = el('h2', 'jg-section-title')
      title.appendChild(el('span', 'jg-section-name', room.name))
      title.appendChild(el('span', 'jg-section-count', String(room.devices.length)))
      section.appendChild(title)
      var grid = el('div', 'jg-grid')
      room.devices.map(function (id) { return MODEL.devices[id] })
        .sort(function (a, b) { return a.order - b.order })
        .forEach(function (device) { grid.appendChild(makeCard(device)) })
      section.appendChild(grid)
      sectionsNode.appendChild(section)
      sections[room.id] = section
    })
  }

  /* Les pièces en pastilles plutôt qu'en menu : sur une tablette murale, on
   * change de pièce au pouce, sans viser. Le choix se lit dans l'URL (#room=5)
   * pour qu'une tablette puisse démarrer directement sur sa pièce. */
  function buildRoomFilter() {
    var chips = [{ id: 'all', name: '{{Tout}}' }].concat((MODEL.rooms || []).filter(function (room) {
      return room.devices && room.devices.length > 0
    }))
    if (chips.length <= 2) {
      roomsNode.hidden = true
      return
    }
    chips.forEach(function (room) {
      var chip = el('button', 'jg-chip', room.name)
      chip.dataset.roomId = room.id
      chip.addEventListener('click', function () {
        window.location.hash = (room.id === 'all') ? '' : 'room=' + room.id
        applyFilter()
      })
      roomsNode.appendChild(chip)
    })
  }

  function currentRoom() {
    var found = /room=(\d+)/.exec(window.location.hash)
    return found === null ? 'all' : found[1]
  }

  function applyFilter() {
    var room = currentRoom()
    var needle = searchNode.value.trim().toLowerCase()
    var visible = 0

    /* Pendant une recherche le filtre de pièce est suspendu : garder la
     * pastille allumée ferait croire qu'il s'applique encore. */
    roomsNode.querySelectorAll('.jg-chip').forEach(function (chip) {
      chip.classList.toggle('jg-chip-on', needle === '' && chip.dataset.roomId === room)
    })

    Object.keys(sections).forEach(function (roomId) {
      var section = sections[roomId]
      var matching = 0
      section.querySelectorAll('.jg-card').forEach(function (card) {
        var hidden = (needle !== '' && card.dataset.search.indexOf(needle) === -1)
        card.hidden = hidden
        if (!hidden) {
          matching++
        }
      })
      /* Une recherche traverse les pièces : chercher « volet » depuis la
       * cuisine et ne rien trouver alors que le volet existe au salon serait
       * une fausse réponse. */
      var wrongRoom = (room !== 'all' && roomId !== room && needle === '')
      section.hidden = wrongRoom || matching === 0
      if (!section.hidden) {
        visible += matching
      }
    })

    emptyNode.hidden = (visible > 0)
  }

  /* ---------------------------------------------------------------- ambiance */

  /* Le thème de Jeedom n'annonce pas s'il est clair ou sombre : il pose des
   * couleurs. On lit donc la luminosité du fond et on s'y accorde, ce qui
   * marche aussi avec un thème que nous ne connaissons pas. */
  function readTone() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim()
    var parts = raw.split(',').map(function (part) { return parseInt(part, 10) })
    if (parts.length < 3 || parts.some(isNaN)) {
      return 'light'
    }
    var luminance = (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255
    return luminance < 0.5 ? 'dark' : 'light'
  }

  function syncTone() {
    ROOT.dataset.tone = readTone()
  }

  /* -------------------------------------------------------------- plein écran */

  function setFullscreen(on) {
    /* body.fullscreen est une règle du coeur (desktop.main.css) : header et
     * footer disparaissent. Rien à réécrire, et le jour où Jeedom change sa
     * mise en page, nous suivons sans rien faire. */
    document.body.classList.toggle('fullscreen', on)
    ROOT.dataset.kiosk = on ? '1' : '0'
    var icon = document.querySelector('#jg-fullscreen i')
    icon.className = on ? 'fas fa-compress' : 'fas fa-expand'

    /* L'URL suit l'état : une tablette qu'on recharge — ou qu'on met en page
     * d'accueil — retrouve son mode kiosque sans intervention. */
    var url = new URL(window.location.href)
    if (on) {
      url.searchParams.set('fullscreen', '1')
    } else {
      url.searchParams.delete('fullscreen')
    }
    window.history.replaceState(null, '', url.toString())
  }

  /* ------------------------------------------------------------- rafraîchir */

  /* Le modèle est rendu avec la page. Un équipement ajouté, renommé ou rangé
   * dans une autre pièce n'apparaîtrait donc qu'au rechargement — or une
   * tablette murale n'est jamais rechargée. On relit le modèle quand la page
   * redevient visible, et seulement si elle a dormi : personne n'est interrompu
   * en train de la regarder. */
  var REFRESH_AFTER = 300000
  var loadedAt = Date.now()

  function render(model) {
    MODEL = model
    indexModel()
    sections = {}
    sectionsNode.textContent = ''
    roomsNode.textContent = ''
    roomsNode.hidden = false
    buildSections()
    buildRoomFilter()
    applyFilter()
  }

  function refreshModel() {
    if (document.hidden || !document.body.contains(ROOT) || Date.now() - loadedAt < REFRESH_AFTER) {
      return
    }
    var form = new FormData()
    form.append('action', 'model')
    fetch('plugins/jeeglowbe/core/ajax/jeeglowbe.ajax.php', {
      method: 'POST', body: form, credentials: 'same-origin'
    }).then(function (response) {
      return response.json()
    }).then(function (data) {
      if (!data || data.state !== 'ok' || !data.result) {
        return
      }
      loadedAt = Date.now()
      render(data.result)
    }).catch(function () {
      /* Réseau coupé, session expirée : on garde à l'écran ce qu'on avait
       * plutôt que de vider le dashboard. */
    })
  }

  /* ------------------------------------------------------------------ démarrage */

  indexModel()
  buildSections()
  buildRoomFilter()
  applyFilter()
  syncTone()

  searchNode.addEventListener('input', applyFilter)
  window.addEventListener('hashchange', applyFilter)
  document.addEventListener('visibilitychange', refreshModel)
  document.getElementById('jg-fullscreen').addEventListener('click', function () {
    setFullscreen(!document.body.classList.contains('fullscreen'))
  })
  if (urlVar('fullscreen') === '1') {
    setFullscreen(true)
  }

  /* Quitter la page, dans Jeedom, c'est un remplacement de contenu en ajax :
   * aucun événement de déchargement n'est émis, et nos écouteurs sur
   * document.body survivraient à chaque aller-retour. Surtout, la classe
   * fullscreen resterait posée sur le body : tout Jeedom se retrouverait sans
   * menu ni pied de page, sans moyen de les rétablir depuis l'interface. */
  var observer = null

  function teardown() {
    document.body.removeEventListener('cmd::update', onCmdUpdate)
    document.body.removeEventListener('changeTheme', onThemeChange)
    document.body.removeEventListener('checkThemechange', onThemeChange)
    document.removeEventListener('visibilitychange', refreshModel)
    window.removeEventListener('hashchange', applyFilter)
    document.body.classList.remove('fullscreen')
    if (observer !== null) {
      observer.disconnect()
      observer = null
    }
  }

  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(function () {
      if (!document.body.contains(ROOT)) {
        teardown()
      }
    })
    observer.observe(document.getElementById('div_pageContainer') || document.body, { childList: true })
  }

  function onCmdUpdate(event) {
    /* Filet de sécurité si l'observateur n'a pas vu le remplacement. */
    if (!document.body.contains(ROOT)) {
      teardown()
      return
    }
    var updates = Array.isArray(event.detail) ? event.detail : [event.detail]
    var touched = []
    updates.forEach(function (update) {
      var id = parseInt(update.cmd_id, 10)
      if (JG.CMDS[id] === undefined) {
        return
      }
      JG.VALUES[id] = update.value
      ;(JG.WATCH[id] || []).forEach(function (card) {
        if (touched.indexOf(card) === -1) {
          touched.push(card)
        }
      })
    })
    touched.forEach(function (card) { card.sync() })
  }

  function onThemeChange() {
    /* Le coeur bascule la feuille de style de façon asynchrone : relire les
     * variables tout de suite renverrait encore l'ancien thème. */
    setTimeout(syncTone, 300)
  }

  document.body.addEventListener('cmd::update', onCmdUpdate)
  document.body.addEventListener('changeTheme', onThemeChange)
  document.body.addEventListener('checkThemechange', onThemeChange)
})()
