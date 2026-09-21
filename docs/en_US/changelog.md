# Changelog

## 0.2

The home view, the navigation and the cards rebuilt, and a dashboard whose
contents you can now set.

- Home becomes the landing view. It is the one built for a glance, and it was
  the only one you never saw without a click.
- New **Health** view: devices that stopped answering, readings out of range,
  low batteries and devices silent for two days, gathered in one place. The rail
  carries a badge with their count.
- Home shows what is actually running, as real cards you can switch off on the
  spot, with a "Turn everything off" button that asks for confirmation.
- Reading badges name where their number comes from and lead to the device: a
  number with no attribution is not information.
- Rooms take the icon and the colour chosen in Jeedom, and sum up what is going
  on inside them. Domains become a row of shortcuts.
- The scenarios you are allowed to run appear as scenes.
- jeeGlow can now **hide what it shows**, without changing anything in the
  original dashboard: an item inside a card, a whole card, a whole plugin or a
  whole room. A settings button in the top bar, reserved for administrators,
  takes those decisions on the dashboard itself.
- Three states rather than a checkbox: "Same as Jeedom", "Always shown" and
  "Hidden". Restoring clears the decision instead of recording another one, and
  what is restored follows Jeedom again, including if the visibility changes
  there later.
- A plugin's own widget can be refused command by command, without hiding the
  command: jeeGlow then draws it its own way. A vacuum cleaner whose every
  command carries a rendering meant for the original dashboard becomes a card
  like any other.
- The sorting happens on the server: what is hidden no longer reaches the page,
  no longer counts towards the four hundred device limit, and is no longer
  flagged in the Health view.
- The plugin configuration counts the decisions in force and offers "Restore
  everything": a setting you cannot come back from is a setting nobody dares
  try.
- Three new cards, derived from the core's generic types like the others:
  camera, climate and media. They used to fall back to the generic card, which
  reduced a camera to three binary lines.
- On a card that drives something, the whole card toggles and only the icon
  badge opens the detail. It used to be the other way round, leaving the toggle
  with half the target.
- A round badge when you can act, a square one when you can only read.
- A card's subtitle names its room, outside the Rooms view.
- Header flags: low battery, and "not answering".
- The on state is no longer a saturated fill but a tinted surface: the subtitle
  of a lit card failed the 4.5:1 contrast ratio on all seven categories, and the
  focus ring all but vanished there. Saturation now concentrates on the icon
  badge and an edge stripe.
- A solid red fill is from now on reserved for alarms — smoke, leak, tampering,
  a triggered alarm. A camera detecting motion turns red rather than amber: it
  is asking to be looked at, it is not "on".
- Kiosk is no longer a mode but a reading distance: a single factor scales the
  whole type and every touch target.
- Every value that changes and every state change is signalled, and a failed
  command shows on the card at fault rather than only in Jeedom's notification
  bar.
- Animations step aside when the system asks for reduced motion.
- The dashboard stops redrawing while the tab is in the background: values are
  still tracked, the drawing waits for the tab to come back. Jeedom broadcasts
  its changes to every client whatever the view, and that is what makes cheap
  tablets stutter.
- Search also covers the room name.
- Each control on a card takes a full-width row of its own.
- Every scene states how long ago it last ran: "2 hr. ago", "yesterday", a date
  beyond a week. The reading travelled in the model since the first version and
  was displayed nowhere. It turns to "just now" on the tap, without waiting for
  the model to be read again.
- "Turn everything off" now heads the page of a domain and that of a room. It
  existed only on "Right now" — yet stepping into "Lights" or "Living room" is
  exactly when you want to cut everything in one gesture. Not on the overview,
  where rows are clipped, nor in the Health view, where a low battery does not
  switch off; and it removes itself as soon as a single thing is left running.
- The "Outside" card's icon follows the actual weather. It was a veiled sun by
  construction whatever the condition — and the condition was already read, and
  written out in full at the bottom of that same card. A clear sky turns into a
  moon at night, and an unrecognised condition keeps the original icon.
- **The whole Home view now follows real time.** The "Outside" and "Inside"
  cards, a domain tile's reading, a room tile's temperature are not cards: they
  had no subscription and stayed at the value the page was drawn with. On a wall
  tablet, never reloaded and never switching tabs, the screen showed the house
  as it was hours ago — which takes away just about everything a connected
  dashboard is for.
- Scenes follow the announcement the core already makes: a scenario started from
  another screen, by a sensor or by its own schedule shows its hourglass here,
  and its line goes back to "just now". What is learned that way is written into
  the model and not onto the button alone, or the first redraw would lose it.
- Documentation: a room's address is `#view=rooms&tab=5`, not `#room=5`, and a
  card shows three pieces of information and four commands, not six and eight.

## 0.1

First release.

- Alternative dashboard, leaving the original dashboard untouched.
- Cards derived from generic types: light, shutter, socket, sensor, plus a
  generic fallback card for everything else.
- Real time value updates.
- Room filter, search, full screen mode for wall tablets.
- Rail and sub-tab navigation: Home, Functions, Rooms, System.
- Arrangement by domain rather than by room, and a per-device detail panel.
- Custom device names, without touching Jeedom.
- History charts in the detail panel.
- Names automatically shortened for display, "Short names" setting.
- Assigning a device to a room from the detail panel.
- Clock on the home view and screen kept awake in kiosk mode.
- A named "Kiosk" button in the rail, and a "Start in kiosk mode" setting to
  open jeeGlow without the Jeedom menu with nothing to click.
- Kiosk mode remembered by the device, return home after inactivity and night
  dimming.
- Light or dark theme, matched automatically to the Jeedom theme.
- Commands returning a structure are no longer printed raw: the card shows the
  most readable field, the detail unfolds on tap, and timestamps are rendered as
  dates.
- Values pointing at an image are displayed as images.
- A plugin's own widget, when it wrote one for its command, is shown as is
  inside the card.
- A card announces what it does not show: "+ n more".
