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

  /* Le dashboard vivant du moment. Jeedom recharge ses pages en ajax : pendant
   * un court instant, l'ancien dashboard est encore dans la mémoire tandis que
   * le nouveau est déjà à l'écran. Sans ce repère, le ménage de l'ancien retire
   * le plein écran que le nouveau vient de poser — une tablette en kiosque
   * sortait du kiosque à chaque aller-retour dans le menu. */
  JG.LIVE = ROOT
  /* Et non les seuls index.
   *
   * La note ci-dessus explique pourquoi les index vivent sur cet objet ; la
   * règle est en fait plus large, et l'avoir sous-estimée a coûté un défaut
   * silencieux. Le bloc d'enregistrement des cartes ne s'exécute qu'au PREMIER
   * chargement : toutes les cartes construites ensuite sont des instances des
   * classes de ce premier passage, et tout ce qu'elles lisent dans la
   * fermeture est celui du premier passage — un panneau détaché du document,
   * un modèle périmé. Le symptôme est muet : appuyer sur la pastille d'une
   * carte n'ouvrait plus rien après un aller-retour dans le menu de Jeedom.
   *
   * La règle, désormais : rien de ce que le bloc lit ne doit vivre dans la
   * fermeture, sauf ce qui est constant ou pur. */
  JG.openPanel = function (deviceId) { openPanel(deviceId) }
  JG.setRoom = function (device, roomId, source) { setRoom(device, roomId, source) }
  JG.MODEL = MODEL
  JG.CMDS = {}
  JG.VALUES = {}
  JG.WATCH = {}

  function indexModel() {
    JG.CMDS = {}
    JG.VALUES = {}
    JG.WATCH = {}
    /* La pièce d'un équipement est demandée une fois par carte dessinée, et le
     * modèle ne la porte que sous forme d'un identifiant. Une table plate évite
     * de parcourir la liste des pièces quatre cents fois par rendu. */
    JG.ROOMS = {}
    /* À quel équipement appartient une commande. Une pastille de l'accueil doit
     * pouvoir nommer sa source et y mener : un nombre sans attribution n'est
     * pas une information. */
    JG.OWNER = {}
    /* Les commandes qui disent si un équipement est en marche. Une bascule ne
     * change pas seulement une valeur, elle change la composition de la liste
     * « en ce moment » de l'accueil : il faut savoir la reconnaître dans le
     * flot des mises à jour sans parcourir tout le modèle à chaque fois. */
    JG.STATES = {}
    ;(MODEL.rooms || []).forEach(function (room) {
      JG.ROOMS[room.id] = room
    })
    Object.keys(MODEL.devices || {}).forEach(function (key) {
      /* En mode édition le modèle porte aussi ce qui ne se dessine pas, pour
       * qu'on puisse le rétablir. Les cartes, elles, ne doivent rien en savoir :
       * régler l'affichage ne doit pas changer l'affichage qu'on est en train
       * de régler. On met donc de côté la liste complète — le panneau s'en
       * sert — et cmds ne garde que ce qui se dessine, exactement comme hors
       * mode édition. */
      if (MODEL.reveal && MODEL.devices[key].all === undefined) {
        MODEL.devices[key].all = MODEL.devices[key].cmds
        MODEL.devices[key].cmds = MODEL.devices[key].cmds.filter(function (cmd) {
          return cmd.drawn !== false
        })
      }
      MODEL.devices[key].cmds.forEach(function (cmd) {
        JG.OWNER[cmd.id] = MODEL.devices[key].id
        /* La commande garde le domaine de son équipement : c'est ce qui permet
         * de préférer le thermomètre du salon à la sonde interne d'une prise
         * quand on cherche « la » température de la maison. */
        cmd.domain = MODEL.devices[key].domain
        JG.CMDS[cmd.id] = cmd
        if (cmd.type === 'info') {
          JG.VALUES[cmd.id] = cmd.value
        }
      })
      var stateId = MODEL.devices[key].roles ? MODEL.devices[key].roles.state : undefined
      if (stateId !== undefined) {
        JG.STATES[stateId] = true
      }
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

  /* Le nom de la pièce d'un équipement, vide s'il n'est rangé nulle part. */
  function roomName(device) {
    var room = JG.ROOMS[device.roomId]
    return (room && room.id !== 0) ? room.name : ''
  }

  /* Ce dans quoi la recherche cherche.
   *
   * La pièce en fait partie : chercher « cuisine » et ne rien trouver parce
   * qu'aucun équipement ne porte le mot dans son nom serait une fausse
   * réponse.
   *
   * Le nom réel aussi, et c'est ce qui manquait. Les noms courts sont actifs
   * par défaut, et ils retirent précisément ce par quoi on cherche un
   * équipement dont on ne connaît que le matériel : sur l'installation
   * d'essai, trente et un équipements sur soixante-quatre affichent un nom
   * dont le nom Jeedom a disparu, et taper « Shelly » ou « OpenMQTTGateway »
   * ne renvoyait rien — eqType, lui, vaut « mqttbe » ou « dahua ». Le modèle
   * transporte déjà realName pour l'afficher en sous-titre ; le chercher ne
   * coûte qu'une concaténation.
   *
   * Recalculé à chaque fois, et non retenu sur l'équipement : startRename()
   * change device.name en place sans relire le modèle, et un foin mis en
   * cache ferait retrouver un équipement par un nom qu'il ne porte plus.
   * Quatre cents concaténations par rendu ne se mesurent pas — et il n'y a
   * plus qu'un rendu par recherche. */
  function haystack(device) {
    return (device.name + ' ' + (device.realName || '') + ' '
      + device.eqType + ' ' + roomName(device)).toLowerCase()
  }

  /* Relancer une animation demande de la retirer, de forcer un recalcul, puis
   * de la reposer : sans la lecture de offsetWidth, deux changements coup sur
   * coup ne produisent qu'un seul clignotement. */
  function flash(node, className) {
    var name = className || 'jg-flash'
    node.classList.remove(name)
    void node.offsetWidth
    node.classList.add(name)
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
    PRESENCE: ['{{Présent}}', '{{Absent}}'],
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

  /* Les états qui ne sont pas « allumé » mais « au secours ». Ils gardent le
   * remplissage plein, que tout le reste abandonne : une couleur saturée ne
   * garde son pouvoir d'alerte que si elle est rare. */
  var ALARMS = ['SMOKE', 'FLOOD', 'WATER_LEAK', 'SABOTAGE', 'ALARM_STATE', 'GAS', 'CO']

  /* ------------------------------------------------------------------- JSON
   *
   * Beaucoup de plugins rangent une structure entière dans une commande info de
   * type chaîne : une prochaine collecte, l'état d'un onduleur, la dernière
   * alerte d'une caméra. Sur un dashboard, afficher la valeur telle quelle
   * donne une accolade suivie de trois cents caractères, et l'information est
   * perdue au milieu de sa propre syntaxe.
   *
   * On ne peut pas connaître ces structures — chaque plugin invente la sienne,
   * avec des clés parfois réduites à une lettre. On peut en revanche décider
   * quoi mettre en avant : la carte montre le champ le plus lisible, et le
   * détail s'ouvre d'un appui.
   */

  function jsonOf(cmdId) {
    var cmd = JG.CMDS[cmdId]
    var value = JG.VALUES[cmdId]
    if (cmd === undefined || typeof value !== 'string') {
      return null
    }
    var text = value.trim()
    if (text === '' || (text.charAt(0) !== '{' && text.charAt(0) !== '[')) {
      return null
    }
    try {
      var parsed = JSON.parse(text)
    } catch (error) {
      return null
    }
    return (parsed !== null && typeof parsed === 'object') ? parsed : null
  }

  /* Un entier de dix chiffres dans les bornes raisonnables est un horodatage :
   * « 1789913135 » ne dit rien, « 20/09/2026 16:05 » dit tout. */
  function isEpoch(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value &&
      value >= 1000000000 && value <= 4102444800
  }

  /* Une date sur une tuile se lit d'un coup d'oeil ou ne se lit pas.
   * toLocaleString() rend « 9/20/2026, 4:05:35 PM » : la langue dépend du
   * navigateur et non de Jeedom, les secondes n'intéressent personne, et deux
   * lignes de date mangent la carte. On compose donc nous-mêmes, du plus court
   * au plus complet : l'heure seule aujourd'hui, le jour et l'heure cette
   * année, la date entière au-delà. */
  function pad(number) {
    return (number < 10 ? '0' : '') + number
  }

  function dateText(seconds) {
    var date = new Date(seconds * 1000)
    var now = new Date()
    var time = pad(date.getHours()) + ':' + pad(date.getMinutes())
    var day = pad(date.getDate()) + '/' + pad(date.getMonth() + 1)
    if (date.toDateString() === now.toDateString()) {
      return time
    }
    if (date.getFullYear() === now.getFullYear()) {
      return day + ' ' + time
    }
    return day + '/' + date.getFullYear() + ' ' + time
  }

  function scalarText(value) {
    if (value === true) {
      return '{{Oui}}'
    }
    if (value === false) {
      return '{{Non}}'
    }
    if (isEpoch(value)) {
      return dateText(value)
    }
    return String(value)
  }

  /* Ce qui mérite d'être lu en premier. Une phrase vaut mieux qu'un mot, un mot
   * mieux qu'un nombre, et un nombre mieux qu'une empreinte ou qu'un
   * horodatage — que personne ne lit comme une information. */
  function scoreScalar(value) {
    if (value === null || value === undefined || typeof value === 'object') {
      return -1
    }
    if (typeof value === 'boolean') {
      return 1
    }
    if (typeof value === 'number') {
      return isEpoch(value) ? 0 : 2
    }
    var text = String(value)
    if (text === '') {
      return -1
    }
    if (/^[0-9a-f._:-]{12,}$/i.test(text)) {
      return 0
    }
    /* « fas fa-cloud-sun » est une consigne de dessin, pas une information : le
     * bulletin météo du plugin range son icône à côté de sa condition, et le
     * classement la trouvait aussi lisible que « Peu nuageux ». */
    if (/(^|\s)fa[srlbdk]?(\s+fa-|-)/i.test(text) || /^(mdi|icon|jeedom)-/i.test(text)) {
      return 0
    }
    if (/[A-Za-zÀ-ÿ]/.test(text)) {
      return /\s/.test(text) ? 4 : 3
    }
    return 1
  }

  /* Les clés qui ne disent rien de plus que leur valeur : les répéter devant
   * elle n'ajoute que du bruit. Les clés d'une ou deux lettres sont dans le même
   * cas, faute de vouloir dire quoi que ce soit pour un lecteur. */
  var MUTE_KEYS = ['label', 'name', 'nom', 'text', 'texte', 'title', 'titre', 'value', 'valeur',
    'summary', 'resume', 'message', 'description', 'desc', 'state', 'status', 'etat', 'info']

  function labelled(key, value) {
    var text = scalarText(value)
    /* Une valeur qui est déjà une phrase se suffit : « countdown dans 3 jours »
     * répète en anglais technique ce que le français dit juste après. La clé ne
     * sert que devant un nombre ou un mot isolé, où elle dit de quoi on parle. */
    if (key.length <= 2 || scoreScalar(value) >= 4 || MUTE_KEYS.indexOf(key.toLowerCase()) !== -1) {
      return text
    }
    return key + ' ' + text
  }

  function jsonSummary(parsed) {
    if (Array.isArray(parsed)) {
      return parsed.length + ' ' + (parsed.length > 1 ? '{{éléments}}' : '{{élément}}')
    }
    var ranked = Object.keys(parsed).map(function (key) {
      return { key: key, score: scoreScalar(parsed[key]) }
    }).filter(function (entry) {
      return entry.score > 0
    }).sort(function (a, b) {
      return b.score - a.score
    })

    if (ranked.length > 0) {
      var summary = labelled(ranked[0].key, parsed[ranked[0].key])
      /* Un second champ seulement s'il est lui aussi une phrase : « jeudi 24/09
       * · dans 3 jours » vaut mieux qu'une date seule, alors que « NORD Ligne
       * franchie · p 0 » ne vaut rien de plus que la première moitié. */
      if (ranked.length > 1 && ranked[1].score >= 4 && summary.length < 34) {
        summary += ' · ' + labelled(ranked[1].key, parsed[ranked[1].key])
      }
      return summary
    }
    var count = Object.keys(parsed).length
    return count + ' ' + (count > 1 ? '{{champs}}' : '{{champ}}')
  }

  /* Un élément de liste, réduit à ce qui l'identifie et à ce qui le qualifie :
   * son nom d'un côté, son état de l'autre. Les champs restants attendent dans
   * la valeur, séparés par des points médians, tant qu'ils tiennent. */
  function elementPair(item) {
    var ranked = Object.keys(item).map(function (key) {
      return { key: key, score: scoreScalar(item[key]) }
    }).filter(function (entry) {
      return entry.score > 0
    }).sort(function (a, b) {
      return b.score - a.score
    })
    if (ranked.length === 0) {
      return { name: '', value: jsonSummary(item) }
    }
    var name = scalarText(item[ranked[0].key])
    /* Ce qui qualifie l'élément, pas ce qui le décrit en détail : sur onze
     * unités de police, « RIEN » est la réponse, « RIEN · 1 · 0 · 1 » est un
     * vidage de mémoire. On ne descend aux nombres qu'à défaut de mots. */
    var rest = ranked.slice(1).filter(function (entry) { return entry.score >= 3 })
    if (rest.length === 0) {
      rest = ranked.slice(1).filter(function (entry) { return entry.score >= 2 })
    }
    return {
      name: name,
      value: rest.slice(0, 2).map(function (entry) {
        return labelled(entry.key, item[entry.key])
      }).join(' · ')
    }
  }

  /* Le détail, à la demande : une ligne par champ, les structures imbriquées
   * annoncées par leur taille et leurs éléments résumés à leur tour. Le JSON
   * brut serait plus fidèle et illisible — c'est précisément ce qu'on répare. */
  var DETAIL_MAX = 24

  /* Ce qu'une carte montre d'emblée. Au-delà, elle cesse d'être une tuile ;
   * le reste est à un appui. */
  var ROW_LIMIT = 3
  var ACTION_LIMIT = 4

  function jsonDetails(parsed) {
    var box = el('div', 'jg-json')
    var lines = 0

    function line(name, text) {
      if (lines >= DETAIL_MAX) {
        return
      }
      lines++
      var row = el('div', 'jg-json-row')
      row.appendChild(el('span', 'jg-json-key', name))
      row.appendChild(el('span', 'jg-json-value', text))
      box.appendChild(row)
    }

    function walk(key, value) {
      if (value === null || value === undefined) {
        line(key, '—')
        return
      }
      if (Array.isArray(value)) {
        line(key, value.length + ' ' + (value.length > 1 ? '{{éléments}}' : '{{élément}}'))
        value.forEach(function (item) {
          if (item !== null && typeof item === 'object') {
            /* Deux champs, pas un : « PJF Mons-Tournai » seul ne dit pas si
             * cette unité a une offre, et c'est toute la question qu'on se pose
             * en dépliant une liste. */
            var pair = elementPair(item)
            line(pair.name, pair.value)
          } else {
            line('', scalarText(item))
          }
        })
        return
      }
      if (typeof value === 'object') {
        line(key, jsonSummary(value))
        return
      }
      line(key, scalarText(value))
    }

    if (Array.isArray(parsed)) {
      walk('', parsed)
    } else {
      Object.keys(parsed).forEach(function (key) { walk(key, parsed[key]) })
    }
    if (lines >= DETAIL_MAX) {
      box.appendChild(el('div', 'jg-json-more', '…'))
    }
    return box
  }

  /* ------------------------------------------------------------------ images
   *
   * Une poignée de commandes ne contiennent pas une valeur mais l'adresse d'une
   * image : la carte d'un robot, l'instantané d'une caméra, la photo d'un
   * portier. Afficher l'adresse, c'est montrer le chemin plutôt que le lieu.
   *
   * On ne peut pas savoir à coup sûr ce que rend « map.php?id=237 ». On tente
   * donc le chargement, et le texte reprend sa place si ce n'était pas une
   * image : c'est la seule méthode qui marche sans connaître chaque plugin. */
  /* Les adresses qui ont déjà échoué. Sans cette mémoire, le repli en texte
   * reconstruirait une image, qui échouerait, qui replierait en texte : la page
   * tournerait en rond. La clé est l'adresse et non la commande, pour qu'un
   * nouvel instantané ait droit à sa chance. */
  JG.BROKEN = JG.BROKEN || {}

  function imageUrl(cmdId) {
    var cmd = JG.CMDS[cmdId]
    var value = JG.VALUES[cmdId]
    if (cmd === undefined || typeof value !== 'string') {
      return null
    }
    var text = value.trim()
    if (text === '' || text.length > 500 || /\s/.test(text)) {
      return null
    }
    if (/^data:image\//i.test(text)) {
      return text
    }
    if (!/^https?:\/\//i.test(text) && text.indexOf('/') === -1) {
      return null
    }
    if (JG.BROKEN[text]) {
      return null
    }
    if (cmd.generic === 'CAMERA_URL' || /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(text) ||
        /\.php(\?|$)/i.test(text)) {
      return text
    }
    return null
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
    var parsed = jsonOf(cmdId)
    if (parsed !== null) {
      return jsonSummary(parsed)
    }
    if (cmd.subType === 'numeric') {
      var number = parseFloat(value)
      if (isNaN(number)) {
        return String(value)
      }
      /* Un horodatage Unix sans unité n'est pas une mesure : « 1789913135 »
       * n'apprend rien à personne. L'absence d'unité est la garde qui évite de
       * transformer un compteur d'énergie en date — un compteur porte un Wh. */
      if (cmd.unit === '' && isEpoch(number)) {
        return dateText(number)
      }
      var rounded = (Math.abs(number % 1) < 0.05) ? Math.round(number) : Math.round(number * 10) / 10
      return String(rounded) + (cmd.unit ? ' ' + cmd.unit : '')
    }
    return String(value) + (cmd.unit ? ' ' + cmd.unit : '')
  }

  /* Ce qui mérite la taille d'affichage d'une carte : un nombre qui se mesure,
   * et rien d'autre. La règle suit exactement ce que format() rend — un entier
   * sans unité dans les bornes d'un horodatage en ressort en date, et une date
   * en vingt-six pixels gras n'est pas plus une mesure qu'une phrase. */
  function isMeasure(cmd) {
    if (cmd.subType !== 'numeric') {
      return false
    }
    return !(cmd.unit === '' && isEpoch(parseFloat(JG.VALUES[cmd.id])))
  }

  /* L'état d'une entrée physique n'est pas une mesure : « Événement entrée 1 :
   * Non » et « Appui long 1 » occupaient les deux lignes d'une carte de prise,
   * devant la puissance et la température. */
  var NOISY = ['BUTTON', 'ONLINE', 'DONT']

  /* Ce qui se mesure passe devant ce qui se raconte, et un nombre avec son
   * unité devant un nombre nu. */
  function metricRank(cmd) {
    if (cmd.subType === 'numeric') {
      return cmd.unit ? 3 : 2
    }
    if (cmd.subType === 'string') {
      return 1
    }
    return 0
  }

  /* Le niveau de pile, de deux sources qui ne se valent pas.
   *
   * eqLogic::getStatus('battery') est la source officielle, mais elle n'est
   * alimentée que par les plugins qui appellent eqLogic::batteryStatus() — et
   * beaucoup ne le font pas : sur une installation où aucun ne l'appelle, la
   * pastille de pile n'apparaîtrait jamais alors que des équipements
   * remontent bel et bien leur niveau par une commande de type BATTERY. On
   * retombe donc sur cette commande, qui, elle, existe toujours. */
  function batteryLevel(device) {
    if (device.battery !== null && device.battery !== undefined && device.battery !== '') {
      return parseInt(device.battery, 10)
    }
    for (var i = 0; i < device.cmds.length; i++) {
      if (device.cmds[i].generic !== 'BATTERY') {
        continue
      }
      var value = parseFloat(JG.VALUES[device.cmds[i].id])
      if (!isNaN(value)) {
        return Math.round(value)
      }
    }
    return null
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
    /* Le domaine décide de l'icône dès qu'il dit quelque chose : une caméra
     * porte une caméra, même si sa première commande typée est une présence —
     * c'était un bonhomme qui marche. Les capteurs et les équipements
     * d'information, eux, n'ont pas de domaine parlant : leur icône vient de ce
     * qu'ils mesurent. */
    if (device.domain !== undefined && device.domain !== 'info' && device.domain !== 'sensor') {
      var icon = domainOf(device.domain).icon
      if (icon) {
        return icon
      }
    }
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
    /* « Ça part » et « c'est désactivé » ne doivent pas se ressembler, et
     * l'attente doit durer ce que dure l'aller-retour, pas 900 millisecondes
     * décidées d'avance : une commande Zigbee qui met trois secondes affichait
     * un dashboard immobile, et une commande instantanée gardait une carte
     * grisée bien après coup. Le délai ne sert plus que de garde-fou si le
     * coeur ne rappelle jamais. */
    var done = function (failed) {
      if (!source) {
        return
      }
      clearTimeout(source._jgBusy)
      source._jgBusy = null
      source.classList.remove('jg-busy')
      if (!failed) {
        return
      }
      /* L'échec se voit sur la carte fautive. Le bandeau du coeur est en haut
       * de la page : sur un mur, il est à un mètre de ce qui a raté. */
      source.classList.add('jg-failed')
      setTimeout(function () { source.classList.remove('jg-failed') }, 2500)
    }
    if (source) {
      source.classList.add('jg-busy')
      clearTimeout(source._jgBusy)
      source._jgBusy = setTimeout(function () { done(false) }, 8000)
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
    params.success = function () { done(false) }
    params.error = function (error) {
      done(true)
      if (typeof jeedomUtils !== 'undefined' && jeedomUtils.showAlert) {
        jeedomUtils.showAlert({ message: (error && error.message) ? error.message : String(error), level: 'danger' })
      }
    }
    jeedom.cmd.execute(params)
  }

  /* --------------------------------------------------------------- les cartes */

  /* Trois familles que le modèle ne sait pas classer, parce qu'il classe par
   * rôles pilotables et qu'elles n'en ont aucun au sens des cartes existantes.
   * Elles retombaient donc toutes sur la carte générique — dix-huit caméras
   * réduites à « Perte vidéo — » suivi de trois lignes binaires.
   *
   * Ces trois déclarations vivent hors du bloc d'enregistrement ci-dessous, et
   * ce n'est pas un détail de rangement : ce bloc ne s'exécute qu'au tout
   * premier chargement, et le fichier est en mode strict, où une fonction
   * déclarée dans un bloc ne sort pas de ce bloc. Placées dedans, elles
   * seraient introuvables dès le second passage — c'est-à-dire à chaque retour
   * sur le dashboard par le menu de Jeedom. */
  var CLIMATE_MARKS = ['THERMOSTAT_STATE', 'THERMOSTAT_TEMPERATURE', 'THERMOSTAT_SETPOINT',
    'THERMOSTAT_SET_SETPOINT', 'THERMOSTAT_MODE', 'THERMOSTAT_SET_MODE']
  var MEDIA_MARKS = ['MEDIA_STATE', 'MEDIA_STATUS', 'MEDIA_TITLE', 'MEDIA_PAUSE', 'MEDIA_RESUME']

  function firstGeneric(device, names) {
    for (var i = 0; i < device.cmds.length; i++) {
      if (names.indexOf(device.cmds[i].generic) !== -1) {
        return device.cmds[i]
      }
    }
    return null
  }

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
      /* La carte réellement construite, et non celle que le modèle a proposée :
       * une caméra ou un thermostat sont reconnus côté page, et une règle de
       * style qui les viserait par device.card ne les trouverait jamais. */
      this.dataset.cardType = this.tagName.replace('JG-CARD-', '').toLowerCase()
      if (this.device.category) {
        this.dataset.category = this.device.category
      }
      /* Le domaine en plus de la catégorie. La catégorie est le meilleur
       * renseignement quand elle existe — mais sur l'installation d'essai,
       * quarante-trois équipements sur soixante-quatre n'en ont aucune, et
       * leur pastille restait grise. Le domaine, lui, est toujours déduit. */
      if (this.device.domain) {
        this.dataset.domain = this.device.domain
      }
      /* Décidé avant build() : l'en-tête a besoin de savoir s'il doit garder
       * l'ouverture du détail ou la céder à la pastille. */
      this._actionable = this.actionable()
      this.dataset.actionable = this._actionable ? '1' : '0'
      /* Le panneau est en train d'être lu : il n'a pas à porter la marque de ce
       * qu'on ignore, il la dit en toutes lettres sur ses lignes. */
      if (this.tagName !== 'JG-CARD-DETAIL') {
        this.markUnknown()
      }
      /* Les commandes d'alarme sont repérées ici, et non dans chaque carte :
       * un détecteur de fumée est une carte capteur, un sabotage arrive sur
       * une carte générique, et une alarme sur une bascule. Chercher le rôle
       * « état » ne les aurait trouvés que sur la dernière. */
      this._alarms = this.device.cmds.filter(function (cmd) {
        return cmd.type === 'info' && ALARMS.indexOf(cmd.generic) !== -1
      })
      this._alarms.forEach(function (cmd) { watch(cmd.id, this) }, this)
      this.build()
      this.sync()
    }

    /* Une carte est « actionnable » quand un appui dessus fait quelque chose.
     * La distinction n'est pas décorative : elle décide de la forme de la
     * pastille, du rôle ARIA et de qui ouvre le détail. Un variateur qui
     * n'expose qu'un curseur, une prise qui ne rapporte que sa consommation,
     * répondent non. */
    actionable() {
      return false
    }

    /* La bascule d'état est le seul changement qui mérite que la carte entière
     * se signale : c'est celui qu'on cherche des yeux depuis l'autre bout de la
     * pièce. Les mesures, elles, se contentent du clignotement de leur valeur. */
    markState(on) {
      var next = on ? '1' : '0'
      if (this.dataset.on === next) {
        return
      }
      var known = this.dataset.on !== undefined
      this.dataset.on = next
      if (known) {
        flash(this, 'jg-card-ping')
      }
    }

    /* Vrai, mais pas « allumé ».
     *
     * Une porte ouverte, une présence détectée, un mouvement devant une caméra
     * sont des états vrais qu'il faut voir — mais un capteur ne se pilote pas,
     * et lui donner l'aplat de l'état allumé faisait passer « Déclenchée : Oui »
     * pour une alarme en cours. La marque est donc distincte, et son traitement
     * l'est aussi : un liseré et une icône pleine, jamais un fond rempli. */
    markActive(on) {
      var next = on ? '1' : '0'
      if (this.dataset.active === next) {
        return
      }
      var known = this.dataset.active !== undefined
      this.dataset.active = next
      if (known) {
        flash(this, 'jg-card-ping')
      }
    }

    /* Ce qui se pilote sans jamais dire où il en est : une applique commandée
     * par deux boutons sans retour, un variateur qui n'expose qu'un curseur.
     * Sans cette marque, la carte est dessinée comme une carte éteinte — et ne
     * pas savoir n'est pas savoir que c'est éteint. */
    markUnknown() {
      var pilots = ['toggle', 'on', 'off', 'up', 'down', 'slider'].some(function (name) {
        return this.role(name) !== undefined
      }, this)
      if (pilots && this.role('state') === undefined) {
        this.dataset.unknown = '1'
      }
    }

    /* Une fuite d'eau et une lampe allumée ne peuvent pas produire le même
     * événement visuel. La couleur pleine, devenue rare, leur est réservée. */
    syncAlert() {
      /* Le panneau n'est pas une tuile : il est déjà ouvert devant les yeux de
       * quelqu'un, et le repeindre en rouge plein ne lui apprendrait rien
       * qu'il ne soit en train de lire. */
      if (this.tagName === 'JG-CARD-DETAIL') {
        return
      }
      var alarming = (this._alarms || []).some(function (cmd) {
        return isTrue(cmd, JG.VALUES[cmd.id])
      })
      if (alarming) {
        this.dataset.alert = '1'
      } else {
        this.removeAttribute('data-alert')
      }
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

    /* Où se trouve l'équipement, quand la vue courante ne le dit pas déjà. En
     * vue Fonctions — celle où l'on arrive — « Plafonnier » et « Plafonnier »
     * sont deux cartes identiques, et rien n'indique laquelle est la cuisine.
     * En vue Pièces, la section porte déjà le nom : le répéter serait du
     * bruit. */
    place() {
      return (state().view === 'rooms') ? '' : roomName(this.device)
    }

    showSubtitle(text) {
      var place = this.place()
      var parts = [place, text].filter(function (part) { return part })
      this._subtitle.textContent = parts.join(' · ')
    }

    header(subtitle) {
      var head = el('div', 'jg-card-head')
      var opens = this.tagName !== 'JG-CARD-DETAIL'

      /* Qui ouvre le détail, et qui agit ?
       *
       * Tant que l'en-tête entier ouvrait le détail, la bascule ne disposait
       * que du bas de la carte : sur une tuile courte, la moitié de la cible
       * était perdue. C'est exactement le reproche adressé aux dashboards qui
       * ont logé leur action rapide dans un coin — on gagne un bouton, on perd
       * la surface qui comptait.
       *
       * La règle s'inverse donc dès qu'il y a quelque chose à basculer : toute
       * la carte agit, et seule la pastille d'icône ouvre le détail. Sur une
       * carte qui ne pilote rien, il n'y a pas de conflit et l'en-tête entier
       * reprend son rôle d'ouverture, qui est alors le seul geste possible. */
      var icon
      if (opens && this._actionable) {
        icon = el('button', 'jg-card-icon jg-card-open')
        icon.type = 'button'
        icon.title = '{{Voir le détail}}'
        icon.setAttribute('aria-label', '{{Voir le détail}}')
        icon.addEventListener('click', function (event) {
          event.stopPropagation()
          event.preventDefault()
          JG.openPanel(this.device.id)
        }.bind(this))
      } else {
        icon = el('span', 'jg-card-icon')
      }
      icon.appendChild(el('i', deviceIcon(this.device)))

      if (opens && !this._actionable) {
        head.classList.add('jg-head-open')
        head.setAttribute('role', 'button')
        head.setAttribute('tabindex', '0')
        head.title = '{{Voir le détail}}'
        var open = function (event) {
          event.stopPropagation()
          event.preventDefault()
          JG.openPanel(this.device.id)
        }.bind(this)
        head.addEventListener('click', open)
        head.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            open(event)
          }
        })
      }

      head.appendChild(icon)
      var titles = el('div', 'jg-card-titles')
      titles.appendChild(el('span', 'jg-card-name', this.device.name))
      this._subtitle = el('span', 'jg-card-sub', '')
      titles.appendChild(this._subtitle)
      head.appendChild(titles)
      this.showSubtitle(subtitle)

      var flags = this.flags()
      if (flags !== null) {
        head.appendChild(flags)
      }
      this.appendChild(head)
      return head
    }

    /* Ce qui réclame une intervention, dit sur la carte elle-même : sans cela
     * il faut parcourir quatre cents tuiles à l'oeil pour découvrir qu'une pile
     * est morte ou qu'un équipement ne répond plus. La vue Santé les rassemble,
     * mais l'information doit aussi être là où l'on regarde. */
    flags() {
      var status = this.device.status || {}
      var box = null
      function add(node) {
        if (box === null) {
          box = el('div', 'jg-flags')
        }
        box.appendChild(node)
      }
      if (status.timeout) {
        var mute = el('span', 'jg-flag jg-flag-mute')
        mute.title = '{{Cet équipement ne répond plus}}'
        mute.appendChild(el('i', 'fas fa-unlink'))
        add(mute)
      }
      var level = batteryLevel(this.device)
      if (level !== null && level <= BATTERY_LOW) {
        var battery = el('span', 'jg-battery')
        battery.title = '{{Pile faible}}'
        battery.appendChild(el('i', 'fas fa-battery-quarter'))
        battery.appendChild(el('span', null, level + ' %'))
        add(battery)
      }
      return box
    }

    /* Les mesures secondaires d'une carte pilotable : la puissance d'une prise,
     * la température d'un thermostat. Ce sont elles qui font qu'on n'a pas
     * besoin d'ouvrir l'équipement pour savoir ce qu'il fait. */
    metrics(limit) {
      var used = Object.keys(this.device.roles || {}).map(function (key) { return this.device.roles[key] }, this)
      var extras = this.device.cmds.filter(function (cmd) {
        if (cmd.type !== 'info' || !cmd.visible || used.indexOf(cmd.id) !== -1) {
          return false
        }
        if (NOISY.indexOf(cmd.generic) !== -1) {
          return false
        }
        /* Une mesure sans valeur n'apprend rien : « Perte vidéo — » occupait la
         * ligne d'une vraie mesure. Elle reste dans le panneau, qui montre tout,
         * y compris ce qui n'a jamais rien dit. */
        var value = JG.VALUES[cmd.id]
        return value !== null && value !== undefined && value !== ''
      }).sort(function (a, b) {
        return metricRank(b) - metricRank(a)
      })

      /* Sur une carte qui pilote, une mesure est un nombre. « Événement entrée
       * 1 : Salon » occupait la ligne d'une prise devant sa puissance : c'est
       * le nom d'une borne physique et la valeur d'un état interne, cela ne
       * dit rien à qui regarde le mur. On garde donc ce qui se mesure — et à
       * défaut, ce qu'il y a, plutôt que de laisser la carte muette. */
      var measured = extras.filter(function (cmd) { return metricRank(cmd) >= 2 })
      extras = (measured.length > 0 ? measured : extras).slice(0, limit || 3)
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

    /* Les lignes d'information, pour le capteur comme pour la carte générique.
     * Une valeur qui cache une structure devient dépliable : la ligne montre le
     * champ le plus lisible, l'appui montre le reste. */
    infoRows(cmds) {
      var list = el('div', 'jg-rows')
      this.fillRows(list, cmds)
      return list
    }

    fillRows(list, cmds) {
      cmds.forEach(function (cmd) {
        if (cmd.widget) {
          list.appendChild(this.widgetHolder(cmd))
          return
        }
        if (imageUrl(cmd.id) !== null) {
          list.appendChild(this.imageRow(cmd))
          return
        }
        var row = el('div', 'jg-row')
        row.appendChild(el('span', 'jg-row-name', cmd.name))
        var value = el('span', 'jg-row-value', format(cmd.id))
        row.appendChild(value)
        /* Nom et valeur se disputent la largeur d'une carte : au-delà d'une
         * trentaine de caractères, les deux finissent en points de suspension
         * et la ligne ne dit plus rien. La valeur passe alors dessous, où elle
         * a toute la place. */
        if (value.textContent.length > 30) {
          row.classList.add('jg-row-stacked')
        }
        list.appendChild(row)
        var entry = { id: cmd.id, node: value, host: list }
        this.makeExpandable(entry)
        this._rows.push(entry)
        watch(cmd.id, this)
      }, this)
    }

    /* L'essentiel sur la carte, le reste dans le panneau. Une carte qui
     * déroulait ses douze lignes redevenait une ligne de tableau Jeedom. */
    appendRows(cmds) {
      if (cmds.length === 0) {
        return
      }
      /* Une image et un widget ne comptent pas dans le quota de lignes : ils
       * sont ce qu'il y a de plus parlant sur une carte, et les reléguer au
       * panneau derrière trois nombres serait exactement l'inverse de ce qu'on
       * cherche. */
      var rich = cmds.filter(function (cmd) { return cmd.widget || imageUrl(cmd.id) !== null })
      var plain = cmds.filter(function (cmd) { return !(cmd.widget || imageUrl(cmd.id) !== null) })
      this.appendChild(this.infoRows(rich.concat(plain.slice(0, ROW_LIMIT))))
      if (plain.length > ROW_LIMIT) {
        this.appendChild(this.detailButton(plain.length - ROW_LIMIT))
      }
    }

    detailButton(count) {
      var button = el('button', 'jg-more', '+ ' + count + ' · {{détail}}')
      button.addEventListener('click', function (event) {
        event.stopPropagation()
        event.preventDefault()
        JG.openPanel(this.device.id)
      }.bind(this))
      return button
    }

    /* Le rendu que le plugin a écrit pour cette commande, quand il en a écrit
     * un. On ne le coud pas dans la page — dix-neuf widgets pèsent 331 ko — on
     * réserve sa place et on le demande ensuite, tous ensemble.
     *
     * En attendant, et si l'appel échoue, la ligne ordinaire tient le terrain :
     * une valeur affichée sobrement vaut mieux qu'un rectangle vide. */
    widgetHolder(cmd) {
      var holder = el('div', 'jg-widget')
      holder.dataset.cmdId = cmd.id
      holder.dataset.pending = '1'
      var plain = {}
      Object.keys(cmd).forEach(function (key) { plain[key] = cmd[key] })
      plain.widget = false
      this.fillRows(holder, [plain])
      /* La ligne de repli vient d'être poussée : on lui attache son porteur
       * pour que la mise à jour cesse dès que le widget a pris la main. */
      if (this._rows.length > 0) {
        this._rows[this._rows.length - 1].holder = holder
      }
      return holder
    }

    /* Une image, et non son adresse. Si le chargement échoue — l'adresse ne
     * désignait pas une image, ou le fichier a disparu — la ligne de texte
     * reprend sa place : mieux vaut une adresse affichée qu'un trou. */
    imageRow(cmd) {
      var figure = el('div', 'jg-media')
      var image = document.createElement('img')
      image.alt = cmd.name
      image.loading = 'lazy'
      var entry = { id: cmd.id, image: image, figure: figure }
      image.addEventListener('error', function () {
        JG.BROKEN[image.getAttribute('src')] = true
        var fallback = el('div', 'jg-rows')
        this.fillRows(fallback, [cmd])
        entry.image = null
        figure.replaceWith(fallback)
      }.bind(this))
      image.src = imageUrl(cmd.id)
      figure.appendChild(image)
      this._rows.push(entry)
      watch(cmd.id, this)
      return figure
    }

    /* Rend une valeur dépliable si, et seulement si, elle cache une structure.
     * Le détail est reconstruit à chaque ouverture : la valeur a pu changer
     * entre-temps, et un détail périmé serait pire que pas de détail. */
    makeExpandable(entry) {
      if (jsonOf(entry.id) === null) {
        return
      }
      var node = entry.node
      node.classList.add('jg-expand')
      node.setAttribute('role', 'button')
      node.setAttribute('tabindex', '0')
      node.title = '{{Afficher le détail}}'
      var toggle = function (event) {
        /* La carte entière peut être une bascule : sans cela, déplier
         * allumerait la lampe. */
        event.stopPropagation()
        event.preventDefault()
        if (entry.details) {
          entry.details.remove()
          entry.details = null
          return
        }
        var parsed = jsonOf(entry.id)
        if (parsed === null) {
          return
        }
        entry.details = jsonDetails(parsed)
        entry.host.insertBefore(entry.details, node.parentNode.nextSibling)
      }
      node.addEventListener('click', toggle)
      node.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          toggle(event)
        }
      })
    }

    /* Écrire une valeur, et la faire voir changer.
     *
     * Un dashboard temps réel qui remplace un texte sans un pixel de signal
     * oblige à relire l'écran entier pour savoir ce qui vient de bouger. Le
     * clignotement ne part donc que sur un changement réel, et jamais sur la
     * première écriture : au chargement, comme à chaque relecture du modèle,
     * tout serait sinon marqué neuf en même temps. */
    write(node, text) {
      if (!node || node.textContent === text) {
        return false
      }
      var seen = node.dataset.jgSeen === '1'
      node.textContent = text
      node.dataset.jgSeen = '1'
      if (seen) {
        flash(node)
      }
      return seen
    }

    syncRows() {
      ;(this._rows || []).forEach(function (entry) {
        /* Le widget d'un plugin se tient à jour tout seul : il s'est inscrit
         * auprès de jeedom.cmd au moment de son insertion. */
        if (entry.holder && entry.holder.classList.contains('jg-widget-ready')) {
          return
        }
        if (entry.image) {
          /* L'adresse d'un instantané porte l'heure de la prise : la relire,
           * c'est rafraîchir l'image. */
          var fresh = imageUrl(entry.id)
          if (fresh !== null && entry.image.getAttribute('src') !== fresh) {
            entry.image.src = fresh
          }
          return
        }
        if (!entry.node) {
          return
        }
        this.write(entry.node, format(entry.id))
        if (entry.node.parentNode && entry.node.parentNode.classList.contains('jg-row')) {
          entry.node.parentNode.classList.toggle('jg-row-stacked', entry.node.textContent.length > 30)
        }
        if (entry.details) {
          var parsed = jsonOf(entry.id)
          var fresh = (parsed === null) ? null : jsonDetails(parsed)
          if (fresh === null) {
            entry.details.remove()
            entry.details = null
          } else {
            entry.details.replaceWith(fresh)
            entry.details = fresh
          }
        }
      }, this)
    }

    syncMetrics() {
      (this._metrics || []).forEach(function (metric) {
        this.write(metric.node, format(metric.id))
      }, this)
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
    /* Rien à basculer : un variateur qui n'expose qu'un curseur, une prise qui
     * ne rapporte que sa consommation. Et sans commande d'état, on ne sait pas
     * sur quel pied danser : la carte donne alors deux boutons explicites
     * plutôt qu'une bascule qui se trompe une fois sur deux. Ni l'un ni l'autre
     * ne répond à un appui sur la carte — la déclarer bouton la ferait répondre
     * au clavier et se soulever au survol pour ne rien faire. */
    actionable() {
      var canToggle = (this.role('toggle') !== undefined || this.role('on') !== undefined || this.role('off') !== undefined)
      return canToggle && this.role('state') !== undefined
    }

    build() {
      this.header()
      var body = el('div', 'jg-card-body')
      this._state = el('span', 'jg-state', '')
      body.appendChild(this._state)
      this.appendChild(body)

      /* Les réglages occupent chacun leur rangée pleine largeur, dans un bloc
       * à part. Un curseur qui partage sa ligne avec deux boutons devient
       * intouchable au doigt, et un petit bouton logé dans un coin de tuile
       * mange la cible principale sans rien apporter. */
      var features = el('div', 'jg-features')
      var slider = this.slider('slider', function (value, input) {
        exec(this.role('slider'), value, input)
      }.bind(this))
      if (slider) {
        features.appendChild(slider)
      }

      var canToggle = (this.role('toggle') !== undefined || this.role('on') !== undefined || this.role('off') !== undefined)

      if (!canToggle) {
        if (features.children.length > 0) {
          this.appendChild(features)
        }
        this.metrics(2)
        this.watchState()
        return
      }
      if (!this._actionable) {
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
        features.appendChild(pair)
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

      if (features.children.length > 0) {
        this.appendChild(features)
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
      this.markState(on)
      this.syncAlert()
      var stateId = this.role('state')
      /* Sans commande d'état, la carte ne se taisait pas : elle se dessinait
       * exactement comme une carte éteinte, et une applique commandée sans
       * retour se lisait « éteinte » alors qu'elle éclairait la pièce. Le
       * dashboard dit donc ce qu'il en est — rien. */
      var text = (stateId === undefined) ? '{{État inconnu}}' : format(stateId)
      var brightnessId = this.role('brightness')
      if (brightnessId !== undefined && on) {
        text = format(brightnessId)
      }
      this.write(this._state, text)
      if (this.role('slider') !== undefined) {
        this.syncSlider(JG.VALUES[this.role('slider')])
      } else if (stateId !== undefined && JG.CMDS[stateId] && JG.CMDS[stateId].subType === 'numeric') {
        this.syncSlider(JG.VALUES[stateId])
      }
      this.syncMetrics()
    }
  }

  class JgCover extends JgCard {
    /* Un volet ne se bascule pas d'un appui — monter et descendre sont deux
     * gestes — mais il se pilote : sa pastille ouvre donc le détail, comme sur
     * une lampe, et ses trois flèches gardent toute la largeur. */
    actionable() {
      return this.role('up') !== undefined || this.role('down') !== undefined || this.role('slider') !== undefined
    }

    build() {
      this.header()
      var body = el('div', 'jg-card-body')
      this._state = el('span', 'jg-state', '')
      body.appendChild(this._state)
      this.appendChild(body)

      var features = el('div', 'jg-features')
      var slider = this.slider('slider', function (value, input) {
        exec(this.role('slider'), value, input)
      }.bind(this))
      if (slider) {
        features.appendChild(slider)
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
      if (bar.children.length > 0) {
        features.appendChild(bar)
      }
      if (features.children.length > 0) {
        this.appendChild(features)
      }

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
          this.write(this._state, isNaN(percent) ? '—' : Math.round(percent) + ' %')
          this.markState(percent > 0)
          this.syncSlider(percent)
        } else {
          this.write(this._state, format(stateId))
          this.markState(isTrue(cmd, JG.VALUES[stateId]))
        }
      } else {
        /* Un volet qui monte et descend sans rapporter sa position : même
         * cas que l'applique sans retour, même réponse. */
        this.write(this._state, '{{État inconnu}}')
      }
      this.syncAlert()
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
      /* Une mesure passe avant une structure : montrer 21,4 °C en grand et
       * reléguer la collecte en dessous est plus juste que l'inverse. */
      /* Une commande qui a son propre widget ne se résume pas : elle se montre.
       * Elle ne peut donc pas tenir la valeur principale, qui est une ligne de
       * texte. */
      var candidates = infos.filter(function (cmd) { return !cmd.widget })
      var plain = candidates.filter(function (cmd) { return jsonOf(cmd.id) === null })
      this._primary = plain[0] || candidates[0] || null
      this.header()

      if (this._primary !== null) {
        var body = el('div', 'jg-card-body')
        this._value = el('span', 'jg-value', format(this._primary.id))
        /* La taille d'affichage est celle d'une mesure, et d'une mesure
         * seulement. « Rien à signaler », « Fermé » ou « 20/09 16:05 » en
         * vingt-six pixels gras ne hiérarchisent plus rien : la carte crie ce
         * qu'elle a, au lieu de dire ce qu'elle mesure. Ce qui n'est pas un
         * nombre reprend donc le corps du texte. */
        if (!isMeasure(this._primary)) {
          this._value.classList.add('jg-value-text')
        }
        body.appendChild(this._value)
        this.appendChild(body)
      }

      this._rows = []
      if (this._primary) {
        this.showSubtitle(this._primary.name)
        watch(this._primary.id, this)
        /* La valeur principale est une ligne comme une autre pour la mise à
         * jour : l'oublier ici la figerait à sa valeur de chargement. */
        var entry = { id: this._primary.id, node: this._value, host: this }
        if (jsonOf(this._primary.id) !== null) {
          this.makeExpandable(entry)
        }
        this._rows.push(entry)
      }

      var rest = infos.filter(function (cmd) {
        return this._primary === null || cmd.id !== this._primary.id
      }, this)
      this.appendRows(rest)
    }

    sync() {
      if (this._primary) {
        var cmd = JG.CMDS[this._primary.id]
        if (cmd && cmd.subType === 'binary') {
          this.markActive(isTrue(cmd, JG.VALUES[this._primary.id]))
        }
      }
      this.syncAlert()
      this.syncRows()
    }
  }

  /* La carte de repli. Elle ne prétend rien comprendre : elle liste les infos
   * visibles et propose les actions visibles. C'est elle qui évite le trou noir
   * du dashboard qui ne sait pas afficher la moitié d'une installation. */
  class JgGeneric extends JgCard {
    build() {
      this.header()
      this._rows = []
      this.appendRows(this.device.cmds.filter(function (cmd) { return cmd.type === 'info' && cmd.visible }))

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
      })
      if (actions.length > 0) {
        var bar = el('div', 'jg-actions jg-actions-wrap')
        actions.slice(0, ACTION_LIMIT).forEach(function (cmd) {
          bar.appendChild(this.actionNode(cmd))
        }, this)
        this.appendChild(bar)
        if (actions.length > ACTION_LIMIT) {
          this.appendChild(this.detailButton(actions.length - ACTION_LIMIT))
        }
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
      this.syncAlert()
      this.syncRows()
    }
  }

  /* Le contenu du panneau. Même machinerie que les cartes — lignes, images,
   * widgets, actions — mais sans plafond : c'est ici qu'on vient tout voir. */
  class JgDetail extends JgCard {
    build() {
      this.classList.add('jg-detail')
      var infos = this.device.cmds.filter(function (cmd) { return cmd.type === 'info' })
      var actions = this.device.cmds.filter(function (cmd) {
        return cmd.type === 'action' && cmd.subType !== 'message'
      })
      this._rows = []
      if (infos.length > 0) {
        this.appendChild(this.infoRows(infos))
      }
      if (actions.length > 0) {
        var bar = el('div', 'jg-actions jg-actions-wrap')
        actions.forEach(function (cmd) { bar.appendChild(this.actionNode(cmd)) }, this)
        this.appendChild(bar)
      }
      this.charts(infos)
      this.roomPicker()

      var foot = el('div', 'jg-detail-foot')
      foot.appendChild(el('span', null, this.device.realName ? this.device.realName : this.device.eqType))
      this.appendChild(foot)
    }

    /* Le rangement, là où l'on regarde déjà l'équipement. La moitié d'une
     * installation ordinaire n'appartient à aucune pièce, et personne n'ira
     * ouvrir la page d'un plugin pour corriger ça : la seule occasion de ranger
     * est celle où l'on a l'équipement sous les yeux. */
    roomPicker() {
      if (!JG.MODEL.admin || !Array.isArray(JG.MODEL.objects) || JG.MODEL.objects.length === 0) {
        return
      }
      var row = el('div', 'jg-row jg-room-row')
      row.appendChild(el('span', 'jg-row-name', '{{Pièce}}'))
      var select = document.createElement('select')
      select.className = 'jg-select'
      var none = el('option', null, '{{Non classé}}')
      none.value = '0'
      select.appendChild(none)
      JG.MODEL.objects.forEach(function (object) {
        var option = el('option', null, object.name)
        option.value = String(object.id)
        select.appendChild(option)
      })
      select.value = String(this.device.roomId || 0)
      select.addEventListener('change', function () {
        JG.setRoom(this.device, select.value, select)
      }.bind(this))
      row.appendChild(select)
      this.appendChild(row)
    }

    /* Une courbe pour les commandes historisées. Highstock est déjà chargé par
     * la page et le coeur sait tracer : on lui donne un conteneur et un
     * identifiant, rien de plus. Deux courbes au maximum — au-delà, le panneau
     * devient une page d'analyse, qui existe déjà dans Jeedom. */
    charts(infos) {
      if (typeof jeedom === 'undefined' || !jeedom.history || !jeedom.history.drawChart) {
        return
      }
      infos.filter(function (cmd) {
        return cmd.history && cmd.subType === 'numeric'
      }).slice(0, 2).forEach(function (cmd) {
        var box = el('div', 'jg-chart')
        /* Un identifiant neuf à chaque ouverture. Le coeur range ses courbes
         * sous cet identifiant (jeedom.history.chart) : repris tel quel, il
         * désignait la courbe de l'ouverture précédente, dessinée dans un
         * cadre qui n'était plus dans la page. Et la réponse tardive d'une
         * ouverture refermée aussitôt ne doit pas tomber dans le cadre de la
         * suivante. */
        JG.CHART_SEQ = (JG.CHART_SEQ || 0) + 1
        box.id = 'jg-chart-' + cmd.id + '-' + JG.CHART_SEQ
        var title = el('div', 'jg-chart-title', cmd.name)
        this.appendChild(title)
        this.appendChild(box)
        JG.CHARTS.push(box)
        /* Après insertion dans le document : Highcharts dessine dans un
         * élément, pas dans une intention. */
        setTimeout(function () {
          /* Refermé avant même d'avoir demandé : rien à dessiner. */
          if (JG.CHARTS.indexOf(box) === -1) {
            box.remove()
            return
          }
          box._asked = true
          try {
            jeedom.history.drawChart({
              cmd_id: cmd.id,
              el: box.id,
              newGraph: true,
              dateRange: '1 day',
              height: 170,
              noError: true,
              option: { displayAlert: false },
              /* Le panneau a pu se refermer pendant la requête : la courbe
               * vient d'être dessinée dans le cadre mis de côté, on la défait
               * aussitôt. */
              success: function () {
                if (JG.CHARTS.indexOf(box) === -1) {
                  dropChart(box)
                }
              }
            })
          } catch (error) {
            var index = JG.CHARTS.indexOf(box)
            if (index !== -1) {
              JG.CHARTS.splice(index, 1)
            }
            dropChart(box)
            title.remove()
          }
        }, 0)
      }, this)
    }

    sync() {
      this.syncAlert()
      this.syncRows()
    }
  }

  /* actionNode vit sur la carte générique : le panneau en a besoin aussi. */
  JgDetail.prototype.actionNode = JgGeneric.prototype.actionNode

  /* Une caméra dit deux choses, et deux seulement : est-ce que quelque chose
   * bouge, et que s'est-il passé en dernier. Tout le reste — perte vidéo,
   * véhicule détecté, dix lignes binaires — appartient au panneau. */
  class JgCamera extends JgCard {
    build() {
      this._rows = []
      this.header()

      var infos = this.device.cmds.filter(function (cmd) { return cmd.type === 'info' })

      /* Un instantané ou le rendu du plugin valent mieux que n'importe quelle
       * phrase : quand il y en a un, il passe avant tout. */
      var rich = infos.filter(function (cmd) { return cmd.widget || imageUrl(cmd.id) !== null })
      if (rich.length > 0) {
        this.appendChild(this.infoRows(rich.slice(0, 1)))
      }

      var body = el('div', 'jg-card-body jg-cam-body')
      this._motion = el('span', 'jg-live')
      this._motion.appendChild(el('i', 'fas fa-running'))
      this._motion.appendChild(el('span', null, '{{Mouvement}}'))
      this._motion.hidden = true
      body.appendChild(this._motion)

      /* Ni un widget, ni une structure : le widget est déjà montré au-dessus, et
       * le répéter en texte donnait deux fois la même phrase sur la même carte. */
      this._event = infos.filter(function (cmd) {
        return cmd.subType === 'string' && cmd.visible && !cmd.widget &&
          jsonOf(cmd.id) === null && imageUrl(cmd.id) === null
      })[0] || null
      this._line = el('span', 'jg-cam-event', '')
      body.appendChild(this._line)
      this.appendChild(body)
      if (this._event !== null) {
        watch(this._event.id, this)
      }

      this._eyes = infos.filter(function (cmd) { return cmd.generic === 'PRESENCE' })
      this._eyes.forEach(function (cmd) { watch(cmd.id, this) }, this)

      var take = this.device.cmds.filter(function (cmd) {
        return cmd.type === 'action' && cmd.generic === 'CAMERA_TAKE'
      })[0]
      if (take !== undefined) {
        var features = el('div', 'jg-features')
        var bar = el('div', 'jg-actions')
        var button = el('button', 'jg-btn')
        button.appendChild(el('i', 'fas fa-camera'))
        button.appendChild(el('span', null, ' ' + '{{Capturer}}'))
        button.addEventListener('click', function (event) {
          event.stopPropagation()
          exec(take.id, null, button)
        })
        bar.appendChild(button)
        features.appendChild(bar)
        this.appendChild(features)
      }
    }

    sync() {
      var moving = this._eyes.some(function (cmd) {
        return isTrue(cmd, JG.VALUES[cmd.id])
      })
      this._motion.hidden = !moving
      /* Un mouvement devant une caméra est un fait, pas une mise en marche : la
       * caméra filmait déjà. Elle prend donc la marque des capteurs. */
      this.markActive(moving)
      this.write(this._line, (this._event === null) ? '' : format(this._event.id))
      this.syncAlert()
      this.syncRows()
    }
  }

  /* Le chauffage se règle là où on le lit : mesure et consigne sur la même
   * carte, deux boutons assez gros pour le pouce. Ouvrir un panneau pour
   * gagner un demi-degré est le geste qu'on ne fait jamais. */
  class JgClimate extends JgCard {
    actionable() {
      return firstGeneric(this.device, ['THERMOSTAT_SET_SETPOINT']) !== null
    }

    build() {
      this._rows = []
      this._temp = firstGeneric(this.device, ['THERMOSTAT_TEMPERATURE'])
      this._setpoint = firstGeneric(this.device, ['THERMOSTAT_SETPOINT'])
      this._setter = firstGeneric(this.device, ['THERMOSTAT_SET_SETPOINT'])
      this._mode = firstGeneric(this.device, ['THERMOSTAT_MODE', 'THERMOSTAT_STATE_NAME', 'THERMOSTAT_STATE'])

      this.header(this._mode === null ? '' : format(this._mode.id))

      var body = el('div', 'jg-card-body')
      this._value = el('span', 'jg-value', (this._temp === null) ? '—' : format(this._temp.id))
      body.appendChild(this._value)
      this._target = el('span', 'jg-target', '')
      body.appendChild(this._target)
      this.appendChild(body)

      if (this._setter !== null) {
        var features = el('div', 'jg-features')
        var bar = el('div', 'jg-actions jg-thermo')
        bar.appendChild(this.step('-', '{{Baisser}}', -0.5))
        bar.appendChild(this.step('+', '{{Monter}}', 0.5))
        features.appendChild(bar)
        this.appendChild(features)
      }

      ;[this._temp, this._setpoint, this._mode].forEach(function (cmd) {
        if (cmd !== null) {
          watch(cmd.id, this)
        }
      }, this)
      this.metrics(2)
    }

    /* Un pas de consigne, pas une valeur absolue : la commande du coeur attend
     * une température, et la seule que nous connaissons est celle que
     * l'équipement rapporte. Sans consigne connue, les boutons n'auraient rien
     * à quoi ajouter un demi-degré — ils ne sont donc pas dessinés. */
    step(sign, label, delta) {
      var button = el('button', 'jg-btn jg-btn-step', sign)
      button.title = label
      button.setAttribute('aria-label', label)
      button.addEventListener('click', function (event) {
        event.stopPropagation()
        var current = (this._setpoint === null) ? NaN : parseFloat(JG.VALUES[this._setpoint.id])
        if (isNaN(current)) {
          return
        }
        exec(this._setter.id, Math.round((current + delta) * 10) / 10, button)
      }.bind(this))
      return button
    }

    sync() {
      this.write(this._value, (this._temp === null) ? '—' : format(this._temp.id))
      this.write(this._target, (this._setpoint === null) ? '' : '{{consigne}} ' + format(this._setpoint.id))
      if (this._mode !== null) {
        this.showSubtitle(format(this._mode.id))
      }
      var state = firstGeneric(this.device, ['THERMOSTAT_STATE'])
      if (state !== null) {
        this.markState(isTrue(state, JG.VALUES[state.id]))
      }
      this.syncAlert()
      this.syncMetrics()
    }
  }

  /* Ce qui joue, et de quoi l'arrêter. Les génériques MEDIA_* existent dans le
   * coeur depuis toujours et aucune carte ne les lisait. */
  class JgMedia extends JgCard {
    build() {
      this._rows = []
      this._title = firstGeneric(this.device, ['MEDIA_TITLE'])
      this._artist = firstGeneric(this.device, ['MEDIA_ARTIST', 'MEDIA_ALBUM'])
      this._status = firstGeneric(this.device, ['MEDIA_STATE', 'MEDIA_STATUS'])

      this.header(this._status === null ? '' : format(this._status.id))

      var body = el('div', 'jg-card-body')
      this._line = el('span', 'jg-value jg-value-text', '')
      body.appendChild(this._line)
      this.appendChild(body)

      var buttons = [
        { generic: 'MEDIA_PREVIOUS', icon: 'fas fa-step-backward', label: '{{Précédent}}' },
        { generic: 'MEDIA_PAUSE', icon: 'fas fa-pause', label: '{{Pause}}' },
        { generic: 'MEDIA_RESUME', icon: 'fas fa-play', label: '{{Lecture}}' },
        { generic: 'MEDIA_NEXT', icon: 'fas fa-step-forward', label: '{{Suivant}}' }
      ]
      var bar = el('div', 'jg-actions')
      buttons.forEach(function (entry) {
        var cmd = firstGeneric(this.device, [entry.generic])
        if (cmd === null) {
          return
        }
        var node = el('button', 'jg-btn jg-btn-icon')
        node.title = entry.label
        node.setAttribute('aria-label', entry.label)
        node.appendChild(el('i', entry.icon))
        node.addEventListener('click', function (event) {
          event.stopPropagation()
          exec(cmd.id, null, node)
        })
        bar.appendChild(node)
      }, this)
      if (bar.children.length > 0) {
        var features = el('div', 'jg-features')
        features.appendChild(bar)
        this.appendChild(features)
      }

      ;[this._title, this._artist, this._status].forEach(function (cmd) {
        if (cmd !== null) {
          watch(cmd.id, this)
        }
      }, this)
    }

    sync() {
      var parts = [this._title, this._artist].filter(function (cmd) { return cmd !== null })
        .map(function (cmd) { return format(cmd.id) })
        .filter(function (text) { return text && text !== '—' })
      this.write(this._line, parts.join(' · '))
      if (this._status !== null) {
        this.showSubtitle(format(this._status.id))
        this.markState(!/stop|pause|off|arr/i.test(String(JG.VALUES[this._status.id])))
      }
    }
  }

  /* La bande compacte de l'accueil.
   *
   * Une carte complète y disait « Allumée », deux mesures et un curseur : sur
   * huit équipements côte à côte cela fait un mur de texte, là où l'on ne pose
   * qu'une question — qu'est-ce qui tourne, et comment l'arrêter. La bande ne
   * garde que le nom, une ligne de résumé, et la bascule sur toute sa surface.
   * Le réglage fin reste à un appui, dans le panneau. */
  class JgQuick extends JgCard {
    actionable() {
      return this.role('state') !== undefined &&
        (this.role('toggle') !== undefined || this.role('on') !== undefined || this.role('off') !== undefined)
    }

    build() {
      this.classList.add('jg-quick')
      var head = el('div', 'jg-card-head')
      var icon = el('span', 'jg-card-icon')
      icon.appendChild(el('i', deviceIcon(this.device)))
      head.appendChild(icon)
      var titles = el('div', 'jg-card-titles')
      titles.appendChild(el('span', 'jg-card-name', this.device.name))
      this._subtitle = el('span', 'jg-card-sub', '')
      titles.appendChild(this._subtitle)
      head.appendChild(titles)
      this.appendChild(head)

      /* La mesure qui accompagne l'état : la puissance d'une prise, la position
       * d'un volet. Une seule — la bande n'est pas une fiche. */
      this._extra = this.device.cmds.filter(function (cmd) {
        return cmd.type === 'info' && cmd.visible && metricRank(cmd) >= 3 &&
          NOISY.indexOf(cmd.generic) === -1
      })[0] || null

      if (this._actionable) {
        this.classList.add('jg-tappable')
        this.setAttribute('role', 'button')
        this.setAttribute('tabindex', '0')
        this.addEventListener('click', function () { this.toggle() }.bind(this))
        this.addEventListener('keydown', function (event) {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return
          }
          event.preventDefault()
          this.toggle()
        }.bind(this))
      } else {
        this.classList.add('jg-head-open')
        this.setAttribute('role', 'button')
        this.setAttribute('tabindex', '0')
        this.addEventListener('click', function () { JG.openPanel(this.device.id) }.bind(this))
      }

      ;['state', 'brightness', 'slider'].forEach(function (role) {
        if (this.role(role) !== undefined) {
          watch(this.role(role), this)
        }
      }, this)
      if (this._extra !== null) {
        watch(this._extra.id, this)
      }
    }

    toggle() {
      if (this.role('toggle') !== undefined) {
        exec(this.role('toggle'), null, this)
        return
      }
      exec(this.on() ? this.role('off') : this.role('on'), null, this)
    }

    /* Pièce · état · mesure, sur une ligne. C'est la phrase qu'on lit, et non
     * trois étiquettes empilées. */
    sync() {
      var on = this.on()
      this.markState(on)
      this.syncAlert()
      var parts = []
      var brightness = this.role('brightness')
      var stateId = this.role('state')
      if (brightness !== undefined && on) {
        parts.push(format(brightness))
      } else if (stateId !== undefined) {
        parts.push(format(stateId))
      }
      if (this._extra !== null) {
        parts.push(format(this._extra.id))
      }
      this.showSubtitle(parts.join(' · '))
    }
  }

  customElements.define('jg-card-quick', JgQuick)
  customElements.define('jg-card-detail', JgDetail)
  customElements.define('jg-card-light', class extends JgToggle {})
  customElements.define('jg-card-switch', class extends JgToggle {})
  customElements.define('jg-card-cover', JgCover)
  customElements.define('jg-card-sensor', JgSensor)
  customElements.define('jg-card-camera', JgCamera)
  customElements.define('jg-card-climate', JgClimate)
  customElements.define('jg-card-media', JgMedia)
  customElements.define('jg-card-generic', JgGeneric)

  }

  /* Une tuile d'accueil qui suit le temps réel.
   *
   * Les tuiles de l'accueil ne sont pas des cartes : ni élément personnalisé,
   * ni sync(), ni désabonnement. Elles restaient donc à la valeur qu'elles
   * avaient au dessin. La température du dehors, la consommation du compteur,
   * le résumé d'une pièce ne bougeaient qu'au redessin complet de l'accueil —
   * c'est-à-dire quand un équipement basculait, ou au quart d'heure. Sur une
   * tablette murale, autant dire jamais : l'écran affichait la maison de tout
   * à l'heure.
   *
   * Un abonné minimal suffit, et c'est exactement ce qu'est une carte vue du
   * registre : un objet qui porte un sync(). Le noeud lui-même fait l'affaire.
   *
   * La classe jg-follows n'est pas décorative : forgetAll() balaye les abonnés
   * par leur classe avant de remplacer une vue, et il n'avait aucune raison
   * d'aller chercher un bouton d'accueil. Sans elle, chaque redessin
   * laisserait derrière lui une tuile abonnée à vie — et le registre
   * grossirait d'autant à chaque aller-retour dans le menu.
   *
   * Elle ne s'appelle surtout pas « jg-live » : ce nom est déjà pris par la
   * pastille rouge d'une caméra qui détecte du mouvement, et le poser sur une
   * tuile lui collait sa casse, sa couleur et sa forme de pilule. Une classe
   * qui ne sert qu'à retrouver un noeud reste invisible à la feuille de
   * style.
   *
   * Le rendu est rejoué une fois à la construction : la tuile n'a ainsi qu'une
   * seule façon de se remplir, et non deux qui finiraient par diverger. */
  function live(node, ids, render) {
    node.classList.add('jg-follows')
    node.sync = render
    ids.forEach(function (id) {
      if (id !== undefined && id !== null) {
        watch(id, node)
      }
    })
    render()
    return node
  }

  /* Ce qu'une tuile doit surveiller : l'état de ce qu'elle compte, et la mesure
   * qu'elle affiche. Les deux, parce qu'une tuile dit les deux — « 2 en marche
   * · 21,4 °C » se périme par l'un comme par l'autre. */
  function tileIds(devices, generics) {
    var ids = []
    devices.forEach(function (device) {
      if (device.roles && device.roles.state !== undefined) {
        ids.push(device.roles.state)
      }
      if (generics !== undefined) {
        var cmd = firstGeneric(device, generics)
        if (cmd !== null) {
          ids.push(cmd.id)
        }
      }
    })
    return ids
  }

  function watch(cmdId, card) {
    if (!JG.WATCH[cmdId]) {
      JG.WATCH[cmdId] = []
    }
    if (JG.WATCH[cmdId].indexOf(card) === -1) {
      JG.WATCH[cmdId].push(card)
      /* La carte retient ce qu'elle suit. Sans cette liste, la désinscription
       * doit balayer les quatre cents entrées de JG.WATCH pour retrouver une
       * carte, et le ménage d'une vue entière devient quadratique — ce qui se
       * sent précisément là où ça fait mal, sur la tablette murale. */
      ;(card._watched = card._watched || []).push(cmdId)
    }
  }

  /* Le modèle classe un équipement par les rôles qu'il sait piloter. Une
   * caméra, un thermostat, un lecteur n'en ont aucun à ce compte-là et
   * repartaient tous en carte générique. On affine ici, sur les types
   * génériques du coeur, et seulement quand le modèle n'a rien trouvé : une
   * lampe sur prise commandée reste d'abord une lampe. */
  function cardType(device) {
    if (device.card !== 'generic' && device.card !== 'sensor') {
      return device.card
    }
    if (device.domain === 'camera' || firstGeneric(device, ['CAMERA_TAKE', 'CAMERA_URL']) !== null) {
      return 'camera'
    }
    if (firstGeneric(device, CLIMATE_MARKS) !== null) {
      return 'climate'
    }
    if (firstGeneric(device, MEDIA_MARKS) !== null) {
      return 'media'
    }
    return device.card
  }

  /* La bande compacte, pour l'accueil. Même machinerie que les cartes — index,
   * abonnement, désabonnement — mais un rendu qui tient en deux lignes. */
  function makeQuick(device) {
    var card = document.createElement('jg-card-quick')
    card.device = device
    card.dataset.deviceId = device.id
    return card
  }

  function makeCard(device) {
    var tag = 'jg-card-' + cardType(device)
    if (customElements.get(tag) === undefined) {
      tag = 'jg-card-generic'
    }
    var card = document.createElement(tag)
    card.device = device
    card.dataset.deviceId = device.id
    /* Un widget de plugin — une grille de vignettes, un bulletin météo — ne
     * tient pas dans une colonne : il prend la largeur de deux. */
    if (device.cmds.some(function (cmd) { return cmd.widget })) {
      card.dataset.span = '2'
    }
    /* Le marqueur d'édition est posé AVANT l'insertion, donc avant
     * connectedCallback : la carte ajoute ses propres enfants à la suite sans
     * jamais vider ce qu'elle trouve, et le marqueur est de toute façon en
     * position absolue. Aucune carte n'a ainsi à connaître le mode édition. */
    if (editingHere()) {
      if (device.drawn === false) {
        card.dataset.drawn = '0'
      }
      card.appendChild(editMark(device))
    }
    return card
  }

  /* -------------------------------------------------------- le mode édition
   *
   * Masquer côté serveur a une conséquence dont on ne se sort pas autrement :
   * ce qui est masqué ne parvient plus à la page, donc plus à aucune interface
   * capable de le rétablir. Le mode édition demande au serveur un modèle qui
   * porte AUSSI ce qu'il masque, marqué comme tel. Il est réservé à
   * l'administrateur, et le dashboard ordinaire ne transporte rien de tout
   * cela.
   *
   * Les cartes ne changent pas d'aspect pour autant : une carte masquée se
   * dessine estompée, avec le même contenu, et les commandes révélées ne
   * rentrent pas dans les cartes — elles ne se règlent que dans le panneau.
   * Régler l'affichage ne doit pas changer l'affichage qu'on règle.
   */

  var EDITING = false

  /*
   * Le mode édition s'applique-t-il ICI ?
   *
   * EDITING dit l'intention, MODEL.reveal dit que le serveur l'a honorée — et
   * la vue dit si le geste a un sens. L'accueil n'en est pas : ses bandes et
   * ses tuiles ne sont pas des cartes, il ne montre jamais ce qui est masqué,
   * et il n'y porte donc aucun signe du mode. Y détourner l'appui donnait le
   * pire des cas : on revient à l'accueil pour juger du résultat, on appuie sur
   * « Plafonnier salon » pour l'éteindre, et un panneau de réglage s'ouvre sans
   * que rien à l'écran ait annoncé ce changement de règle.
   *
   * La recherche, elle, s'affiche par-dessus n'importe quelle vue, l'accueil
   * compris, et reste réglable : ce sont de vraies cartes, avec leur oeil.
   */
  function editingHere() {
    if (!EDITING || !MODEL.reveal) {
      return false
    }
    return (searchNode.value.trim() !== '' || state().view !== 'home')
  }

  /* L'équipement dont le panneau est ouvert en ce moment.
   *
   * Il sert à le rouvrir après une relecture du modèle : chaque réglage relit
   * le modèle entier, et un modèle relu referme tout — sans cela, régler douze
   * éléments d'un aspirateur demande de rouvrir le panneau douze fois. Il
   * couvre du même coup la relecture qu'on n'a pas demandée, celle qui suit une
   * annonce du coeur pendant qu'on règle. */
  var PANEL_ON = 0

  function editMark(device) {
    var box = el('div', 'jg-edit-mark')
    var hidden = (device.drawn === false)
    var button = el('button', 'jg-edit-eye')
    button.type = 'button'
    /* Aucun élément affiché : l'oeil de la carte n'y peut rien, et poser une
     * dérogation d'équipement ne ferait rien revenir. On mène alors là où la
     * décision se prend, élément par élément. Le libellé ne dit pas « masqués
     * un par un » : ils peuvent aussi bien être invisibles dans Jeedom depuis
     * toujours, et l'affirmation serait fausse. */
    if (device.why === 'cmd') {
      button.appendChild(el('i', 'fas fa-list-ul'))
      button.title = '{{Aucun élément affiché — ouvrir le détail}}'
      button.setAttribute('aria-label', button.title)
      button.addEventListener('click', function (event) {
        event.stopPropagation()
        event.preventDefault()
        JG.openPanel(device.id)
      })
      box.appendChild(button)
      /* Et la flèche de retour quand même, si une décision a été prise sur
       * l'équipement : la retirer ici était gratuit. */
      if (device.ovr) {
        box.appendChild(undoButton(device))
      }
      return box
    }
    button.appendChild(el('i', hidden ? 'fas fa-eye-slash' : 'fas fa-eye'))
    button.title = hidden ? '{{Afficher dans jeeGlow}}' : '{{Masquer dans jeeGlow}}'
    /* Le titre suffit à nommer un bouton sans texte, mais la maison pose les
     * deux depuis la pastille des cartes : un lecteur d'écran configuré pour
     * ignorer les infobulles trouve alors quand même le nom. */
    button.setAttribute('aria-label', button.title)
    button.addEventListener('click', function (event) {
      event.stopPropagation()
      event.preventDefault()
      sendOverride('eq', device.id, hidden ? 'show' : 'hide', button)
    })
    box.appendChild(button)
    /* Le retour en arrière n'est proposé que s'il y a quelque chose à défaire :
     * un bouton « rétablir » sur un équipement auquel personne n'a touché ne
     * ferait que poser la question de ce qu'il rétablirait. */
    if (device.ovr) {
      box.appendChild(undoButton(device))
    }
    return box
  }

  function undoButton(device) {
    var back = el('button', 'jg-edit-eye jg-edit-back')
    back.type = 'button'
    back.title = '{{Rendre la décision à Jeedom}}'
    back.setAttribute('aria-label', back.title)
    back.appendChild(el('i', 'fas fa-undo'))
    back.addEventListener('click', function (event) {
      event.stopPropagation()
      event.preventDefault()
      sendOverride('eq', device.id, 'auto', back)
    })
    return back
  }

  /* L'oeil d'un groupe : tout un plugin en vue Système, toute une pièce en vue
   * Pièces. C'est le geste que réclame le cas courant — « je ne veux pas des
   * aspirateurs » ne vise pas un équipement, mais une famille, et le prochain
   * aspirateur acheté doit être masqué d'office. */
  function groupEye(scope, key) {
    var table = (MODEL.overrides && MODEL.overrides[scope]) ? MODEL.overrides[scope] : {}
    var hidden = (table[key] === 'hide')
    /* Ce que Jeedom dit de la cible, quand la question se pose. Un type n'est
     * masqué que d'ici : « auto » suffit à le rétablir. Une pièce, elle, peut
     * être masquée par Jeedom lui-même — invisible, ou retirée du dashboard
     * d'origine — et « auto » la laisserait alors masquée.
     *
     * D'où la nuance, qui était l'erreur : rétablir posait « Toujours
     * affiché » sans condition, épinglant DÉFINITIVEMENT une pièce que Jeedom
     * affiche pourtant — elle ne suivrait plus jamais un masquage décidé
     * là-bas. Et comme aucune pièce n'a de choix à trois positions ailleurs
     * dans la page, plus rien ne pouvait lui rendre sa liberté. */
    var jeedomShown = true
    if (scope === 'room' && JG.ROOMS[key] !== undefined) {
      /* L'oeil montre ce qui EST, et non ce que jeeGlow a écrit : sans cela il
       * propose de masquer une pièce déjà invisible. */
      if (JG.ROOMS[key].drawn === false) {
        hidden = true
      }
      jeedomShown = (JG.ROOMS[key].jeedom !== false)
    }
    var backState = jeedomShown ? 'auto' : 'show'
    var button = el('button', 'jg-edit-eye jg-edit-group')
    button.type = 'button'
    button.appendChild(el('i', hidden ? 'fas fa-eye-slash' : 'fas fa-eye'))
    button.title = hidden ? '{{Rétablir ce groupe}}' : '{{Masquer tout ce groupe dans jeeGlow}}'
    button.setAttribute('aria-label', button.title)
    button.addEventListener('click', function (event) {
      event.stopPropagation()
      sendOverride(scope, key, hidden ? backState : 'hide', button)
    })
    return button
  }

  /* Le choix à trois positions, et non une case à cocher.
   *
   * « Comme Jeedom » n'est pas « affiché » : c'est l'absence de décision, et
   * c'est ce qui permet de revenir en arrière sans avoir à deviner l'état
   * d'origine — et de suivre Jeedom plus tard, si la visibilité y change. Une
   * case à cocher ne sait pas dire ces trois choses. */
  function stateSelect(scope, key, current, jeedomShown, label) {
    var select = el('select', 'jg-edit-state')
    /* Le contrôle le plus utilisé du mode, et le seul sans texte à côté : sans
     * nom accessible, un lecteur d'écran annonce « Comme Jeedom · masqué,
     * liste » sans jamais dire de quoi. */
    select.setAttribute('aria-label', label)
    select.title = label
    var choices = [
      { value: '', label: '{{Comme Jeedom}}' },
      { value: 'show', label: '{{Toujours affiché}}' },
      { value: 'hide', label: '{{Masqué}}' }
    ]
    choices.forEach(function (choice) {
      var label = choice.label
      if (choice.value === '' && jeedomShown !== null) {
        label += jeedomShown ? ' · {{affiché}}' : ' · {{masqué}}'
      }
      var option = el('option', '', label)
      option.value = choice.value
      if (choice.value === (current || '')) {
        option.selected = true
      }
      select.appendChild(option)
    })
    var previous = current || ''
    select.addEventListener('change', function () {
      sendOverride(scope, key, select.value === '' ? 'auto' : select.value, select, function () {
        select.value = previous
      })
    })
    return select
  }

  /* Les réglages d'un équipement, dans son panneau. Construits ici et non dans
   * la carte de détail : le bloc d'enregistrement des cartes ne s'exécute qu'au
   * premier chargement de la page, et tout ce qu'une carte lit dans la
   * fermeture est celui de ce premier passage — le mode édition y serait
   * éternellement éteint. Voir la note sur JG en tête de fichier. */
  function editPanel(device) {
    var box = el('div', 'jg-edit-panel')
    box.appendChild(el('h3', 'jg-edit-title', '{{Affichage dans jeeGlow}}'))
    box.appendChild(el('p', 'jg-edit-hint', '{{Ce qui se règle ici ne concerne que jeeGlow : le dashboard d\'origine continue d\'afficher tout ce que Jeedom lui donne. Un équipement masqué disparaît aussi de la vue Santé — il ne sera plus signalé.}}'))

    var head = el('div', 'jg-edit-row jg-edit-device')
    head.appendChild(el('span', 'jg-edit-name', '{{La carte entière}}'))
    head.appendChild(stateSelect('eq', device.id, device.ovr, null, '{{La carte entière}}'))
    box.appendChild(head)

    /* D'où vient le masquage, et la prise pour le défaire là où il a été
     * décidé. Sans cela, le mode édition montre une carte éteinte dont le
     * réglage dit « comme Jeedom », et on cherche longtemps. */
    if (device.why === 'type') {
      box.appendChild(editReason('{{Masqué avec tout le plugin}} ' + device.eqType,
        '{{Rétablir le plugin}}', 'type', device.eqType, 'auto'))
    } else if (device.why === 'room') {
      box.appendChild(editReason('{{Masqué avec sa pièce}} ' + roomName(device),
        '{{Afficher la pièce}}', 'room', device.roomId, 'show'))
    } else if (device.why === 'jeedom') {
      box.appendChild(editReason('{{Masqué dans Jeedom}}', '', '', '', ''))
    } else if (device.why === 'cmd') {
      box.appendChild(editReason('{{Aucun de ses éléments n\'est affiché}}', '', '', '', ''))
    }

    var list = el('div', 'jg-edit-list')
    var roles = []
    Object.keys(device.roles || {}).forEach(function (key) { roles.push(device.roles[key]) })
    ;(device.all || device.cmds).forEach(function (cmd) {
      var row = el('div', 'jg-edit-row')
      if (cmd.drawn === false) {
        row.dataset.drawn = '0'
      }
      var name = el('span', 'jg-edit-name', cmd.name)
      /* Une commande qui tient un rôle fait la carte : masquer l'état d'une
       * lampe la fait retomber en carte générique. Le dire avant plutôt que de
       * laisser découvrir le changement de forme après coup. */
      if (roles.indexOf(cmd.id) !== -1) {
        name.appendChild(el('span', 'jg-edit-role', '{{rôle}}'))
        name.title = '{{Cet élément donne sa forme à la carte : le masquer la simplifiera.}}'
      }
      row.appendChild(name)
      var tools = el('div', 'jg-edit-tools')
      /* Le widget du plugin, refusé sans masquer la commande : elle reste, et
       * jeeGlow la dessine à sa façon. */
      if (cmd.hasWidget) {
        var flat = el('button', 'jg-edit-flat')
        flat.type = 'button'
        flat.classList.toggle('jg-on', cmd.flat === true)
        flat.title = cmd.flat ? '{{Rendre son widget au plugin}}' : '{{Refuser le widget du plugin et dessiner à la façon de jeeGlow}}'
        flat.setAttribute('aria-label', flat.title)
        flat.appendChild(el('i', 'fas fa-puzzle-piece'))
        flat.addEventListener('click', function () {
          sendOverride('flat', cmd.id, cmd.flat ? 'auto' : 'hide', flat)
        })
        tools.appendChild(flat)
      }
      tools.appendChild(stateSelect('cmd', cmd.id, cmd.ovr, cmd.jeedom, cmd.name))
      row.appendChild(tools)
      list.appendChild(row)
    })
    box.appendChild(list)

    var reset = el('button', 'jg-edit-reset')
    reset.type = 'button'
    reset.appendChild(el('i', 'fas fa-undo'))
    reset.appendChild(el('span', '', '{{Rétablir cet équipement}}'))
    reset.title = '{{Efface toutes les décisions de jeeGlow sur cet équipement et ses éléments.}}'
    reset.addEventListener('click', function () {
      var form = new FormData()
      form.append('action', 'resetDevice')
      form.append('id', device.id)
      sendForm(form, reset)
    })
    box.appendChild(reset)
    return box
  }

  function editReason(text, action, scope, key, state) {
    var row = el('div', 'jg-edit-reason')
    row.appendChild(el('span', '', text))
    if (action !== '') {
      var button = el('button', 'jg-edit-link', action)
      button.type = 'button'
      button.addEventListener('click', function () {
        sendOverride(scope, key, state, button)
      })
      row.appendChild(button)
    }
    return row
  }

  /* Une dérogation posée ou retirée, puis le modèle relu en entier — comme
   * pour le rangement dans une pièce, et pour la même raison : une carte peut
   * changer de forme, une pièce apparaître ou disparaître de la navigation, et
   * recoudre tout cela à la main dans le modèle en mémoire serait un nid à
   * incohérences. */
  function sendOverride(scope, key, state, source, revert) {
    var form = new FormData()
    form.append('action', 'override')
    form.append('scope', scope)
    form.append('key', key)
    form.append('state', state)
    sendForm(form, source, revert)
  }

  /* $revert remet le contrôle dans l'état d'avant quand le serveur refuse.
   * Les yeux et le bouton de gabarit n'en ont pas besoin : ils ne changent
   * d'aspect qu'après relecture du modèle. Un <select>, lui, affiche déjà la
   * valeur choisie — sans cela il annonce « Masqué » alors que rien n'est
   * enregistré, et rien ne vient jamais le démentir. */
  function sendForm(form, source, revert) {
    if (source) {
      source.disabled = true
    }
    fetch('plugins/jeeglowbe/core/ajax/jeeglowbe.ajax.php', {
      method: 'POST', body: form, credentials: 'same-origin'
    }).then(function (response) {
      return response.json()
    }).then(function (data) {
      if (source) {
        source.disabled = false
      }
      if (!data || data.state !== 'ok') {
        editFailed()
        if (revert) {
          revert()
        }
        return
      }
      reloadModel(true)
    }).catch(function () {
      if (source) {
        source.disabled = false
      }
      editFailed()
      if (revert) {
        revert()
      }
    })
  }

  function editFailed(message) {
    if (typeof jeedomUtils !== 'undefined' && jeedomUtils.showAlert) {
      jeedomUtils.showAlert({
        message: message || '{{Le réglage d\'affichage n\'a pas pu être enregistré.}}',
        level: 'danger'
      })
    }
  }

  /*
   * En mode édition, une carte ne pilote plus : elle se règle.
   *
   * C'est le défaut qui rendait le réglage élément par élément introuvable.
   * Une carte pilotable donne toute sa surface à la bascule — c'est voulu, et
   * c'est ce qui fait qu'on éteint une lampe du bout du doigt — et seule la
   * pastille d'icône ouvre le détail. En mode édition, cela signifiait qu'un
   * appui sur une carte ALLUMAIT la lampe au lieu d'ouvrir ses réglages, et
   * que la seule porte vers les éléments était une cible de trente-six pixels
   * dans un coin. On ne la trouvait pas.
   *
   * L'interception est posée en phase de CAPTURE, sur le conteneur des
   * sections : elle passe donc avant les écouteurs des cartes, qui n'ont pas
   * à connaître le mode édition — et qui ne le pourraient pas, puisqu'ils
   * vivent dans la fermeture du premier chargement de la page. Le marqueur
   * d'édition est épargné, c'est lui qui masque et rétablit. Le panneau, lui,
   * n'est pas intercepté : ce qu'on y fait est explicite.
   *
   * « change » autant que « click » : sans lui, un curseur de variateur
   * continuerait d'envoyer sa valeur pendant qu'on range le dashboard.
   */
  function editIntercept(event) {
    if (!editingHere()) {
      return
    }
    var node = event.target
    if (node === null || node.closest === undefined || node.closest('.jg-edit-mark') !== null) {
      return
    }
    var card = node.closest('.jg-card[data-device-id]')
    if (card === null) {
      return
    }
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
      return
    }
    event.stopPropagation()
    event.preventDefault()
    openPanel(card.dataset.deviceId)
  }

  function setEditing(on) {
    var before = EDITING
    EDITING = on
    /* Le bouton s'allume tout de suite, et non au retour du modèle : sur une
     * grosse installation, c'est plusieurs secondes d'un bouton qui ne réagit
     * pas — exactement le symptôme d'un bouton en panne. Il dit l'intention ;
     * la racine, elle, ne portera data-edit qu'une fois le modèle arrivé, car
     * elle dit ce qui est appliqué. */
    syncEdit()
    /* L'accueil ne montre pas des équipements mais l'état de la maison : ses
     * bandes et ses tuiles ne sont pas des cartes, et rien ne s'y règle. Entrer
     * en mode édition depuis l'accueil ne changerait donc rien à l'écran. On
     * mène où il y a quelque chose à faire — en changeant d'adresse SANS
     * dessiner, puisque le modèle qui arrive va le faire, et qu'un premier
     * rendu sans marqueurs serait construit pour rien. */
    if (on && state().view === 'home') {
      window.location.hash = 'view=functions&tab=all'
      drawn = signature()
    }
    /* Le modèle ne contient pas la même chose selon le mode : il faut le
     * relire, et pas seulement redessiner ce qu'on a déjà. */
    reloadModel(true, function () {
      /* Sans cela, l'intention survivait à l'échec : le mode restait demandé,
       * rien ne l'appliquait, et la première annonce du coeur venue rallumait
       * le mode édition tout seul, des minutes plus tard, sur un écran que
       * personne ne regardait plus. */
      EDITING = before
      syncEdit()
      renderView()
      editFailed('{{Le mode réglage n\'a pas pu être ouvert.}}')
    })
  }

  var editButton = null

  function syncEdit() {
    ROOT.dataset.edit = (EDITING && MODEL.reveal) ? '1' : '0'
    var tools = ROOT.querySelector('.jg-topbar-tools')
    if (tools === null) {
      return
    }
    if (!MODEL.admin) {
      if (editButton !== null) {
        editButton.remove()
        editButton = null
      }
      EDITING = false
      return
    }
    if (editButton === null) {
      editButton = el('button', 'jg-icon-btn jg-edit-btn')
      editButton.type = 'button'
      editButton.appendChild(el('i', 'fas fa-sliders-h'))
      editButton.addEventListener('click', function () { setEditing(!EDITING) })
      /* Le repère est cherché DANS cette barre, et non dans le document :
       * Jeedom change de page en ajax, et si l'ancien dashboard est encore
       * attaché au moment où le nouveau se dessine, getElementById rend le
       * bouton de l'ancien — qui n'est enfant de rien ici. insertBefore lève
       * alors une exception au milieu de render(), et le dashboard reste
       * vide. Un querySelector de portée règle la question, et un repère
       * absent fait simplement un ajout en fin de barre. */
      tools.insertBefore(editButton, tools.querySelector('#jg-fullscreen'))
    }
    editButton.classList.toggle('jg-on', EDITING)
    editButton.title = EDITING ? '{{Quitter le réglage de l\'affichage}}' : '{{Régler ce que jeeGlow affiche}}'
  }

  /* ------------------------------------------------------------- la structure
   *
   * Un rail de vues à gauche, des sous-onglets en haut, et un panneau de détail
   * qui s'ouvre sur la droite. Ce découpage n'est pas cosmétique : tant que tout
   * tenait sur une page unique, jeeGlow reproduisait l'architecture du dashboard
   * d'origine — une grille plate d'équipements groupés par objet — et aucune
   * couleur n'y changeait rien.
   *
   * L'axe principal est le DOMAINE et non la pièce. Sur une installation
   * ordinaire, la moitié des équipements n'appartient à aucun objet : un
   * rangement par pièce y est vide de moitié le premier jour. Les pièces restent
   * une vue à part entière, qui devient la bonne à mesure qu'on range.
   */

  var sectionsNode = document.getElementById('jg-sections')
  var railNode = document.getElementById('jg-rail')
  var tabsNode = document.getElementById('jg-subtabs')
  var emptyNode = document.getElementById('jg-empty')
  var searchNode = document.getElementById('jg-search')
  var brandNode = ROOT.querySelector('.jg-brand-name')
  var panelNode = document.getElementById('jg-panel')
  var panelBody = document.getElementById('jg-panel-body')
  var panelTitle = ROOT.querySelector('.jg-panel-title')
  var backdropNode = document.getElementById('jg-panel-backdrop')
  var renameButton = document.getElementById('jg-panel-rename')

  var kioskButton = null

  var VIEWS = [
    { key: 'home', name: '{{Accueil}}', icon: 'fas fa-home' },
    { key: 'functions', name: '{{Fonctions}}', icon: 'fas fa-th-large' },
    { key: 'rooms', name: '{{Pièces}}', icon: 'fas fa-door-open' },
    { key: 'health', name: '{{Santé}}', icon: 'fas fa-heartbeat' },
    { key: 'system', name: '{{Système}}', icon: 'fas fa-cogs' }
  ]

  /* L'ordre compte : c'est celui des sous-onglets et des sections. On commence
   * par ce qu'on pilote, on finit par ce qu'on consulte. */
  /* « one » est le nom au singulier, en minuscule, tel qu'il se dit au milieu
   * d'une phrase : « 1 lumière en marche ». Il est écrit et non déduit, parce
   * qu'aucune règle mécanique ne marche — retirer un « s » donnerait « 1
   * chauffage » correct mais « 1 sécurité » absurde, et la règle change de
   * langue en langue, ce que la traduction doit pouvoir reprendre. */
  var DOMAINS = [
    { key: 'light', name: '{{Lumières}}', one: '{{lumière}}', icon: 'fas fa-lightbulb' },
    { key: 'socket', name: '{{Prises}}', one: '{{prise}}', icon: 'fas fa-plug' },
    { key: 'cover', name: '{{Volets}}', one: '{{volet}}', icon: 'fas fa-bars' },
    { key: 'climate', name: '{{Chauffage}}', one: '{{radiateur}}', icon: 'fas fa-fire' },
    { key: 'security', name: '{{Sécurité}}', one: '{{alarme}}', icon: 'fas fa-shield-alt' },
    { key: 'camera', name: '{{Caméras}}', one: '{{caméra}}', icon: 'fas fa-video' },
    { key: 'media', name: '{{Multimédia}}', one: '{{lecteur}}', icon: 'fas fa-music' },
    { key: 'appliance', name: '{{Appareils}}', one: '{{appareil}}', icon: 'fas fa-robot' },
    { key: 'weather', name: '{{Météo}}', one: '{{station}}', icon: 'fas fa-cloud-sun' },
    { key: 'energy', name: '{{Énergie}}', one: '{{compteur}}', icon: 'fas fa-bolt' },
    { key: 'sensor', name: '{{Capteurs}}', one: '{{capteur}}', icon: 'fas fa-microchip' },
    { key: 'info', name: '{{Information}}', one: '{{information}}', icon: 'fas fa-info-circle' }
  ]

  function domainOf(key) {
    for (var i = 0; i < DOMAINS.length; i++) {
      if (DOMAINS[i].key === key) {
        return DOMAINS[i]
      }
    }
    return { key: key, name: key, icon: 'fas fa-cube' }
  }

  function devicesOf(ids) {
    return (ids || []).map(function (id) {
      return MODEL.devices[id]
    }).filter(function (device) {
      return device !== undefined
    }).sort(function (a, b) {
      return a.order - b.order
    })
  }

  function allDevices() {
    return Object.keys(MODEL.devices || {}).map(function (key) {
      return MODEL.devices[key]
    })
  }

  /*
   * Ce que le dashboard montrera vraiment.
   *
   * En mode édition, le modèle porte aussi ce que jeeGlow masque : c'est
   * indispensable là où une carte porte son oeil et se rétablit — Fonctions,
   * Pièces, Système, recherche. Partout ailleurs, ce serait un mensonge. Un
   * équipement masqué n'a pas à compter dans une tuile de domaine, à peupler
   * « en ce moment », ni à fournir la température de l'accueil : l'accueil ne
   * règle rien, il dit l'état de la maison, et il doit dire celui que la
   * maison verra. Révéler sert à régler, pas à changer les comptes.
   */
  function drawnOnly(devices) {
    return devices.filter(function (device) {
      return device !== undefined && device.drawn !== false
    })
  }

  /* --------------------------------------------------------- les regroupements */

  function domainGroups() {
    var groups = []
    DOMAINS.forEach(function (domain) {
      var devices = allDevices().filter(function (device) {
        return device.domain === domain.key
      })
      if (devices.length > 0) {
        groups.push({ key: domain.key, name: domain.name, one: domain.one, icon: domain.icon, devices: devices })
      }
    })
    return groups
  }

  function roomGroups() {
    return (MODEL.rooms || []).map(function (room) {
      return { key: String(room.id), name: room.name, icon: 'fas fa-door-open', devices: devicesOf(room.devices) }
    }).filter(function (group) {
      return group.devices.length > 0
    })
  }

  function systemGroups() {
    var byType = {}
    allDevices().forEach(function (device) {
      (byType[device.eqType] = byType[device.eqType] || []).push(device)
    })
    return Object.keys(byType).sort().map(function (type) {
      return { key: type, name: type, icon: 'fas fa-puzzle-piece', devices: byType[type] }
    })
  }

  /* ------------------------------------------------------------- la santé
   *
   * Ce que le dashboard d'origine ne dit nulle part, et que le nôtre taisait
   * aussi : une pile morte, un équipement qui ne répond plus, un seuil
   * franchi. Il fallait jusqu'ici parcourir quatre cents tuiles à l'oeil pour
   * l'apprendre. Le modèle porte désormais le statut que le coeur tient déjà —
   * il le payait sans le lire.
   *
   * Aucun seuil n'est inventé : le coeur pose lui-même timeout, warning et
   * danger. Seule la limite de pile est à nous, faute de la recevoir. */
  var BATTERY_LOW = 25

  /* La dernière fois qu'un équipement a dit quelque chose. Sans elle, une
   * mesure figée depuis trois jours s'affiche comme si elle venait d'arriver,
   * et un démon tombé passe inaperçu. */
  /* Jeedom écrit « 2026-09-21 13:08:03 » : Safari refuse ce format tel quel,
   * d'où le T. */
  function stamp(text) {
    if (!text) {
      return 0
    }
    var time = Date.parse(String(text).replace(' ', 'T'))
    return isNaN(time) ? 0 : time
  }

  function lastSeen(device) {
    /* Le coeur tient déjà cette date pour nous : lastCommunication, écrite à
     * chaque remontée d'un équipement, que le modèle transporte sous
     * status.comm. La balayage des dates de commandes ne sert plus qu'à
     * défaut — et ce n'était pas gratuit : deux cents Date.parse par appel, et
     * troubles() est appelé deux fois par rendu de l'accueil, trois sur la vue
     * Santé, à chaque frappe dans la recherche et à chaque bascule. */
    var comm = stamp(device.status ? device.status.comm : null)
    if (comm > 0) {
      return comm
    }
    var latest = 0
    device.cmds.forEach(function (cmd) {
      var time = stamp(cmd.date)
      if (time > latest) {
        latest = time
      }
    })
    return latest
  }

  /* Trois jours, et jamais dans le compte des alertes.
   *
   * Le silence n'est pas une panne : une caméra dont la dernière commande est
   * « dernier événement » se tait tant que rien ne bouge, et sur l'installation
   * d'essai un seuil de deux jours signalait huit équipements dont six allaient
   * parfaitement bien. Un bandeau qui crie au loup pour rien n'est plus lu du
   * tout — c'est le seul défaut qui coûte plus cher que l'absence d'alerte.
   *
   * L'information reste donc offerte, dans la vue Santé où on la cherche, mais
   * elle ne gonfle ni la pastille du rail ni le bandeau de l'accueil, qui ne
   * comptent que ce que le coeur affirme : injoignable, hors plage, pile
   * faible. */
  var STALE_AFTER = 72 * 3600000

  function troubles() {
    var found = { mute: [], weak: [], alert: [], stale: [] }
    var now = Date.now()
    allDevices().forEach(function (device) {
      /* Ce qui est masqué n'est plus signalé — c'est le sens même du geste, et
       * c'est dit en toutes lettres dans le panneau de réglage. Le filtre est
       * ici plutôt que dans la vue Santé parce que ce même relevé alimente la
       * pastille du rail : un équipement masqué ne doit pas non plus y faire
       * compter une alerte. En mode édition, la vue Santé continue donc de dire
       * ce que le dashboard dira — révéler sert à régler, pas à changer les
       * comptes. */
      if (device.drawn === false) {
        return
      }
      var status = device.status || {}
      if (status.timeout) {
        found.mute.push(device)
        return
      }
      if (status.danger || status.warning) {
        found.alert.push(device)
      }
      var level = batteryLevel(device)
      if (level !== null && level <= BATTERY_LOW) {
        found.weak.push(device)
      }
      var seen = lastSeen(device)
      if (seen > 0 && now - seen > STALE_AFTER) {
        found.stale.push(device)
      }
    })
    return found
  }

  function troubleCount(found) {
    return found.mute.length + found.weak.length + found.alert.length
  }

  function healthGroups() {
    var found = troubles()
    return [
      { key: 'mute', name: '{{Ne répondent plus}}', icon: 'fas fa-unlink', devices: found.mute },
      { key: 'alert', name: '{{Hors plage}}', icon: 'fas fa-exclamation-triangle', devices: found.alert },
      { key: 'weak', name: '{{Piles faibles}}', icon: 'fas fa-battery-quarter', devices: found.weak },
      { key: 'stale', name: '{{Sans nouvelles depuis trois jours}}', icon: 'far fa-clock', devices: found.stale }
    ].filter(function (group) {
      return group.devices.length > 0
    })
  }

  function groupsFor(view) {
    if (view === 'rooms') {
      return roomGroups()
    }
    if (view === 'system') {
      return systemGroups()
    }
    if (view === 'health') {
      return healthGroups()
    }
    return domainGroups()
  }

  /* ------------------------------------------------------------ la navigation */

  function state() {
    var hash = window.location.hash
    var view = /view=([a-z]+)/.exec(hash)
    var tab = /tab=([^&]+)/.exec(hash)
    return {
      /* L'Accueil, et non l'inventaire. La vue conçue pour le coup d'oeil
       * était la seule qu'on ne voyait jamais sans un clic — et c'est
       * pourtant celle vers laquelle la veille kiosque ramène d'elle-même. */
      view: (view === null) ? 'home' : view[1],
      tab: (tab === null) ? 'all' : decodeURIComponent(tab[1])
    }
  }

  /* L'adresse d'abord, le rendu tout de suite après, sans attendre hashchange :
   * cet événement est asynchrone, et l'écran restait sur la vue précédente le
   * temps d'un battement. L'écouteur hashchange reste utile pour les boutons
   * précédent et suivant du navigateur, d'où la signature qui évite de dessiner
   * deux fois la même chose. */
  var drawn = null

  function goTo(view, tab) {
    window.location.hash = 'view=' + view + '&tab=' + encodeURIComponent(tab || 'all')
    renderView()
  }

  function onHashChange() {
    if (signature() !== drawn) {
      renderView()
    }
  }

  function signature() {
    return window.location.hash + '\u0000' + searchNode.value
  }

  function buildRail() {
    railNode.textContent = ''
    var current = state().view
    VIEWS.forEach(function (view) {
      var button = el('button', 'jg-rail-item')
      button.dataset.view = view.key
      button.appendChild(el('i', view.icon))
      button.appendChild(el('span', 'jg-rail-label', view.name))
      button.classList.toggle('jg-rail-on', view.key === current)
      /* Le compte des ennuis se porte sur le rail : une alerte qu'il faut
       * aller chercher dans une vue n'alerte personne. */
      if (view.key === 'health') {
        var count = troubleCount(troubles())
        if (count > 0) {
          button.appendChild(el('span', 'jg-rail-count', String(count)))
        }
      }
      button.addEventListener('click', function () { goTo(view.key, 'all') })
      railNode.appendChild(button)
    })

    /* Le kiosque au bas du rail, avec son nom écrit. Il existait déjà, mais
     * sous la forme d'une icône muette au milieu des outils : personne n'avait
     * de raison d'y voir le bouton qui retire le menu de Jeedom. */
    kioskButton = el('button', 'jg-rail-item jg-rail-kiosk')
    kioskButton.appendChild(el('i', 'fas fa-expand'))
    kioskButton.appendChild(el('span', 'jg-rail-label', '{{Kiosque}}'))
    kioskButton.addEventListener('click', function () {
      setFullscreen(!document.body.classList.contains('fullscreen'))
    })
    railNode.appendChild(kioskButton)
    syncKioskButton()
  }

  /* Le même état sur les deux boutons : celui du rail et celui de la barre. */
  function syncKioskButton() {
    var on = kioskOn()
    if (kioskButton !== null) {
      kioskButton.classList.toggle('jg-rail-on', on)
      kioskButton.querySelector('i').className = on ? 'fas fa-compress' : 'fas fa-expand'
      kioskButton.querySelector('.jg-rail-label').textContent = on ? '{{Quitter}}' : '{{Kiosque}}'
      kioskButton.title = on ? '{{Rendre son menu à Jeedom}}' : '{{Masquer le menu de Jeedom}}'
    }
  }

  function buildTabs(groups) {
    tabsNode.textContent = ''
    var here = state()
    if (here.view === 'home' || groups.length <= 1) {
      tabsNode.hidden = true
      return
    }
    tabsNode.hidden = false
    /* « Aperçu » et non « Tout » : cet onglet montre les sections en colonnes,
     * écrêtées, avec un renvoi vers la page de chaque domaine. L'appeler
     * « Tout » quand il n'affiche que six équipements sur vingt-huit serait
     * une promesse non tenue. */
    var entries = [{ key: 'all', name: '{{Aperçu}}' }].concat(groups)
    entries.forEach(function (entry) {
      var tab = el('button', 'jg-tab', entry.name)
      tab.dataset.tab = entry.key
      tab.classList.toggle('jg-tab-on', entry.key === here.tab)
      tab.addEventListener('click', function () { goTo(here.view, entry.key) })
      tabsNode.appendChild(tab)
    })
  }

  /* ------------------------------------------------------------- les sections */

  /* Ce qu'une section montre quand elle en partage l'écran avec onze autres.
   * Au-delà, une seule section de vingt-huit prises ferait une colonne haute de
   * deux mille pixels et les autres flotteraient à côté. L'aperçu renvoie vers
   * la page du domaine, qui montre tout. */
  var PREVIEW_LIMIT = 6

  /* Le bouton d'extinction d'une rangée entière, et son entretien.
   *
   * Hors de l'accueil, rien ne redessine la vue quand une lampe s'éteint : les
   * cartes se synchronisent d'elles-mêmes, la page reste en place. Un
   * « Tout éteindre » construit une fois pour toutes resterait donc affiché
   * sous une rangée entièrement éteinte — un bouton qui ment. Il porte sa
   * propre liste et se relit à chaque changement d'état.
   *
   * Le seuil est celui de « En ce moment » : deux. Une seule lampe allumée
   * s'éteint sur sa carte, et un bouton de rangée pour un seul équipement est
   * un détour. */
  function offAction(pool) {
    var button = el('button', 'jg-section-action', '{{Tout éteindre}}')
    button.type = 'button'
    button._jgPool = pool
    button.addEventListener('click', function () {
      /* La cible est relue à l'appui, et non celle d'il y a dix minutes : ce
       * qui s'est éteint entre-temps n'a pas à recevoir une commande. */
      var lit = pool.filter(isLit)
      if (lit.length > 1) {
        turnAllOff(lit, button)
      }
    })
    syncOffAction(button)
    return button
  }

  function syncOffAction(button) {
    button.hidden = (button._jgPool.filter(isLit).length < 2)
  }

  function syncOffActions() {
    Array.prototype.forEach.call(sectionsNode.querySelectorAll('.jg-section-action'), function (button) {
      if (button._jgPool !== undefined) {
        syncOffAction(button)
      }
    })
  }

  function section(group, view, limit) {
    var node = el('section', 'jg-section')
    node.dataset.groupKey = group.key
    var title = el('h2', 'jg-section-title')
    if (group.icon) {
      title.appendChild(el('i', group.icon + ' jg-section-icon'))
    }
    title.appendChild(el('span', 'jg-section-name', group.name))
    title.appendChild(el('span', 'jg-section-count', String(group.devices.length)))
    /* Un plugin en vue Système, une pièce en vue Pièces : ce sont les deux
     * seules vues dont les groupes correspondent à une portée réglable. Les
     * domaines et les résultats de recherche n'en sont pas — ils se recoupent,
     * et masquer « Lumières » ne veut rien dire pour une lampe qui est aussi
     * une prise. « Non classé » non plus : ce n'est pas une pièce. */
    if (editingHere() && (view === 'system' || view === 'rooms') && group.key !== '0') {
      title.appendChild(groupEye(view === 'system' ? 'type' : 'room', group.key))
    }
    /* « Tout éteindre » appartient aussi aux pages de domaine et de pièce.
     *
     * Il n'existait que sur « En ce moment ». Or c'est en entrant dans
     * « Lumières » ou dans « Salon » qu'on veut couper d'un geste, et c'est là
     * qu'il fallait éteindre douze cartes une par une.
     *
     * Trois vues sont écartées, et pour trois raisons différentes. L'aperçu,
     * parce qu'une section écrêtée montre six cartes sur vingt-huit : un
     * bouton qui en éteindrait vingt-huit sous une rangée de six promet autre
     * chose que ce qu'il fait. La vue Santé, parce qu'une pile faible ne
     * s'éteint pas. La recherche, parce qu'une liste de résultats n'est pas un
     * ensemble qu'on pilote — « volet » rapporte aussi bien le volet du salon
     * que le scénario qui les ferme. */
    if (!limit && (view === 'functions' || view === 'rooms')) {
      var pool = drawnOnly(group.devices).filter(function (device) {
        return device.roles && (device.roles.off !== undefined || device.roles.toggle !== undefined)
      })
      if (pool.length > 1) {
        title.appendChild(offAction(pool))
      }
    }
    node.appendChild(title)
    var grid = el('div', 'jg-grid')
    var shown = (limit && group.devices.length > limit) ? group.devices.slice(0, limit) : group.devices
    shown.forEach(function (device) {
      grid.appendChild(makeCard(device))
    })
    if (shown.length < group.devices.length) {
      var more = el('button', 'jg-domain jg-more-tile')
      more.appendChild(el('span', 'jg-domain-name', '+ ' + (group.devices.length - shown.length)))
      more.appendChild(el('span', 'jg-domain-count', '{{Tout voir}}'))
      more.addEventListener('click', function () { goTo(view || 'functions', group.key) })
      grid.appendChild(more)
    }
    node.appendChild(grid)
    return node
  }

  /* L'accueil ne montre pas des équipements mais l'état de la maison : ce qui
   * est allumé, ce qui consomme, ce qu'il fait dehors. C'est la seule vue qui
   * répond à la question qu'on se pose en entrant dans une pièce, et c'est
   * précisément celle qu'aucun dashboard d'origine ne propose. */
  function buildHome() {
    var groups = domainGroups().map(function (group) {
      group.devices = drawnOnly(group.devices)
      return group
    }).filter(function (group) {
      return group.devices.length > 0
    })

    buildHero()
    buildAlertBar()
    /* Ce qui est allumé passe devant le lanceur, et ce n'est pas un goût de
     * rangement.
     *
     * Mesuré sur une tablette murale de 1280 par 800 : l'en-tête, le bandeau
     * d'alerte et douze tuiles de domaine remplissaient l'écran entier. Le
     * premier écran d'un dashboard domotique ne contenait donc rien sur quoi
     * appuyer — « En ce moment », la seule section où l'on éteint quelque
     * chose, commençait sous la ligne de flottaison. Un menu passe après ce
     * qu'on est venu faire. */
    buildRunning()
    /* Les domaines en tuiles pleines et non en pilules grises : c'est le
     * lanceur de la maison, l'endroit d'où l'on part. Une pilule de treize
     * pixels ne se vise pas au doigt et ne se distingue pas de loin. */
    var shortcuts = el('div', 'jg-grid jg-grid-launch')
    groups.forEach(function (group) {
      /* Le nom en haut, l'état en bas, et l'icône en filigrane derrière,
       * débordant du coin : elle donne à la tuile sa silhouette sans disputer
       * la place au texte. C'est ce qui permet de reconnaître une tuile du
       * coin de l'oeil, avant même de la lire. */
      var tile = el('button', 'jg-launch')
      tile.dataset.domain = group.key
      tile.appendChild(el('span', 'jg-launch-name', group.name))
      tile.appendChild(el('i', group.icon + ' jg-launch-mark'))
      var count = el('span', 'jg-launch-count', '')
      tile.appendChild(count)
      tile.addEventListener('click', function () { goTo('functions', group.key) })
      /* « Météo 12,4 °C » et « Énergie 1,8 kW » se périment sans qu'aucun
       * équipement n'ait basculé : le redessin de l'accueil, qui ne se
       * déclenche que sur une bascule, ne les rattrapait jamais. */
      live(tile, tileIds(group.devices, LAUNCH_MEASURES[group.key]), function () {
        var lit = group.devices.filter(isLit).length
        count.textContent = launchState(group, lit)
        tile.classList.toggle('jg-launch-on', lit > 0)
      })
      shortcuts.appendChild(tile)
    })
    if (shortcuts.children.length > 0) {
      sectionsNode.appendChild(shortcuts)
    }
    buildScenes()

    var node = el('section', 'jg-section')
    var title = el('h2', 'jg-section-title')
    title.appendChild(el('span', 'jg-section-name', '{{Les pièces}}'))
    node.appendChild(title)
    /* Les pièces où il se passe quelque chose d'abord, et la première plus
     * large que les autres. Huit rectangles identiques alignés ne se lisent
     * pas : l'oeil n'a aucune raison de commencer quelque part. Une tuile
     * double en tête donne ce point de départ, et l'ordre donne le sens. */
    var rooms = el('div', 'jg-grid jg-grid-rooms')
    var peopled = (MODEL.rooms || []).map(function (room) {
      var devices = drawnOnly(devicesOf(room.devices))
      return { room: room, devices: devices, lit: devices.filter(isLit).length }
    }).filter(function (entry) {
      return entry.devices.length > 0
    }).sort(function (a, b) {
      return b.lit - a.lit
    })

    peopled.forEach(function (entry) {
      var room = entry.room
      var devices = entry.devices
      /* Toutes de la même taille.
       *
       * La première était double pour donner à l'oeil un point d'entrée, à une
       * époque où huit rectangles gris alignés ne se distinguaient pas les uns
       * des autres. Ce n'est plus le cas : les pièces où quelque chose tourne
       * portent l'aplat, elles passent en tête, et le point d'entrée est là.
       * Restait une tuile deux fois plus large que ses voisines pour la même
       * hauteur — le seul rectangle de la page qui n'ait ni la proportion ni
       * la trame des autres. */
      var tile = el('button', 'jg-domain jg-room-tile')
      tile.dataset.room = String(room.id)
      /* L'icône et la couleur que l'utilisateur a déjà choisies dans Jeedom.
       * Les ignorer pour coller la même porte ouverte sur le garage, le jardin
       * et la cuisine, c'était jeter un travail déjà fait. */
      if (room.color) {
        tile.style.setProperty('--jg-tint', room.color)
      }
      /* L'icône d'abord, et en grand. Une tuile se reconnaît à sa forme et à sa
       * couleur avant de se lire : c'est ce qui permet de viser la bonne pièce
       * d'un geste sur une tablette, sans parcourir huit libellés. */
      var art = el('div', 'jg-tile-art')
      art.appendChild(el('i', room.icon || 'fas fa-door-open'))
      tile.appendChild(art)
      tile.appendChild(el('span', 'jg-domain-name', room.name))
      var count = el('span', 'jg-domain-count', '')
      tile.appendChild(count)
      tile.addEventListener('click', function () { goTo('rooms', String(room.id)) })
      /* La température d'une pièce change sans que rien n'ait basculé : c'est
       * même ce qu'elle fait de plus régulier. Sans abonnement, la tuile
       * affichait celle du dernier redessin. */
      live(tile, tileIds(devices, ROOM_MEASURES), function () {
        var lit = devices.filter(isLit).length
        count.textContent = summaryOf(devices) ||
          (devices.length + ' ' + ((devices.length > 1) ? '{{équipements}}' : '{{équipement}}'))
        tile.classList.toggle('jg-domain-on', lit > 0)
      })
      rooms.appendChild(tile)
    })
    node.appendChild(rooms)
    if (rooms.children.length > 0) {
      sectionsNode.appendChild(node)
    }

  }

  /* ------------------------------------------------------------- l'en-tête
   *
   * Une horloge seule posée en haut à gauche laissait les deux tiers d'un écran
   * large vides, et il fallait descendre pour apprendre quoi que ce soit. La
   * rangée dit maintenant l'essentiel d'un regard : l'heure, ce qui tourne en
   * ce moment, et ce qu'il fait dehors. C'est la seule partie du dashboard
   * qu'on lit à trois mètres sans s'approcher. */

  function buildHero() {
    /* Une grille de douze colonnes, et des tuiles qui n'occupent pas toutes la
     * même largeur. C'est la seule façon d'obtenir un écran qui se regarde
     * plutôt qu'une pile de rangées identiques : l'oeil a besoin d'un point
     * d'entrée — l'heure — puis de blocs de tailles décroissantes. */
    var hero = el('div', 'jg-bento')

    var left = el('div', 'jg-hero-now jg-bento-clock')
    var clock = el('div', 'jg-clock')
    clock.appendChild(el('div', 'jg-clock-time', ''))
    clock.appendChild(el('div', 'jg-clock-date', ''))
    left.appendChild(clock)
    var chips = activityChips()
    if (chips !== null) {
      left.appendChild(chips)
    }
    hero.appendChild(left)

    /* Les synthèses vivent dans une colonne à elles, et non côte à côte dans la
     * grille : c'est ce qui permet d'en avoir une ou deux sans que la rangée
     * déborde ni qu'une carte seule s'étire à vide sur deux hauteurs. */
    var cards = summaryCards()
    if (cards.length > 0) {
      var side = el('div', 'jg-bento-side')
      cards.forEach(function (card) {
        card.classList.add('jg-bento-card')
        side.appendChild(card)
      })
      hero.appendChild(side)
    }

    /* La vignette caméra. Elle occupe la hauteur des deux rangées de synthèse
     * et comble le vide de droite, mais surtout : dix-huit caméras sur cette
     * installation et aucune n'apparaissait sur l'accueil. C'est la carte
     * caméra ordinaire, à qui l'on donne simplement plus de place. */
    var cam = firstCamera()
    if (cam !== null) {
      var tile = makeCard(cam)
      tile.classList.add('jg-bento-cam')
      hero.appendChild(tile)
    }

    /* Sans caméra, les deux cartes de synthèse se partagent la place qu'elle
     * aurait prise plutôt que de laisser un trou. */
    hero.dataset.cam = (cam !== null) ? '1' : '0'
    hero.dataset.cards = String(cards.length)

    sectionsNode.appendChild(hero)
    syncClock()
  }

  /* La caméra la plus parlante : celle qui a détecté quelque chose, à défaut la
   * première. Une vignette qui montre un jardin au repos vaut mieux que rien,
   * mais une qui montre ce qui bouge vaut mieux que tout. */
  function firstCamera() {
    var cams = drawnOnly(allDevices()).filter(function (device) {
      return cardType(device) === 'camera'
    })
    if (cams.length === 0) {
      return null
    }
    var moving = cams.filter(function (device) {
      return device.cmds.some(function (cmd) {
        return cmd.generic === 'PRESENCE' && isTrue(cmd, JG.VALUES[cmd.id])
      })
    })
    return moving[0] || cams[0]
  }

  /* Ce qui tourne, en toutes lettres et par domaine. « 9 prises en marche » se
   * lit de loin ; une pastille de couleur sur une tuile, non. */
  var CHIP_LIMIT = 3

  function activityChips() {
    var found = domainGroups().map(function (group) {
      return { group: group, lit: group.devices.filter(isLit).length }
    }).filter(function (entry) {
      return entry.lit > 0
    }).sort(function (a, b) {
      return b.lit - a.lit
    }).slice(0, CHIP_LIMIT)
    if (found.length === 0) {
      return null
    }
    var row = el('div', 'jg-hero-chips')
    found.forEach(function (entry) {
      var chip = el('button', 'jg-hero-chip')
      chip.type = 'button'
      chip.appendChild(el('i', entry.group.icon))
      var noun = (entry.lit === 1 && entry.group.one) ? entry.group.one : entry.group.name.toLowerCase()
      chip.appendChild(el('span', null, entry.lit + ' ' + noun + ' {{en marche}}'))
      chip.addEventListener('click', function () { goTo('functions', entry.group.key) })
      row.appendChild(chip)
    })
    return row
  }

  /* Deux cartes de synthèse, dehors et dedans, construites à partir des mêmes
   * mesures que les anciennes pastilles — mais groupées, attribuées, et assez
   * grandes pour être lues du canapé. Aucune n'apparaît si l'installation ne
   * mesure rien : on n'invente pas un bulletin météo. */
  var OUTSIDE = [
    { generic: 'WEATHER_TEMPERATURE', name: '{{Dehors}}', icon: 'fas fa-cloud-sun' },
    { generic: 'WEATHER_HUMIDITY', name: '{{Humidité}}', icon: 'fas fa-tint' },
    { generic: 'WEATHER_CONDITION', name: '{{Ciel}}', icon: 'fas fa-cloud' }
  ]

  var INSIDE = [
    { generic: 'TEMPERATURE', name: '{{Intérieur}}', icon: 'fas fa-thermometer-half' },
    { generic: 'HUMIDITY', name: '{{Humidité}}', icon: 'fas fa-tint' },
    { generic: 'POWER', name: '{{Consommation}}', icon: 'fas fa-bolt' }
  ]

  /* Le ciel, en icône.
   *
   * La carte « Dehors » portait « fas fa-cloud-sun » par construction, quel que
   * soit le temps : la plus grande vignette de l'accueil — celle qu'on lit à
   * trois mètres, sans s'approcher — annonçait une éclaircie sous la pluie. Le
   * renseignement était pourtant déjà là, lu et écrit en toutes lettres au bas
   * de cette même carte.
   *
   * La reconnaissance se fait sur des mots et non sur un code. Les plugins
   * météo ne s'accordent sur aucune table de codes — chacun a la sienne, et
   * certains ne rendent qu'un texte — mais tous écrivent la condition en clair
   * dans la langue de Jeedom. Les deux langues du plugin sont couvertes, les
   * accents retirés de part et d'autre de la comparaison.
   *
   * L'ordre est celui du plus précis au plus général : « partiellement
   * nuageux » contient « nuageux », et doit rendre l'éclaircie plutôt que le
   * ciel couvert. Une condition non reconnue garde l'icône d'origine, qui
   * reste une icône de météo : se tromper de temps serait pire que de ne pas
   * en changer. */
  var SKIES = [
    { icon: 'fas fa-bolt', words: ['orage', 'tonnerre', 'thunder', 'storm'] },
    { icon: 'fas fa-snowflake', words: ['neige', 'grele', 'snow', 'sleet', 'hail'] },
    { icon: 'fas fa-cloud-showers-heavy', words: ['averse', 'shower', 'pluie forte', 'heavy rain'] },
    { icon: 'fas fa-cloud-rain', words: ['pluie', 'bruine', 'rain', 'drizzle'] },
    { icon: 'fas fa-smog', words: ['brouillard', 'brume', 'fog', 'mist', 'haze'] },
    { icon: 'fas fa-wind', words: ['vent', 'wind'] },
    { icon: 'fas fa-cloud-sun', words: ['eclaircie', 'partiellement', 'partly', 'variable'] },
    { icon: 'fas fa-cloud', words: ['couvert', 'nuageux', 'nuage', 'overcast', 'cloud'] },
    { icon: 'fas fa-sun', words: ['ensoleille', 'soleil', 'degage', 'clair', 'sunny', 'clear', 'fair'] }
  ]

  /* Un soleil à vingt-trois heures se remarque plus que la bonne icône. Deux
   * bornes fixes plutôt qu'un calcul d'éphémérides : l'icône n'a pas à être
   * juste à la minute du coucher, elle a à ne pas montrer le jour en pleine
   * nuit. Les heures de nuit du kiosque ne conviennent pas — elles règlent
   * l'atténuation d'un écran, qui est une autre question, et restent vides sur
   * la plupart des installations. */
  var NIGHT_SKIES = { 'fas fa-sun': 'fas fa-moon', 'fas fa-cloud-sun': 'fas fa-cloud-moon' }

  /* Minuscules et sans accents, des deux côtés de la comparaison : les plugins
   * météo écrivent aussi bien « Ensoleillé » que « ENSOLEILLE ». Le nom est
   * distinct de la variable « plain » des cartes, qui désigne tout autre chose
   * — une ligne sans widget ni image. */
  function plainWords(text) {
    var value = String(text).toLowerCase()
    return value.normalize ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : value
  }

  function skyIcon(values) {
    var fallback = values[0].icon
    var sky = null
    values.forEach(function (found) {
      if (found.generic === 'WEATHER_CONDITION') {
        sky = plainWords(format(found.id))
      }
    })
    if (sky === null) {
      return fallback
    }
    var chosen = fallback
    for (var i = 0; i < SKIES.length; i++) {
      var hit = SKIES[i].words.some(function (word) { return sky.indexOf(word) !== -1 })
      if (hit) {
        chosen = SKIES[i].icon
        break
      }
    }
    var hour = new Date().getHours()
    if ((hour >= 21 || hour < 7) && NIGHT_SKIES[chosen] !== undefined) {
      return NIGHT_SKIES[chosen]
    }
    return chosen
  }

  function summaryCards() {
    return [OUTSIDE, INSIDE].map(function (set) {
      var values = set.map(pickMeasure).filter(function (found) { return found !== null })
      if (values.length === 0) {
        return null
      }
      var card = el('button', 'jg-hero-card')
      card.type = 'button'
      var head = el('div', 'jg-hero-head')
      head.appendChild(el('span', 'jg-hero-label', values[0].name))
      var mark = el('i', 'jg-hero-mark')
      head.appendChild(mark)
      card.appendChild(head)
      var big = el('div', 'jg-hero-value', '')
      card.appendChild(big)
      var lines = []
      if (values.length > 1) {
        var rest = el('div', 'jg-hero-rest')
        values.slice(1).forEach(function (found) {
          var line = el('span', null, '')
          rest.appendChild(line)
          lines.push({ found: found, node: line })
        })
        card.appendChild(rest)
      }
      card.title = values[0].source
      card.addEventListener('click', function () { openPanel(values[0].deviceId) })
      /* La plus grande vignette de l'accueil, et la plus figée : « 12,4 °C »
       * dehors, la consommation du compteur, le ciel, restaient tels qu'ils
       * étaient au dessin de la page. C'est précisément l'inverse de ce qu'on
       * demande à un écran mural — et c'est ce qu'on lit à trois mètres, donc
       * la seule valeur du dashboard que personne ne vérifie jamais de près.
       *
       * L'icône est refaite à chaque passage, et non seulement les nombres :
       * la condition météo décide du ciel dessiné, et un nuage de pluie
       * au-dessus d'un soleil revenu serait un mensonge de plus, pas un de
       * moins. */
      live(card, values.map(function (found) { return found.id }), function () {
        mark.className = skyIcon(values) + ' jg-hero-mark'
        big.textContent = format(values[0].id)
        lines.forEach(function (line) {
          line.node.textContent = line.found.name + ' ' + format(line.found.id)
        })
      })
      return card
    }).filter(function (card) { return card !== null })
  }

  /* La meilleure source pour un type générique donné. Un capteur dédié passe
   * avant la sonde interne d'une prise : « 33 °C » lu dans un boîtier n'est la
   * température de personne. */
  function pickMeasure(entry) {
    var ids = Object.keys(JG.CMDS).filter(function (id) {
      /* L'équipement d'abord : une mesure venue d'une carte masquée porterait
       * son nom en légende — « Salon · Étage » sous un thermomètre dont la
       * carte n'existe nulle part, et un appui qui ouvre le détail d'un
       * équipement que l'on croyait masqué. */
      var owner = MODEL.devices[JG.OWNER[id]]
      if (owner !== undefined && owner.drawn === false) {
        return false
      }
      return JG.CMDS[id].generic === entry.generic && JG.VALUES[id] !== null &&
        JG.VALUES[id] !== undefined && JG.VALUES[id] !== ''
    })
    if (ids.length === 0) {
      return null
    }
    var preferred = ids.filter(function (id) {
      return JG.CMDS[id].domain === 'sensor' || JG.CMDS[id].domain === 'weather'
    })
    var chosen = (preferred[0] !== undefined) ? preferred[0] : ids[0]
    var owner = MODEL.devices[JG.OWNER[chosen]]
    return {
      id: chosen,
      name: entry.name,
      icon: entry.icon,
      /* Repris tel quel : skyIcon() a besoin de retrouver la condition météo
       * parmi les mesures retenues, et leurs rangs ne se correspondent plus dès
       * qu'une seule manque. */
      generic: entry.generic,
      deviceId: JG.OWNER[chosen],
      source: owner ? owner.name : ''
    }
  }

  /* L'état d'un domaine, en trois caractères quand c'est possible.
   *
   * « 1 en marche » à côté de « 18 équipements » : deux libellés de longueurs
   * si différentes que les tuiles cessent de se ressembler, et une rangée qui
   * ne se lit plus comme une rangée. Les tableaux de bord qui tiennent au mur
   * écrivent « 5/10 », « 23.3°C », « OK » — jamais une phrase.
   *
   * Un rapport allumés/total quand le domaine se pilote, une mesure quand il
   * se mesure, un compte sinon. Toujours court, toujours de la même famille. */
  function launchState(group, lit) {
    var pilotable = group.devices.filter(function (device) {
      return device.roles && device.roles.state !== undefined
    }).length
    if (pilotable > 0) {
      /* « 1/2 » est un rapport, et personne ne lit un rapport de loin : il faut
       * savoir que le premier nombre est l'allumé, deviner que le second n'est
       * pas le total du domaine mais celui de ce qui rapporte son état, et
       * faire la différence. Le dashboard sait tout cela — il n'a qu'à le
       * dire. Le vocabulaire est celui du reste de la page : les pastilles de
       * l'en-tête et les tuiles de pièces comptent déjà « en marche ». */
      return (lit > 0) ? (lit + ' {{en marche}}') : '{{Tout éteint}}'
    }
    /* Pas d'état à montrer : une mesure, mais seulement si elle caractérise le
     * domaine. La première température venue donnait « Sécurité 22,1 °C » et
     * « Énergie 58,3 °C » — la sonde interne d'un boîtier, qui n'est la
     * température de personne et ne dit rien de l'alarme. Hors des domaines
     * qui se mesurent, un compte est plus honnête qu'un chiffre décoratif. */
    var wanted = LAUNCH_MEASURES[group.key]
    if (wanted !== undefined) {
      for (var i = 0; i < group.devices.length; i++) {
        var cmd = firstGeneric(group.devices[i], wanted)
        if (cmd !== null) {
          var text = format(cmd.id)
          if (text && text !== '—' && text.length <= 10) {
            return text
          }
        }
      }
    }
    /* Et non le nombre seul. « Sécurité 2 » posé à côté de « Lumières 4 en
     * marche » laisse deviner ce que compte le 2, et deux tuiles voisines qui
     * ne disent pas la même sorte de chose se lisent deux fois. Le mot est
     * celui des tuiles de pièce, qui comptent déjà des équipements. */
    var count = group.devices.length
    return count + ' ' + ((count > 1) ? '{{équipements}}' : '{{équipement}}')
  }

  var LAUNCH_MEASURES = {
    weather: ['WEATHER_TEMPERATURE'],
    energy: ['POWER', 'CONSUMPTION', 'PRODUCTION'],
    sensor: ['TEMPERATURE', 'HUMIDITY'],
    climate: ['THERMOSTAT_TEMPERATURE']
  }

  /* Le résumé d'une pièce : ce qu'on lit d'un coup d'oeil sur sa tuile. Une
   * température vaut mieux qu'un compte d'équipements, et « 2 en marche »
   * mieux que les deux.
   *
   * La liste est nommée plutôt qu'écrite ici : summaryOf() l'affiche, et la
   * tuile s'y abonne pour se tenir à jour. Deux copies auraient fini par
   * diverger, et le symptôme aurait été une température figée sur une seule
   * sorte de pièce. */
  var ROOM_MEASURES = ['TEMPERATURE', 'THERMOSTAT_TEMPERATURE']

  function summaryOf(devices) {
    var parts = []
    var lit = devices.filter(isLit).length
    if (lit > 0) {
      parts.push(lit + ' {{en marche}}')
    }
    for (var i = 0; i < devices.length; i++) {
      var cmd = firstGeneric(devices[i], ROOM_MEASURES)
      if (cmd !== null && JG.VALUES[cmd.id] !== null && JG.VALUES[cmd.id] !== undefined && JG.VALUES[cmd.id] !== '') {
        parts.push(format(cmd.id))
        break
      }
    }
    return parts.join(' · ')
  }

  /* Ce qui ne va pas, en tête, et une seule fois — plutôt que dispersé sur
   * quatre cents cartes qu'il faudrait parcourir des yeux. */
  function buildAlertBar() {
    var found = troubles()
    var total = troubleCount(found)
    if (total === 0) {
      return
    }
    var parts = []
    if (found.mute.length > 0) { parts.push(found.mute.length + ' {{ne répondent plus}}') }
    if (found.alert.length > 0) { parts.push(found.alert.length + ' {{hors plage}}') }
    if (found.weak.length > 0) { parts.push(found.weak.length + ' {{en pile faible}}') }

    var bar = el('button', 'jg-alertbar')
    bar.type = 'button'
    var mark = el('span', 'jg-alertbar-mark')
    mark.appendChild(el('i', 'fas fa-exclamation-triangle'))
    bar.appendChild(mark)
    var text = el('div', 'jg-alertbar-text')
    text.appendChild(el('span', 'jg-alertbar-title',
      total + ' ' + ((total > 1) ? '{{points à surveiller}}' : '{{point à surveiller}}')))
    text.appendChild(el('span', 'jg-alertbar-detail', parts.join(' · ')))
    bar.appendChild(text)
    bar.appendChild(el('span', 'jg-alertbar-go', '{{Voir}}'))
    bar.addEventListener('click', function () { goTo('health', 'all') })
    sectionsNode.appendChild(bar)
  }

  /* La question numéro un d'un écran mural, et sa réponse actionnable. Les
   * tuiles de domaines répondaient par un nombre qu'il fallait aller vérifier
   * ailleurs ; ce sont ici les vraies cartes, qu'on peut éteindre sur place. */
  var RUNNING_LIMIT = 8

  function buildRunning() {
    var lit = drawnOnly(allDevices()).filter(isLit)
    if (lit.length === 0) {
      return
    }
    var node = el('section', 'jg-section')
    var title = el('h2', 'jg-section-title')
    title.appendChild(el('span', 'jg-section-name', '{{En ce moment}}'))
    title.appendChild(el('span', 'jg-section-count', String(lit.length)))

    var offable = lit.filter(function (device) {
      return device.roles && (device.roles.off !== undefined || device.roles.toggle !== undefined)
    })
    if (offable.length > 1) {
      var all = el('button', 'jg-section-action', '{{Tout éteindre}}')
      all.type = 'button'
      all.addEventListener('click', function () { turnAllOff(offable, all) })
      title.appendChild(all)
    }
    node.appendChild(title)

    /* Des bandes, et non les cartes complètes : voir makeQuick. */
    var grid = el('div', 'jg-grid jg-grid-quick')
    lit.slice(0, RUNNING_LIMIT).forEach(function (device) {
      grid.appendChild(makeQuick(device))
    })
    if (lit.length > RUNNING_LIMIT) {
      var more = el('button', 'jg-domain jg-more-tile')
      more.appendChild(el('span', 'jg-domain-name', '+ ' + (lit.length - RUNNING_LIMIT)))
      more.appendChild(el('span', 'jg-domain-count', '{{Tout voir}}'))
      more.addEventListener('click', function () { goTo('functions', 'all') })
      grid.appendChild(more)
    }
    node.appendChild(grid)
    sectionsNode.appendChild(node)
  }

  /* Éteindre une maison entière, c'est une rafale de commandes. On ne la lance
   * pas sur un appui distrait, et on ne la lance pas d'un bloc : quinze
   * exécutions simultanées font tomber certains démons de plugin. */
  function turnAllOff(devices, source) {
    if (!window.confirm('{{Éteindre }}' + devices.length + '{{ équipements ?}}')) {
      return
    }
    source.disabled = true
    devices.forEach(function (device, index) {
      setTimeout(function () {
        exec((device.roles.off !== undefined) ? device.roles.off : device.roles.toggle, null, null)
      }, index * 120)
    })
    setTimeout(function () { source.disabled = false }, devices.length * 120 + 400)
  }

  /* Depuis quand, et non depuis quelle date.
   *
   * « il y a 2 h » répond à la question qu'on se pose la main au-dessus du
   * bouton — est-ce que quelqu'un l'a déjà lancé ce soir ? — là où
   * « 2026-09-21 18:04:11 » demande de faire la soustraction soi-même. Le
   * relevé voyageait déjà dans le modèle, payé à chaque construction par une
   * lecture de cache, et lu par personne.
   *
   * Intl.RelativeTimeFormat fait le travail, pluriels et langues compris,
   * plutôt qu'une table de formes à traduire deux fois. Absent d'un navigateur
   * trop vieux, il ne rend rien : une ligne en moins vaut mieux qu'un
   * horodatage que personne ne soustrait de tête. */
  var RELATIVE

  function relative() {
    if (RELATIVE === undefined) {
      RELATIVE = (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function')
        ? new Intl.RelativeTimeFormat(MODEL.lang || undefined, { numeric: 'auto' })
        : null
    }
    return RELATIVE
  }

  function agoText(time) {
    if (!time) {
      return ''
    }
    var rtf = relative()
    if (rtf === null) {
      return ''
    }
    var seconds = Math.round((Date.now() - time) / 1000)
    /* Une horloge de tablette en avance sur celle du Jeedom rendrait « dans 4
     * secondes » pour un scénario qui vient de tourner. */
    if (seconds < 60) {
      return '{{à l\'instant}}'
    }
    if (seconds < 3600) {
      return rtf.format(-Math.round(seconds / 60), 'minute')
    }
    if (seconds < 86400) {
      return rtf.format(-Math.round(seconds / 3600), 'hour')
    }
    var days = Math.round(seconds / 86400)
    if (days <= 7) {
      return rtf.format(-days, 'day')
    }
    /* Au-delà d'une semaine, « il y a 43 jours » se compte sur les doigts sans
     * rien apprendre : une date courte se situe d'elle-même. */
    return new Date(time).toLocaleDateString(MODEL.lang || undefined, { day: 'numeric', month: 'short' })
  }

  /* La date au format que Jeedom écrit dans son cache. On la rend au modèle
   * plutôt qu'au seul bouton : sans cela, le premier redessin de l'accueil
   * rétablirait « il y a 3 j » sous un scénario lancé il y a dix secondes,
   * parce que le modèle, lui, n'aurait pas bougé. */
  function nowStamp() {
    var now = new Date()
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' +
      pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
  }

  /* Les boutons de scène du moment, par identifiant de scénario : le coeur
   * annonce un scénario qui démarre ou qui finit, et il faut retrouver la
   * bande qui le porte sans parcourir le document. */
  var SCENES = {}

  /* Le groupe et le dernier lancement sur la même ligne, séparés par le point
   * médian qui sépare déjà le sous-titre des cartes et le résumé des pièces.
   * Deux lignes sous le nom auraient fait d'un bouton une fiche. */
  function sceneSub(node, time) {
    var since = agoText(time)
    node.textContent = [node.dataset.group, since].filter(function (part) { return part }).join(' · ')
  }

  /* Les scénarios que l'utilisateur a déjà écrits. Sans eux, un dashboard
   * impose de refaire à la main, équipement par équipement, ce que Jeedom sait
   * faire d'un geste. */
  function buildScenes() {
    var scenes = MODEL.scenarios || []
    if (scenes.length === 0) {
      return
    }
    var node = el('section', 'jg-section')
    var title = el('h2', 'jg-section-title')
    title.appendChild(el('span', 'jg-section-name', '{{Scènes}}'))
    node.appendChild(title)
    var bar = el('div', 'jg-scenes')
    SCENES = {}
    scenes.forEach(function (scene) {
      var button = el('button', 'jg-scene')
      button.type = 'button'
      button.dataset.state = scene.state || 'stop'
      var mark = el('span', 'jg-scene-mark')
      mark.appendChild(el('i', scene.icon || 'fas fa-play'))
      button.appendChild(mark)
      var text = el('span', 'jg-scene-text')
      text.appendChild(el('span', 'jg-scene-name', scene.name))
      var sub = el('span', 'jg-scene-group', '')
      sub.dataset.group = scene.group || ''
      sceneSub(sub, stamp(scene.last))
      text.appendChild(sub)
      button.appendChild(text)
      button.addEventListener('click', function () { launchScene(scene, button) })
      button._jgScene = scene
      SCENES[scene.id] = button
      bar.appendChild(button)
    })
    node.appendChild(bar)
    sectionsNode.appendChild(node)
  }

  function launchScene(scene, source) {
    source.classList.add('jg-busy')
    var form = new FormData()
    form.append('action', 'scenario')
    form.append('id', scene.id)
    form.append('state', 'start')
    fetch('plugins/jeeglowbe/core/ajax/jeeglowbe.ajax.php', {
      method: 'POST', body: form, credentials: 'same-origin'
    }).then(function (response) {
      return response.json()
    }).then(function (data) {
      source.classList.remove('jg-busy')
      if (!data || data.state !== 'ok') {
        throw new Error('')
      }
      if (data.result && data.result.state) {
        scene.state = data.result.state
        source.dataset.state = data.result.state
      }
      /* « il y a 3 j » juste après avoir appuyé, c'est un bouton qui n'a pas vu
       * qu'on l'a touché : le modèle ne sera relu qu'au prochain quart d'heure,
       * et sur une tablette murale, jamais autrement. */
      scene.last = nowStamp()
      var sub = source.querySelector('.jg-scene-group')
      if (sub !== null) {
        sceneSub(sub, stamp(scene.last))
      }
    }).catch(function () {
      source.classList.remove('jg-busy')
      source.classList.add('jg-failed')
      setTimeout(function () { source.classList.remove('jg-failed') }, 2500)
      if (typeof jeedomUtils !== 'undefined' && jeedomUtils.showAlert) {
        jeedomUtils.showAlert({ message: '{{Le scénario n\'a pas pu être lancé.}}', level: 'danger' })
      }
    })
  }

  /* Un équipement « en marche » : celui dont la commande d'état dit oui. Sans
   * commande d'état, la question n'a pas de sens et la réponse est non. */
  function isLit(device) {
    var id = device.roles ? device.roles.state : undefined
    if (id === undefined) {
      return false
    }
    var cmd = JG.CMDS[id]
    if (cmd && cmd.subType === 'numeric') {
      return parseFloat(JG.VALUES[id]) > 0
    }
    return isTrue(cmd, JG.VALUES[id])
  }

  function renderView() {
    drawn = signature()
    var here = state()
    var needle = searchNode.value.trim().toLowerCase()
    forgetAll(sectionsNode)
    dropWidgets(sectionsNode)
    sectionsNode.textContent = ''
    ROOT.dataset.view = here.view

    railNode.querySelectorAll('.jg-rail-item').forEach(function (item) {
      item.classList.toggle('jg-rail-on', item.dataset.view === here.view)
    })

    /* Une recherche traverse tout : chercher « volet » depuis la vue Caméras et
     * ne rien trouver alors que le volet existe serait une fausse réponse. */
    if (needle !== '') {
      tabsNode.hidden = true
      var found = allDevices().filter(function (device) {
        return haystack(device).indexOf(needle) !== -1
      })
      emptyNode.hidden = (found.length > 0)
      sectionsNode.dataset.layout = 'grid'
      if (found.length > 0) {
        sectionsNode.appendChild(section({ key: 'search', name: '{{Résultats}}', icon: 'fas fa-search', devices: found }))
      }
      loadWidgets()
      return
    }

    if (here.view === 'home') {
      tabsNode.hidden = true
      emptyNode.hidden = true
      sectionsNode.dataset.layout = 'grid'
      buildHome()
      return
    }

    var groups = groupsFor(here.view)
    buildTabs(groups)
    var shown = (here.tab === 'all') ? groups : groups.filter(function (group) {
      return group.key === here.tab
    })
    if (shown.length === 0) {
      shown = groups
    }
    /* Plusieurs sections à l'écran : elles se rangent en colonnes, chacune
     * avec son en-tête et sa pile de cartes, comme les pages d'un tableau de
     * bord composé à la main. Une seule section — la page d'un domaine — garde
     * la grille large, parce qu'une colonne unique y laisserait l'écran vide
     * aux trois quarts. */
    var columns = shown.length > 1
    sectionsNode.dataset.layout = columns ? 'columns' : 'grid'
    shown.forEach(function (group) {
      sectionsNode.appendChild(section(group, here.view, columns ? PREVIEW_LIMIT : 0))
    })
    emptyNode.hidden = (shown.length > 0)
    loadWidgets()
  }

  /* ------------------------------------------------------- le panneau de détail
   *
   * La carte montre l'essentiel, le panneau montre tout. C'est lui qui permet à
   * une tuile de rester une tuile : sans lui, un aspirateur à douze commandes
   * produit une carte haute d'un écran, et le dashboard redevient une liste. */

  function openPanel(deviceId, quiet) {
    var device = MODEL.devices[deviceId]
    if (device === undefined) {
      return
    }
    closePanel()
    /* Retenu pour le mode édition : régler une carte se fait dans ce panneau,
     * et cela dure — or le coeur peut annoncer une mise à jour à tout moment,
     * et une relecture de modèle referme tout. Le panneau se rouvrirait alors
     * de lui-même sur l'équipement qu'on était en train de régler. */
    PANEL_ON = device.id
    panelTitle.textContent = device.name
    renameButton.hidden = !MODEL.admin
    renameButton.onclick = function () { startRename(device) }
    var detail = document.createElement('jg-card-detail')
    detail.device = device
    /* Les réglages AVANT le détail : on ouvre ce panneau en mode édition pour
     * régler, pas pour lire des valeurs. Sous un aspirateur de dix-neuf lignes
     * dont plusieurs portent un widget de plugin, un bloc en fin de panneau
     * demande de faire défiler un écran entier avant de savoir qu'il existe. */
    /* Le panneau se règle depuis n'importe quelle vue, accueil compris : on y
     * arrive par un geste explicite, et il porte son propre titre. */
    if (EDITING && MODEL.reveal) {
      panelBody.appendChild(editPanel(device))
    }
    panelBody.appendChild(detail)
    panelNode.hidden = false
    backdropNode.hidden = false
    ROOT.dataset.panel = '1'
    if (!quiet) {
      document.getElementById('jg-panel-close').focus()
    }
    loadWidgets()
  }

  function closePanel() {
    PANEL_ON = 0
    Array.prototype.forEach.call(panelBody.children, forget)
    dropCharts(panelBody)
    dropWidgets(panelBody)
    panelBody.textContent = ''
    panelNode.hidden = true
    backdropNode.hidden = true
    ROOT.dataset.panel = '0'
  }

  /* Les courbes du panneau ouvert. Le coeur garde chaque courbe qu'il trace
   * dans jeedom.history.chart, sous l'identifiant de son cadre, et ne l'en
   * retire jamais : c'est à qui la jette de la défaire. Sans cela, chaque
   * ouverture laisse derrière elle un Highstock complet, que graphUpdate()
   * continue d'alimenter à chaque valeur reçue — sur une tablette qu'on ne
   * recharge jamais. La liste vit sur JG : c'est la classe du premier passage
   * qui la remplit. */
  JG.CHARTS = JG.CHARTS || []

  function chartEntry(id) {
    if (typeof jeedom === 'undefined' || !jeedom.history || !jeedom.history.chart) {
      return undefined
    }
    return jeedom.history.chart[id]
  }

  function dropChart(box) {
    clearTimeout(box._parked)
    var entry = chartEntry(box.id)
    if (entry !== undefined) {
      if (entry.chart && typeof entry.chart.destroy === 'function') {
        try {
          entry.chart.destroy()
        } catch (error) {
          /* Déjà défaite : il ne reste que l'inscription à retirer. */
        }
      }
      delete jeedom.history.chart[box.id]
    }
    box.remove()
  }

  /* Une courbe déjà tracée se défait tout de suite. Une courbe encore en
   * route, non : le coeur la dessinera à l'arrivée de l'historique, dans un
   * cadre qu'il cherche par son identifiant, et un cadre introuvable le fait
   * échouer à mi-chemin — une inscription sans courbe, sur laquelle
   * graphUpdate() trébuche ensuite à chaque valeur. Ce cadre-là est donc mis
   * de côté, caché, le temps que la réponse arrive ; la courbe est défaite à
   * son arrivée, et le cadre jeté de toute façon au bout de deux minutes,
   * puisqu'un historique vide n'appelle jamais de retour.
   *
   * Sans argument, toutes ; avec un noeud, celles qu'il contient — le ménage
   * d'un dashboard remplacé ne doit pas défaire les courbes de son
   * successeur, qui partage la même liste. */
  function dropCharts(within) {
    var gone = JG.CHARTS.filter(function (box) {
      return within === undefined || within.contains(box)
    })
    JG.CHARTS = JG.CHARTS.filter(function (box) {
      return gone.indexOf(box) === -1
    })
    gone.forEach(function (box) {
      if (chartEntry(box.id) !== undefined || !box._asked) {
        dropChart(box)
        return
      }
      box.hidden = true
      document.body.appendChild(box)
      box._parked = setTimeout(function () { dropChart(box) }, 120000)
    })
  }

  /* Renommer dans jeeGlow, et nulle part ailleurs. Le nom d'un équipement
   * Jeedom sert aux scénarios, à l'historique et aux autres plugins : le
   * changer pour faire joli sur un dashboard casserait ce qui s'appuie dessus.
   * Le nom choisi ici vit dans la configuration du plugin. */
  function startRename(device) {
    var input = document.createElement('input')
    input.type = 'text'
    input.className = 'jg-rename'
    input.value = device.name
    input.maxLength = 60
    input.placeholder = device.realName ? device.realName : device.name
    panelTitle.replaceWith(input)
    input.focus()
    input.select()

    var done = false
    function finish(save) {
      if (done) {
        return
      }
      done = true
      var wanted = input.value.trim()
      input.replaceWith(panelTitle)
      if (!save || wanted === device.name) {
        return
      }
      var form = new FormData()
      form.append('action', 'rename')
      form.append('id', device.id)
      /* Vide : on efface l'alias et le nom de Jeedom revient. C'est la seule
       * façon de faire marche arrière sans deviner le nom d'origine. */
      form.append('name', wanted)
      fetch('plugins/jeeglowbe/core/ajax/jeeglowbe.ajax.php', {
        method: 'POST', body: form, credentials: 'same-origin'
      }).then(function (response) {
        return response.json()
      }).then(function (data) {
        if (!data || data.state !== 'ok' || !data.result) {
          return
        }
        device.name = (data.result.name !== '') ? data.result.name : data.result.realName
        device.realName = (data.result.name !== '') ? data.result.realName : ''
        panelTitle.textContent = device.name
        renderView()
      }).catch(function () {
        if (typeof jeedomUtils !== 'undefined' && jeedomUtils.showAlert) {
          jeedomUtils.showAlert({ message: '{{Le nom n\'a pas pu être enregistré.}}', level: 'danger' })
        }
      })
    }

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        finish(true)
      }
      if (event.key === 'Escape') {
        finish(false)
      }
    })
    input.addEventListener('blur', function () { finish(true) })
  }

  /* Après un rangement, le modèle entier est relu : une pièce peut apparaître
   * ou disparaître de la navigation, et recoudre tout cela à la main dans le
   * modèle en mémoire serait un nid à incohérences. */
  function setRoom(device, roomId, source) {
    source.disabled = true
    var form = new FormData()
    form.append('action', 'setRoom')
    form.append('id', device.id)
    form.append('room', roomId)
    fetch('plugins/jeeglowbe/core/ajax/jeeglowbe.ajax.php', {
      method: 'POST', body: form, credentials: 'same-origin'
    }).then(function (response) {
      return response.json()
    }).then(function (data) {
      source.disabled = false
      if (!data || data.state !== 'ok') {
        return
      }
      reloadModel(true)
    }).catch(function () {
      source.disabled = false
      if (typeof jeedomUtils !== 'undefined' && jeedomUtils.showAlert) {
        jeedomUtils.showAlert({ message: '{{La pièce n\'a pas pu être changée.}}', level: 'danger' })
      }
    })
  }

  /* Une carte retirée du document doit cesser d'être rafraîchie : sans cela,
   * chaque ouverture du panneau — et, depuis que l'accueil se redessine quand
   * un équipement bascule, chaque appui sur une lampe — laisse derrière elle
   * une carte fantôme que le temps réel continue de mettre à jour. Sur une
   * tablette qu'on ne recharge jamais, ces fantômes s'accumulent jusqu'à ce
   * que la moindre mise à jour coûte un rendu complet. */
  function forget(card) {
    ;(card._watched || []).forEach(function (cmdId) {
      var list = JG.WATCH[cmdId]
      if (list === undefined) {
        return
      }
      var index = list.indexOf(card)
      if (index !== -1) {
        list.splice(index, 1)
      }
    })
    card._watched = []
  }

  /* Le ménage d'une vue entière, juste avant qu'elle ne soit remplacée. Les
   * tuiles vivantes de l'accueil s'y ajoutent aux cartes : elles s'abonnent au
   * même registre, elles doivent s'en retirer de la même façon. */
  function forgetAll(node) {
    node.querySelectorAll('.jg-card, .jg-follows').forEach(forget)
  }

  /* ---------------------------------------------------------------- ambiance */

  /* L'ambiance imposée par la configuration, ou null quand jeeGlow doit
   * s'accorder à Jeedom. Le modèle peut arriver sans la clé — installation
   * jamais reconfigurée, page servie par une version antérieure du plugin —
   * et ce cas doit se comporter exactement comme avant que le réglage
   * existe. */
  function forcedTone() {
    return (MODEL.tone === 'light' || MODEL.tone === 'dark') ? MODEL.tone : null
  }

  /* Le thème de Jeedom n'annonce pas s'il est clair ou sombre : il pose des
   * couleurs. On lit donc la luminosité du fond et on s'y accorde, ce qui
   * marche aussi avec un thème que nous ne connaissons pas. Sauf si l'ambiance
   * est imposée : la mesure n'a alors plus rien à décider. */
  function readTone() {
    var forced = forcedTone()
    if (forced !== null) {
      return forced
    }
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

  /* Le kiosque est un état de l'appareil, pas de la session : une tablette
   * murale doit rouvrir la page comme elle l'a laissée, et un ordinateur qui
   * ouvre la même adresse ne doit pas hériter du réglage de la tablette. D'où
   * le stockage local, propre au navigateur.
   *
   * localStorage peut lever — navigation privée, cookies bloqués — et n'est
   * jamais indispensable : le paramètre d'adresse suffit. */
  function remember(key, value) {
    try {
      window.localStorage.setItem('jeeglowbe.' + key, value)
    } catch (error) {
      /* Tant pis : le mode reste actif pour cette page. */
    }
  }

  function remembered(key) {
    try {
      return window.localStorage.getItem('jeeglowbe.' + key)
    } catch (error) {
      return null
    }
  }

  function setFullscreen(on) {
    /* body.fullscreen est une règle du coeur (desktop.main.css) : header et
     * footer disparaissent. Rien à réécrire, et le jour où Jeedom change sa
     * mise en page, nous suivons sans rien faire. */
    document.body.classList.toggle('fullscreen', on)
    ROOT.dataset.kiosk = on ? '1' : '0'
    remember('kiosk', on ? '1' : '0')
    syncKioskButton()
    watchIdle()
    syncDim()
    syncWakeLock()
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

  /* ------------------------------------------------------------- veille kiosque
   *
   * Deux services rendus à une tablette murale, et à elle seule : revenir à
   * l'accueil quand plus personne ne la regarde, et s'assombrir la nuit. Les
   * deux sont sans objet sur un ordinateur, où l'on ferme la page. */

  var idleTimer = null

  function kioskOn() {
    return ROOT.dataset.kiosk === '1'
  }

  function watchIdle() {
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    var minutes = (MODEL.kiosk && MODEL.kiosk.idle) ? MODEL.kiosk.idle : 0
    if (!kioskOn() || minutes <= 0) {
      return
    }
    idleTimer = setTimeout(function () {
      idleTimer = null
      /* Tout ce qu'on a laissé ouvert se referme, panneau et recherche
       * compris. Le délai court depuis le dernier geste : un panneau resté
       * ouvert tout ce temps n'est plus lu par personne. L'épargner le
       * gardait ouvert pour toujours, et une recherche oubliée recouvrait
       * l'accueil sans fin — or modelChanged() s'abstient tant que l'un ou
       * l'autre est là : la tablette ne relisait plus jamais son modèle. */
      closePanel()
      clearTimeout(searchTimer)
      searchTimer = null
      searchNode.value = ''
      if (document.activeElement === searchNode) {
        searchNode.blur()
      }
      goTo('home', 'all')
    }, minutes * 60000)
  }

  function minutesOf(text) {
    var parts = /^(\d{1,2})[:h](\d{2})$/.exec(String(text || '').trim())
    if (parts === null) {
      return null
    }
    return parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10)
  }

  /* Nuit : après l'heure de fin de journée ou avant celle du matin. L'intervalle
   * traverse minuit, d'où la comparaison en deux morceaux. */
  function isNight() {
    var night = minutesOf(MODEL.kiosk && MODEL.kiosk.night)
    var day = minutesOf(MODEL.kiosk && MODEL.kiosk.day)
    if (night === null || day === null) {
      return false
    }
    var now = new Date()
    var minutes = now.getHours() * 60 + now.getMinutes()
    return (night > day) ? (minutes >= night || minutes < day) : (minutes >= night && minutes < day)
  }

  /* Mise à jour minute par minute, et seulement si l'horloge est à l'écran :
   * elle n'existe que sur l'accueil. */
  function syncClock() {
    var time = ROOT.querySelector('.jg-clock-time')
    if (time === null) {
      return
    }
    var now = new Date()
    time.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes())
    var date = ROOT.querySelector('.jg-clock-date')
    if (date !== null) {
      date.textContent = now.toLocaleDateString(MODEL.lang || undefined, {
        weekday: 'long', day: 'numeric', month: 'long'
      })
    }
  }

  /* L'écran qui reste allumé, demandé au navigateur et non à Jeedom.
   *
   * L'API n'existe qu'en contexte sécurisé : sur un Jeedom ouvert en clair par
   * son adresse IP, elle est absente, et la tablette s'éteindra comme avant.
   * On ne fait alors rien plutôt que d'échouer bruyamment — mais la
   * documentation le dit, pour que la déception ait une explication. */
  var wakeLock = null

  function syncWakeLock() {
    if (typeof navigator === 'undefined' || !navigator.wakeLock) {
      return
    }
    if (kioskOn() && !document.hidden) {
      if (wakeLock !== null) {
        return
      }
      navigator.wakeLock.request('screen').then(function (lock) {
        wakeLock = lock
        /* Le navigateur relâche de lui-même quand l'onglet passe en arrière
         * plan : sans cette remise à zéro, on croirait le verrou encore tenu. */
        lock.addEventListener('release', function () { wakeLock = null })
      }).catch(function () {
        wakeLock = null
      })
      return
    }
    if (wakeLock !== null) {
      var held = wakeLock
      wakeLock = null
      held.release().catch(function () {})
    }
  }

  function syncDim() {
    var dim = (MODEL.kiosk && MODEL.kiosk.dim) ? MODEL.kiosk.dim : 0
    var active = kioskOn() && dim > 0 && isNight()
    ROOT.style.setProperty('--jg-dim', active ? (dim / 100) : 0)
    ROOT.dataset.dim = active ? '1' : '0'
  }

  /* ----------------------------------------------------------- les widgets */

  /* Les rendus écrits par les plugins, demandés en un seul appel une fois la
   * page dessinée. Le coeur sait les produire : core/ajax/cmd.ajax.php, action
   * toHtml, accepte une liste d'identifiants — dix-neuf widgets en une requête
   * plutôt que dix-neuf. */
  JG.WIDGETS = JG.WIDGETS || {}
  /* La dernière annonce reçue pour chaque commande, entière : un widget ne se
   * contente pas de la valeur, il lit aussi display_value, l'unité, les dates
   * et le niveau d'alerte. */
  JG.EVENTS = JG.EVENTS || {}

  function loadWidgets() {
    var holders = Array.prototype.slice.call(ROOT.querySelectorAll('.jg-widget[data-pending="1"]'))
    if (holders.length === 0) {
      return
    }
    var ids = {}
    holders.forEach(function (holder) {
      holder.removeAttribute('data-pending')
      /* Déjà reçu : changer de vue ne doit pas redemander au serveur les trois
       * cents kilo-octets qu'on a en mémoire. */
      if (JG.WIDGETS[holder.dataset.cmdId]) {
        insertWidget(holder, JG.WIDGETS[holder.dataset.cmdId])
        return
      }
      ids[holder.dataset.cmdId] = { version: 'dashboard' }
    })
    if (Object.keys(ids).length === 0) {
      return
    }
    var form = new FormData()
    form.append('action', 'toHtml')
    form.append('ids', JSON.stringify(ids))
    fetch('core/ajax/cmd.ajax.php', { method: 'POST', body: form, credentials: 'same-origin' })
      .then(function (response) {
        return response.json()
      }).then(function (data) {
        if (!data || data.state !== 'ok' || !data.result) {
          return
        }
        Object.keys(data.result).forEach(function (id) {
          if (!data.result[id] || !data.result[id].html) {
            return
          }
          JG.WIDGETS[id] = data.result[id].html
          /* Tous les porteurs, et non le premier : une commande peut être à la
           * fois sur une carte et dans le panneau ouvert par-dessus, et le
           * second gardait sa ligne de repli pour toujours. */
          ROOT.querySelectorAll('.jg-widget[data-cmd-id="' + id + '"]').forEach(function (holder) {
            insertWidget(holder, data.result[id].html)
          })
        })
      }).catch(function () {
        /* Pas de widget : les lignes de repli sont déjà à l'écran. */
      })
  }

  /* Le HTML vient du coeur, comme celui du dashboard d'origine — même origine,
   * même confiance. Ses scripts, eux, demandent un détour : ceux qu'innerHTML
   * dépose ne s'exécutent jamais, et un widget de plugin est presque
   * entièrement dans son script. Il faut donc les recréer. */
  function insertWidget(holder, html) {
    /* Le rendu en cache porte l'uid tiré par le coeur (cmd.class.php, #uid#),
     * et le script du modèle retrouve son widget par lui :
     * document.querySelector('.cmd[data-cmd_uid=…]'). Deux copies du même
     * HTML — la carte et le panneau — partageaient donc cet uid, et chaque
     * script tombait sur la première : bouton du panneau inerte, double
     * écouteur et double exécution sur la carte, panneau jamais mis à jour.
     * Chaque insertion reçoit le sien, dans toutes ses occurrences, scripts
     * compris. Du même coup, les fonctions de mise à jour ne se ressemblent
     * plus : addUpdateFunction() écarte celles dont le texte est identique,
     * et ne gardait qu'une copie vivante sur deux. */
    unhook(holder)
    var found = /data-cmd_uid=["']?([^"'\s>]+)/.exec(html)
    if (found !== null) {
      JG.UID_SEQ = (JG.UID_SEQ || 0) + 1
      var uid = 'cmd' + holder.dataset.cmdId + '__jg' + JG.UID_SEQ + '__'
      html = html.split(found[1]).join(uid)
      holder.dataset.uid = uid
    }
    holder.innerHTML = html
    holder.querySelectorAll('script').forEach(function (previous) {
      var script = document.createElement('script')
      Array.prototype.forEach.call(previous.attributes, function (attribute) {
        script.setAttribute(attribute.name, attribute.value)
      })
      script.textContent = previous.textContent
      previous.parentNode.replaceChild(script, previous)
    })
    holder.classList.add('jg-widget-ready')
    /* Le script vient d'appeler refreshValue() avec la valeur figée dans le
     * HTML au moment où on l'a demandé — et refreshValue() la pousse à toutes
     * les copies inscrites, pas seulement à la nouvelle. La dernière annonce
     * connue remet tout le monde à l'heure. */
    var last = JG.EVENTS[holder.dataset.cmdId]
    if (last !== undefined && typeof jeedom !== 'undefined' && jeedom.cmd && jeedom.cmd.refreshValue) {
      try {
        jeedom.cmd.refreshValue([last])
      } catch (error) {
        /* Un widget qui ne sait pas se relire garde la valeur de son HTML. */
      }
    }
  }

  /* Retire du coeur les fonctions de mise à jour d'un widget qu'on jette.
   * Elles restent inoffensives — leur querySelector ne trouve plus rien —
   * mais chaque insertion en ajoute une, et une tablette qu'on ne recharge
   * jamais les accumulerait par milliers. On les reconnaît à l'uid qu'on
   * leur a donné, écrit en toutes lettres dans leur texte. */
  function unhook(holder) {
    var uid = holder.dataset.uid
    if (!uid || typeof jeedom === 'undefined' || !jeedom.cmd || !jeedom.cmd.update) {
      return
    }
    delete holder.dataset.uid
    var id = holder.dataset.cmdId
    var list = jeedom.cmd.update[id]
    if (typeof list === 'function') {
      if (String(list).indexOf(uid) !== -1) {
        delete jeedom.cmd.update[id]
      }
    } else if (Array.isArray(list)) {
      jeedom.cmd.update[id] = list.filter(function (update) {
        return String(update).indexOf(uid) === -1
      })
    }
  }

  function dropWidgets(node) {
    node.querySelectorAll('.jg-widget[data-uid]').forEach(unhook)
  }

  /* ------------------------------------------------------------- rafraîchir */

  /* Le modèle est rendu avec la page. Un équipement ajouté, renommé ou rangé
   * dans une autre pièce n'apparaîtrait donc qu'au rechargement — or une
   * tablette murale n'est jamais rechargée. On relit le modèle quand la page
   * redevient visible, et seulement si elle a dormi : personne n'est interrompu
   * en train de la regarder. */
  var REFRESH_AFTER = 300000
  /* Le délai minimal entre deux relectures déclenchées par le coeur. Une
   * minute : assez pour qu'une rafale — un plugin qui enregistre ses vingt
   * équipements à la suite — ne produise qu'une relecture, assez court pour
   * qu'un équipement qui tombe se voie pendant qu'on est encore devant. */
  var MODEL_QUIET = 60000
  /* L'âge au-delà duquel le modèle est relu même si personne n'a rien
   * annoncé. */
  var MODEL_MAX_AGE = 900000
  var loadedAt = Date.now()

  function render(model) {
    /* Relevé AVANT que closePanel() ne l'efface. */
    var staying = PANEL_ON
    MODEL = model
    JG.MODEL = model
    indexModel()
    /* Les widgets insérés au tour précédent se sont inscrits auprès de
     * jeedom.cmd ; leurs fonctions survivraient à la reconstruction et
     * s'empileraient à chaque relecture du modèle. */
    if (typeof jeedom !== 'undefined' && jeedom.cmd && jeedom.cmd.resetUpdateFunction) {
      jeedom.cmd.resetUpdateFunction()
    }
    closePanel()
    /* L'ambiance fait partie du modèle depuis qu'elle est réglable : une
     * tablette laissée ouverte qui relit son modèle après un changement de
     * réglage garderait sinon l'ancienne jusqu'au prochain passage par le menu
     * de Jeedom — c'est-à-dire indéfiniment, puisqu'on n'y touche jamais. */
    syncTone()
    syncEdit()
    buildRail()
    renderView()
    /* Le panneau se rouvre sur l'équipement qu'on était en train de régler.
     * Après la réouverture seulement : openPanel() lit le modèle fraîchement
     * indexé, et l'équipement peut avoir changé de forme — voire avoir disparu,
     * si on vient de quitter le mode édition. */
    /* En mode édition, un panneau ouvert se rouvre : après un réglage, comme
     * après une annonce du coeur reçue pendant qu'on règle. Hors mode édition,
     * il se referme comme avant — on ne le garde pas ouvert des heures.
     *
     * « quiet » : la réouverture ne reprend pas le focus. Sans cela, régler
     * douze éléments au clavier demande douze fois de retraverser la liste
     * depuis le bouton de fermeture. */
    if (EDITING && MODEL.reveal && staying !== 0 && MODEL.devices[staying] !== undefined) {
      openPanel(staying, true)
    }
  }

  function refreshModel() {
    reloadModel(false)
  }

  /* Le numéro de la dernière demande de modèle.
   *
   * Deux réglages rapprochés lancent deux relectures, et rien ne garantit
   * qu'elles reviennent dans l'ordre : si la première revient en dernier, la
   * page se redessine dans l'état d'AVANT le second réglage. La dérogation est
   * pourtant bien enregistrée — l'écran dit le contraire de la base, et le
   * premier réflexe est de recliquer. Une réponse dépassée est donc jetée. */
  var modelTicket = 0

  function reloadModel(force, onFail) {
    if (!document.body.contains(ROOT)) {
      return
    }
    if (!force && (document.hidden || Date.now() - loadedAt < REFRESH_AFTER)) {
      return
    }
    var ticket = ++modelTicket
    var form = new FormData()
    form.append('action', 'model')
    /* Le mode édition ne tient pas dans la page : chaque relecture doit le
     * redemander, sans quoi le premier rafraîchissement automatique ramènerait
     * un modèle ordinaire et ferait disparaître ce qu'on était en train de
     * régler. */
    form.append('reveal', EDITING ? 1 : 0)
    fetch('plugins/jeeglowbe/core/ajax/jeeglowbe.ajax.php', {
      method: 'POST', body: form, credentials: 'same-origin'
    }).then(function (response) {
      return response.json()
    }).then(function (data) {
      if (ticket !== modelTicket) {
        return
      }
      if (!data || data.state !== 'ok' || !data.result) {
        if (onFail) {
          onFail()
        }
        return
      }
      loadedAt = Date.now()
      render(data.result)
    }).catch(function () {
      /* Réseau coupé, session expirée : on garde à l'écran ce qu'on avait
       * plutôt que de vider le dashboard. Mais celui qui ATTENDAIT ce modèle
       * — l'entrée en mode édition — doit l'apprendre, sans quoi la page
       * garde une intention que rien n'applique. */
      if (ticket === modelTicket && onFail) {
        onFail()
      }
    })
  }

  /*
   * Ce que cmd::update ne dit pas.
   *
   * Tout ce qui n'est pas une valeur de commande vit dans le modèle, et le
   * modèle ne se relisait que sur visibilitychange. Or une tablette murale en
   * kiosque ne change jamais d'onglet : l'événement ne se produit pas, et le
   * modèle affiché reste celui du chargement de la page — indéfiniment,
   * puisque cette tablette n'est jamais rechargée non plus. Un équipement qui
   * tombe injoignable n'apparaissait donc jamais dans la vue Santé, la
   * pastille du rail restait celle du matin, et un équipement ajouté ou rangé
   * dans une pièce n'apparaissait pas.
   *
   * Le signal existe pourtant, à côté de celui qu'on écoute déjà :
   * jeedom.changes() diffuse « eqLogic::update » sur document.body, par le
   * même chemin que « cmd::update » (core/js/jeedom.class.js, ligne 75). Le
   * coeur l'émet depuis eqLogic::refreshWidget() (eqLogic.class.php, ligne
   * 1231), que setStatus() appelle dès qu'une clé d'alerte change — timeout,
   * batterie, warning, danger (ligne 2064) — et que save() appelle après un
   * renommage ou un changement d'objet. C'est exactement ce dont le modèle a
   * besoin, et il ne coûte rien : le transport tourne déjà.
   *
   * Reste à ne pas relire à chaque annonce. Une relecture coûte un modèle
   * entier côté serveur, et l'ordre de grandeur est celui d'une par minute.
   */
  var modelTimer = null

  function modelChanged() {
    if (modelTimer !== null) {
      return
    }
    /* Le banc d'essai raccourcit ce délai : il ne peut pas attendre une
     * minute, comme il ne peut pas attendre les cinq minutes de la veille
     * kiosque. C'est le seul réglage qu'il touche ici, et JG est déjà l'objet
     * par lequel ce fichier expose ce qui doit survivre à sa ré-exécution. */
    var quiet = (typeof JG.QUIET === 'number') ? JG.QUIET : MODEL_QUIET
    var wait = Math.max(quiet - (Date.now() - loadedAt), Math.min(1000, quiet))
    modelTimer = setTimeout(function () {
      modelTimer = null
      /* Pas sous les doigts de quelqu'un. render() ferme le panneau de détail
       * et rebâtit les sections : le faire pendant qu'on lit une fiche ou
       * qu'on tape une recherche retirerait l'écran à celui qui s'en sert. Ce
       * n'est que partie remise, la prochaine annonce reviendra — et à défaut
       * la relecture de fond s'en chargera. */
      if (ROOT.dataset.panel === '1' || searchNode.value.trim() !== '') {
        return
      }
      reloadModel(true)
    }, wait)
  }

  function onEqLogicUpdate() {
    if (!document.body.contains(ROOT) || document.hidden) {
      return
    }
    modelChanged()
  }

  /* ------------------------------------------------------------------ démarrage */

  brandNode.textContent = MODEL.title ? MODEL.title : 'jeeGlow'

  /* Le modèle s'arrête à un plafond d'équipements. Le taire donnerait un
   * dashboard incomplet sans que personne ne sache pourquoi. */
  if (MODEL.truncated) {
    var warning = el('div', 'jg-warning')
    warning.appendChild(el('i', 'fas fa-exclamation-triangle'))
    warning.appendChild(el('span', null, '{{Trop d\'équipements pour un seul dashboard : la liste est tronquée.}}'))
    sectionsNode.parentNode.insertBefore(warning, sectionsNode)
  }

  ;['click', 'keydown', 'change'].forEach(function (name) {
    sectionsNode.addEventListener(name, editIntercept, true)
  })

  indexModel()
  syncEdit()
  buildRail()
  renderView()
  syncTone()

  /* La recherche attend la fin du mot.
   *
   * Sans ce délai, chaque frappe reconstruisait l'écran entier : mesuré dans
   * le banc d'essai sur l'installation d'essai — soixante-quatre équipements —
   * taper « salon » depuis la vue Fonctions créait 2 365 noeuds, dont 711
   * seulement, ceux du dernier rendu, comptent. Quatre écrans jetés à la
   * poubelle, et six fois plus sur une installation de quatre cents
   * équipements : c'est exactement ce qui donne à une dalle de tablette
   * l'allure d'un clavier qui colle.
   *
   * 150 ms : au-dessous, une frappe ordinaire déclenche encore un rendu par
   * lettre ; au-dessus, le retard commence à se voir. */
  var searchTimer = null

  function onSearch() {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(function () {
      searchTimer = null
      renderView()
    }, 150)
  }

  /* Entrée, la croix de vidage du champ, ou la sortie du champ : celui qui a
   * fini de taper ne doit pas attendre les 150 ms de plus. Le champ est un
   * type="search", et le navigateur émet « search » sur les deux premiers. */
  function flushSearch() {
    clearTimeout(searchTimer)
    searchTimer = null
    renderView()
  }

  searchNode.addEventListener('input', onSearch)
  searchNode.addEventListener('search', flushSearch)
  searchNode.addEventListener('change', flushSearch)
  window.addEventListener('hashchange', onHashChange)
  backdropNode.addEventListener('click', closePanel)
  document.getElementById('jg-panel-close').addEventListener('click', closePanel)
  document.addEventListener('keydown', onEscape)
  document.addEventListener('visibilitychange', refreshModel)
  document.addEventListener('visibilitychange', onVisible)
  /* Toute marque d'attention repousse le retour à l'accueil. */
  ;['pointerdown', 'keydown', 'wheel'].forEach(function (name) {
    ROOT.addEventListener(name, watchIdle, { passive: true })
  })
  /* L'atténuation se décide à la minute, pas au chargement : une tablette
   * allumée à 19 h doit s'assombrir à 20 h sans qu'on y touche. */
  var dimTimer = setInterval(function () {
    syncDim()
    syncClock()
    /* Et l'ambiance, relue plutôt qu'attendue.
     *
     * Le basculement jour/nuit de Jeedom est purement côté navigateur :
     * jeedomUtils.changeJeedomThemeAuto() échange la feuille de style toutes
     * les minutes, puis appelle triggerThemechange(), qui n'émet son événement
     * que si document.body porte un data-page figurant dans une liste blanche
     * où nous ne sommes pas (desktop/common/js/utils.js:516). Les deux
     * événements que nous écoutons, eux, ne viennent que du bus serveur : un
     * administrateur qui change les heures, ou une action de scénario.
     *
     * Conséquence, sans cette ligne : à 20 h, Jeedom passe en sombre tout
     * autour du dashboard et jeeGlow reste blanc, indéfiniment. Un
     * rechargement corrigeait — mais une tablette murale n'est jamais
     * rechargée, et c'est précisément elle que ce plugin vise. Un
     * getComputedStyle par minute règle la question sans rien attendre de
     * personne. */
    syncTone()
    /* Et le modèle, à défaut d'annonce.
     *
     * eqLogic::update couvre ce que le coeur signale, mais tout ne passe pas
     * par lui : un plugin qui crée ses équipements sans appeler
     * refreshWidget() n'émet rien, et une tablette murale ne changera jamais
     * d'onglet pour déclencher la relecture. Un quart d'heure est le prix
     * d'un modèle par quart d'heure et par tablette — soit moins qu'une
     * seconde de la rafale de valeurs que la même page reçoit déjà. */
    if (Date.now() - loadedAt >= MODEL_MAX_AGE) {
      modelChanged()
    }
  }, 60000)
  /* Revenir sur l'onglet redemande le verrou : le navigateur l'a rendu en
   * partant. */
  document.addEventListener('visibilitychange', syncWakeLock)
  document.getElementById('jg-fullscreen').addEventListener('click', function () {
    setFullscreen(!document.body.classList.contains('fullscreen'))
  })
  /* Trois sources, dans cet ordre : l'adresse pour un favori ou une page de
   * démarrage, puis le choix fait sur cet appareil — y compris le refus, qui
   * doit tenir — puis le réglage de l'installation. */
  var choix = remembered('kiosk')
  if (urlVar('fullscreen') === '1') {
    setFullscreen(true)
  } else if (choix === '1') {
    setFullscreen(true)
  } else if (choix === null && MODEL.kiosk && MODEL.kiosk.start) {
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
    document.body.removeEventListener('eqLogic::update', onEqLogicUpdate)
    document.body.removeEventListener('scenario::update', onScenarioUpdate)
    document.body.removeEventListener('changeTheme', onThemeChange)
    document.body.removeEventListener('checkThemechange', onThemeChange)
    document.body.removeEventListener('changeThemeEvent', onThemeChange)
    document.removeEventListener('keydown', onEscape)
    document.removeEventListener('visibilitychange', refreshModel)
    document.removeEventListener('visibilitychange', onVisible)
    document.removeEventListener('visibilitychange', syncWakeLock)
    if (wakeLock !== null) {
      var held = wakeLock
      wakeLock = null
      held.release().catch(function () {})
    }
    window.removeEventListener('hashchange', onHashChange)
    /* Seul le dashboard encore en place rend son menu à Jeedom. Si un autre
     * l'a remplacé, c'est lui qui décide. */
    if (JG.LIVE === ROOT) {
      document.body.classList.remove('fullscreen')
      JG.LIVE = null
    }
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    if (homeTimer !== null) {
      clearTimeout(homeTimer)
      homeTimer = null
    }
    if (modelTimer !== null) {
      clearTimeout(modelTimer)
      modelTimer = null
    }
    clearTimeout(searchTimer)
    searchTimer = null
    pending = []
    dropCharts(ROOT)
    dropWidgets(ROOT)
    clearInterval(dimTimer)
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
    /* Tout l'arbre, et non les seuls enfants du conteneur : selon la page
     * quittée, le dashboard est retiré à des profondeurs différentes, et un
     * observateur posé trop haut ne voit jamais partir ce qui est imbriqué. Le
     * rappel se réduit à un contains(), joué une fois par lot de mutations. */
    observer.observe(document.body, { childList: true, subtree: true })
  }

  /* Ce qui a bougé pendant que l'écran dormait.
   *
   * jeedom.changes() diffuse à tous les clients, quelle que soit la vue
   * affichée : une tablette murale reçoit les cent mises à jour par seconde
   * d'une installation active, même écran éteint, même onglet en arrière-plan.
   * Repeindre alors est du travail pur perdu, et c'est précisément ce qui fait
   * ramer les dalles bon marché. Les valeurs, elles, continuent d'être tenues
   * à jour : seul le dessin attend le réveil. */
  var pending = []

  function flushPending() {
    var waiting = pending
    pending = []
    waiting.forEach(function (card) {
      if (document.body.contains(card)) {
        card.sync()
      }
    })
  }

  function onVisible() {
    if (document.hidden) {
      return
    }
    flushPending()
    if (state().view === 'home') {
      refreshHome()
    }
  }

  /* L'accueil montre la liste de ce qui est allumé : elle change de contenu, et
   * pas seulement de valeur, quand un équipement bascule. Le redessin est
   * différé d'un souffle pour qu'une rafale — un « tout éteindre » — ne le
   * relance pas quinze fois. */
  var homeTimer = null

  function refreshHome() {
    if (homeTimer !== null) {
      return
    }
    homeTimer = setTimeout(function () {
      homeTimer = null
      if (state().view === 'home' && searchNode.value.trim() === '') {
        renderView()
      }
    }, 400)
  }

  function onCmdUpdate(event) {
    /* Filet de sécurité si l'observateur n'a pas vu le remplacement. */
    if (!document.body.contains(ROOT)) {
      teardown()
      return
    }
    var updates = Array.isArray(event.detail) ? event.detail : [event.detail]
    var touched = []
    var states = false
    updates.forEach(function (update) {
      var id = parseInt(update.cmd_id, 10)
      if (JG.CMDS[id] === undefined) {
        return
      }
      JG.VALUES[id] = update.value
      JG.EVENTS[id] = update
      if (JG.STATES[id]) {
        states = true
      }
      ;(JG.WATCH[id] || []).forEach(function (card) {
        if (touched.indexOf(card) === -1) {
          touched.push(card)
        }
      })
    })
    if (document.hidden) {
      touched.forEach(function (card) {
        if (pending.indexOf(card) === -1) {
          pending.push(card)
        }
      })
      return
    }
    touched.forEach(function (card) { card.sync() })
    if (states) {
      /* L'accueil se redessine — ce qui est en marche y est une section
       * entière. Les autres vues restent en place et n'ont qu'un élément à
       * relire : le bouton de rangée, qui n'est pas une carte et que personne
       * ne synchronise pour lui. */
      if (state().view === 'home') {
        refreshHome()
      } else {
        syncOffActions()
      }
    }
  }

  /* Un scénario qui part d'ailleurs.
   *
   * L'état et le dernier lancement d'une scène venaient du modèle, et rien que
   * du modèle : un scénario déclenché par un autre écran, par un capteur ou
   * par sa programmation ne se voyait donc pas ici avant la relecture du quart
   * d'heure. Sur un mur, « Bonne nuit » restait « il y a 2 h » alors qu'elle
   * venait de tourner, et le sablier d'un scénario en cours n'apparaissait
   * jamais.
   *
   * Le coeur l'annonce pourtant, sur le même transport que les valeurs :
   * scenario::update est diffusé sur document.body avec l'état et le dernier
   * lancement (core/js/jeedom.class.js, ligne 84 ; scenario.class.php, ligne
   * 1110). Un scénario par événement, et non un tableau — ce nom-là n'est pas
   * groupé comme cmd::update.
   *
   * Le modèle est corrigé en plus du bouton : le prochain redessin de
   * l'accueil relit le modèle, et lui seul. Le mettre à jour, c'est faire en
   * sorte que ce qui vient d'être appris survive au redessin. */
  function onScenarioUpdate(event) {
    var detail = event.detail
    if (!detail || detail.scenario_id === undefined) {
      return
    }
    var id = parseInt(detail.scenario_id, 10)
    var button = SCENES[id]
    /* Le coeur annonce tous les scénarios, y compris ceux que cet utilisateur
     * n'a pas le droit de lancer et que le modèle n'a donc jamais reçus. */
    if (button === undefined || button._jgScene === undefined) {
      return
    }
    var scene = button._jgScene
    if (detail.state !== undefined) {
      scene.state = detail.state
      button.dataset.state = detail.state
    }
    if (detail.lastLaunch !== undefined && detail.lastLaunch !== '') {
      scene.last = detail.lastLaunch
    }
    var sub = button.querySelector('.jg-scene-group')
    if (sub !== null) {
      sceneSub(sub, stamp(scene.last))
    }
  }

  /* Nommé, et non anonyme : posé sur document, un écouteur anonyme ne peut plus
   * être retiré, et il retient en vie toute la fermeture de son chargement —
   * ROOT détaché, le modèle, les index. Sur une tablette qui n'est jamais
   * rechargée, il s'en accumulait un par aller-retour dans le menu. */
  function onEscape(event) {
    if (event.key === 'Escape' && ROOT.dataset.panel === '1') {
      closePanel()
    }
  }

  function onThemeChange() {
    /* Une ambiance imposée ne se renégocie pas : le passage automatique de
     * Jeedom au thème de jour ramenait sinon au clair, vingt minutes après,
     * la tablette à qui l'on avait demandé le sombre. */
    if (forcedTone() !== null) {
      return
    }
    /* Le coeur bascule la feuille de style de façon asynchrone : relire les
     * variables tout de suite renverrait encore l'ancien thème. */
    setTimeout(syncTone, 300)
  }

  document.body.addEventListener('cmd::update', onCmdUpdate)
  document.body.addEventListener('eqLogic::update', onEqLogicUpdate)
  document.body.addEventListener('scenario::update', onScenarioUpdate)
  document.body.addEventListener('changeTheme', onThemeChange)
  document.body.addEventListener('checkThemechange', onThemeChange)
  /* Le nom réellement émis par triggerThemechange() quand la page est dans sa
   * liste blanche. Nous n'y sommes pas aujourd'hui, mais l'écouter coûte une
   * ligne et rend la réaction immédiate le jour où le coeur nous y ajoute. */
  document.body.addEventListener('changeThemeEvent', onThemeChange)
})()
