# jeeGlow

jeeGlow adds a second dashboard to Jeedom. It replaces nothing: the original
dashboard, the views and the designs stay where they are and keep working.
jeeGlow reads your objects, devices and commands, and draws a modern
presentation of them, usable on a desktop screen as well as on a wall tablet or
a phone.

## How the dashboard is organised

A **rail** on the left holds the views, and **sub-tabs** at the top split the
current one. On a phone the rail becomes a bottom bar.

| View | What it shows |
|---|---|
| **Home** | The state of the house: the time, a few readings, what is running, your scenes, your rooms |
| **Functions** | The arrangement by domain: Lights, Sockets, Shutters, Heating, Security, Cameras, Media, Appliances, Weather, Energy, Sensors, Information |
| **Rooms** | Your Jeedom objects, plus "Unassigned" |
| **Health** | Whatever needs attention |
| **System** | Your devices by plugin — the troubleshooting view |

You land on **Home**. It is the view built for a glance, and yet it was the only
one you never saw without a click — even though it is already the view a tablet
returns to by itself once nobody is looking at it.

Devices themselves are arranged **by function, not by room**, for a stubborn
reason: on an ordinary installation half the devices belong to no object. A
dashboard arranged by room is half empty on day one. Rooms remain a view of
their own, which becomes the right one as you tidy up.

A device's domain is derived from the core's generic type families. A device
with no typed command lands in "Information".

The address carries the view and the tab. `#view=functions&tab=light` opens the
lights, `#view=rooms&tab=5` room number 5, `#view=health&tab=all` the list of
what is wrong. `tab=all` shows the whole view. A tablet can therefore start
exactly where you want it to:

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe&fullscreen=1#view=rooms&tab=5
```

## Opening the dashboard

Menu **Plugins → Other → jeeGlow**, or directly:

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe
```

## The home view

Home does not list devices; it answers the question you ask yourself as you walk
into a room. From top to bottom:

**The time and the date**, in Jeedom's language — not the browser's, which is
not necessarily yours on a tablet. Nothing to compute, but it is what separates
a wall display from a web page someone left open.

**A few readings as badges**: power draw, indoor temperature, outdoor
temperature, humidity, whenever your installation measures them. Each badge
**names where its number comes from** and leads to the device that reported it:
"21.4 °C" read who knows where is nobody's temperature. A dedicated sensor wins
over the probe buried inside another appliance, which mostly measures the heat
of its own casing.

**A "needs attention" banner**, when there is something to report, counting the
problems and leading to the Health view.

**"Right now"**: the actual cards of whatever is running, eight at most,
followed by a "+ n" tile that switches to the Functions view. These are real
cards you can switch off on the spot — a domain tile only answered with a number
you then had to go and check somewhere else. As soon as more than one of those
devices knows how to switch off, a **"Turn everything off"** button appears in
the row's heading. It asks for confirmation, and it spaces the commands 120
milliseconds apart: fifteen simultaneous executions bring some plugin daemons
down.

**Scenes**, if you have scenarios. Only the ones that are active, visible and
that you are allowed to run are offered. A scenario in progress says so, because
a long one — closing twelve shutters — otherwise gives no sign between the tap
and the end. The scenario's own log records a manual launch, under your name,
exactly as if it had come from the core.

**Rooms**, one tile each, carrying **the icon and the colour you already chose in
Jeedom**: ignoring them to paste the same open door on the garage, the garden and
the kitchen meant throwing away work already done. Each tile sums its room up —
how many devices are running, and a temperature when the room measures one.

**Domains**, last, reduced to a row of compact shortcuts. They are doors, not
information: they had no business taking a row of large tiles above the rooms.

## The Health view

A dead battery, a device that stopped answering, a threshold crossed: the
original dashboard says so nowhere, and until now it took scanning four hundred
tiles by eye to find out. The Health view gathers them, and the rail carries a
badge with their count — an alert you have to go looking for warns nobody.

Four sections, in this order:

- **Not answering**: the `timeout` the core raises by itself when a device
  exceeds the delay you gave it.
- **Out of range**: the `warning` and `danger` alerts the core raises on the
  thresholds you set on your commands.
- **Low batteries**: 25 % or less.
- **Silent for two days**: no dated value at all for 48 hours.

No threshold is invented here except the battery one: the other three are
Jeedom's, exactly as you set them. The battery level is read from the status the
core keeps, falling back to a command with the `BATTERY` generic type, since
plenty of plugins never fill in the former while happily reporting the latter.

A device that stopped answering is filed there and nowhere else. A battery you
can no longer read is not a second problem; it is the same one.

## What jeeGlow shows

For every object (a room, a floor), jeeGlow lists the **enabled and visible**
devices you are allowed to see, and picks a card for each one from the **generic
types** of its commands:

| Card | Recognised by |
|---|---|
| Light | `LIGHT_STATE`, `LIGHT_ON`, `LIGHT_OFF`, `LIGHT_TOGGLE`, `LIGHT_SLIDER`, `LIGHT_BRIGHTNESS` |
| Shutter | `FLAP_STATE`, `FLAP_UP`, `FLAP_DOWN`, `FLAP_STOP`, `FLAP_SLIDER`, and their BSO counterparts |
| Socket | `ENERGY_STATE`, `ENERGY_ON`, `ENERGY_OFF`, `ENERGY_SLIDER` |
| Camera | the camera domain, or `CAMERA_TAKE` and `CAMERA_URL` |
| Climate | `THERMOSTAT_TEMPERATURE`, `THERMOSTAT_SETPOINT`, `THERMOSTAT_SET_SETPOINT`, `THERMOSTAT_MODE`, `THERMOSTAT_STATE` |
| Media | `MEDIA_STATE`, `MEDIA_STATUS`, `MEDIA_TITLE`, `MEDIA_PAUSE`, `MEDIA_RESUME` |
| Sensor | no visible action command: the device only measures |
| Generic | everything else: visible info commands, then visible actions |

The first three rows decide first, because they describe what can be driven: a
lamp on a smart socket is a lamp before it is a socket. Camera, climate and
media are only considered when nothing drivable was recognised — those three
families hold no role in the sense of the first three, so they all used to fall
back to the generic card, which reduced eighteen cameras to "Video loss —"
followed by three binary lines.

**If a card looks wrong**, the cause is almost always the same: the commands
have no generic type. Open the device, *Commands* tab, and fill in the *Generic
type* column. The dashboard follows immediately — and so do the mobile
application and the voice assistants.

Past four hundred devices the list is truncated and the page says so: that is no
longer a dashboard but an inventory, and every device costs server-side reads.

## Acting, or opening the detail

A card shows only the essentials. Everything else — every value, every command,
the plugin's widget, the charts — lives in a **detail panel**, sliding in from
the side on a computer, up from the bottom on tablets and phones.

Two gestures, never a long press: on a wall tablet a long press is a lottery.

- **On a card that drives something**, the whole card acts, and **only the icon
  badge opens the detail**. It used to be the other way round: the header opened
  the detail, and the toggle was left with the bottom of the card — half the
  target lost on a short tile.
- **On a card that drives nothing** — a sensor, an information card — there is
  no conflict, and the whole header opens the detail.

The shape of the badge says which is which without your having to try:
**round when you can act, square when you can only read**. Until now a dimmer
with no on command looked exactly like a controllable lamp and answered to
nothing.

Outside the Rooms view, a card's subtitle names **the room**. In the Functions
view "Ceiling light" and "Ceiling light" are two identical cards, and nothing
said which one was the kitchen. In the Rooms view the section heading already
carries the name, so repeating it would be noise.

Two flags may appear to the right of the name: **low battery**, with its
percentage, and **not answering**. Each gets its own line, because a device can
perfectly well be silent *and* low on battery.

## The cards in practice

**Light and socket**: tapping anywhere on the card toggles it. If the device
does not report which state it is in, the card offers two explicit buttons, *On*
and *Off*, rather than a toggle that would guess wrong half the time.

**Shutter**: up, stop, down, and the position as a percentage when the device
reports it. A shutter is not toggled with a tap — up and down are two separate
gestures — but it is driven, so its badge opens the detail as a lamp's does, and
its three arrows keep the full width.

**Climate**: the measured temperature in large type, the setpoint beside it, the
mode as subtitle, and two buttons that move the setpoint by **half a unit** —
half a degree on a Celsius thermostat.
Opening a panel to gain half a degree is the gesture nobody ever makes. Those
buttons only appear when the device exposes a setpoint command, and they only
fire when the current setpoint is known: they add half a degree to it, they do
not invent it.

**Camera**: the last event spelled out, a **"Motion"** badge for as long as a
detection holds, and a *Capture* button when the device can take a snapshot. A
snapshot, or the plugin's own rendering if there is one, comes before everything
else: a picture beats any sentence. The diagnostic detail — video loss, vehicle
detected, ten binary lines — stays in the panel.

**Media**: title and artist on one line, playback state as subtitle, and
whichever transport buttons the device exposes — previous, pause, play, next.

**Sensor**: the first measurement in large type, the others below.

**Generic**: visible information, then actions as buttons, lists, sliders or a
colour picker.

On every card, **each control takes a full-width row of its own**: a slider
sharing its line with two buttons becomes impossible to hit with a finger, and a
small button tucked into a corner of a tile eats the main target without giving
anything back. A slider only sends its value when released.

## What a card does not show at first

A card shows at most **three pieces of information and four commands**. Beyond
that it says so: **"+ 4 · detail"**, and one tap opens the panel on the rest.
Nothing disappears silently.

An image and a plugin's widget do not count towards that quota: they are the
most eloquent things on a card, and burying them in the panel behind three
numbers would be exactly the wrong way round.

## What you can see change

Values refresh **in real time**, with no reload: jeeGlow listens to the same
event stream as the original dashboard. And since a live dashboard that swaps a
piece of text without a pixel of signal forces you to re-read the whole screen
to find out what moved:

- **a value that changes flashes** — never on its first display, or everything
  would be marked as new at once on load;
- **a state change is signalled across the whole card**: that is the change you
  look for from the other end of the room;
- **a command being sent shows it**, and the wait lasts as long as the round
  trip rather than some duration decided in advance — a Zigbee command taking
  three seconds used to leave the dashboard motionless, while an instant one
  kept a card greyed out long after the fact;
- **a failure shows on the card at fault**, outlined in red for a few seconds,
  and no longer only in Jeedom's notification bar: on a wall, that bar is a metre
  away from whatever just failed.

If your system is set to **reduce motion**, jeeGlow complies and stops animating.
For anyone with a vestibular disorder that movement is nausea, not elegance.

**When the tab goes to the background, jeeGlow stops redrawing.** Values are
still tracked, the drawing waits for the tab to come back, and everything is
repainted at once. Jeedom broadcasts its changes to every client regardless of
the view on screen: a wall tablet receives the hundred updates a second of a busy
installation even with its screen off, and repainting then is pure wasted work —
it is precisely what makes cheap panels stutter.

The device list itself is read again whenever the page becomes visible after
more than five minutes. A device added, renamed or moved to another room shows
up on a wall tablet on its own, without touching it.

Only **visible** commands are shown, plus the ones a card needs. To remove a
value from the dashboard, untick *Display* on the command.

## The colours, and what they mean

A device that is running carries a **tinted surface**: the background shifts
enough to be spotted from across the room, full saturation is concentrated on
the icon badge and on a thick edge stripe, and the text keeps its ink.

It did not use to work that way, and the reason is measurable: on the old
saturated fill, the subtitle of a lit card failed the 4.5:1 contrast ratio that
level AA requires, on all seven categories, and the keyboard focus ring all but
vanished. A tint laid on the surface leaves the ink alone, and the seven
categories become legible by default instead of needing seven inks chosen for
them.

The tint is that of the **category** you ticked on the device — light, heating,
opening, security, energy, media, automation. With no category, it is amber.

**A solid red fill is reserved for alarms**: smoke, gas, carbon monoxide, flood,
water leak, tampering, a triggered alarm. It is the only place on the page where
a whole card fills up, and that is what gives it its force — a saturated colour
only keeps its alarm value while it stays rare.

**A camera detecting motion turns red**, not amber: it is not "on", it is asking
to be looked at. Short of the solid fill, which stays with real alarms.

The theme follows Jeedom's, light or dark. jeeGlow does not read a theme name —
it measures the brightness of the background, which works with a theme it has
never heard of too.

## When a plugin wrote its own widget

Some plugins do not settle for a value: they ship a rendering of their own with
the command — a camera alert's thumbnails, a robot's map, a full weather
bulletin, a watch list. **jeeGlow shows that rendering**, inside its card,
rather than the raw value. Its author knows better than we do what is worth
showing.

Those widgets are not sewn into the page — on an ordinary installation they
weigh more than three hundred kilobytes. They are requested in a single call
once the page is drawn, and until then the value is shown plainly. If the call
fails, it stays.

## Commands returning a structure

Several plugins pack a whole state into a single text command: a next
collection, the state of an inverter, a camera's last alert. On a dashboard the
raw value is a brace followed by three hundred characters, and the information
is lost inside its own syntax.

For commands **without** a plugin widget, jeeGlow recognises those values and
shows the most readable field instead, underlined with dots. **Tapping it
unfolds the detail**: one field per line, lists announced by their number of
items, each one summarised in turn. Tapping again folds it back.

Timestamps are rendered as dates — the time alone if it is today, day and time
otherwise — rather than as a number of seconds. A numeric command without a
unit whose value looks like a timestamp gets the same treatment: an energy
counter carries a unit and stays a number.

## Images

A command whose value is the address of an image — a robot's map, a doorbell
snapshot, a camera still — is displayed **as an image**, not as an address. If
it fails to load, the text line takes its place again rather than leaving a
hole.

## Readable names

Plugins name things for themselves: `OpenMQTTGateway 1629AC — OMG_ESP32_BLE_SALON`
states the model, the serial number, and finally what you care about. jeeGlow
shortens those names for display — the **Short names** setting, on by default —
by removing hardware identifiers and whatever precedes a dash surrounded by
spaces. "Detection OUEST-NORD" is left alone, because its dash is not a
separator, and a shortening that would leave nothing keeps the original name.

The name in Jeedom is never modified, and a name you give by hand always wins.

## Your own names

`Shelly 1 91E2EE — spotcuisinep` will never look good on a wall. Open a device's
detail and click the pencil: the name you give is used everywhere in jeeGlow.

**The device name in Jeedom is left alone.** Your scenarios, your history and
other plugins rely on it. The chosen name lives in jeeGlow's configuration.
Clear it to go back to the original name. Renaming writes to the plugin
configuration, so it is reserved for administrators.

## Assigning a room without leaving the dashboard

The detail panel offers a **room** selector to administrators. Half of an
ordinary installation belongs to no object, and nobody opens a plugin page to
fix that: the only moment you will tidy up is the one where the device is in
front of you. The write is direct, without running the owning plugin's hooks.

## Charts

In the detail panel, **historised numeric** commands are plotted over the last
24 hours, two charts at most. Jeedom's own chart engine draws them: same data,
same colours as everywhere else.

## Search

The field in the top right searches the **displayed name**, the **plugin** and
the **room**. Typing "kitchen" and finding nothing because no device carries the
word in its name would be a false answer.

Search reaches across every view: looking for "shutter" from the Cameras view
and finding nothing, while the shutter exists, would make no sense.

## Kiosk mode

Kiosk is not a separate display mode, it is **a reading distance**. It does two
things: it removes Jeedom's menu, top bar and footer, and it scales everything
up — the whole type scale, the card width, the grid gap and the size of the
touch targets, from a single factor. Card names otherwise stayed at fourteen
pixels, to be read from two metres away. Past 1800 pixels wide the screen is no
longer a wall tablet but a television, and everything grows one step further.

Three ways to get there, from the most direct to the most lasting:

1. **The "Kiosk" button** at the bottom of the left rail, which says what it
   does and how to leave. The button in the top right corner does the same.
2. **The address**, for a bookmark or a start page (see below).
3. **The "Start in kiosk mode" setting** in the plugin configuration: jeeGlow
   then opens without the menu, on every device, with nothing to click. That is
   what a wall tablet needs.

The mode is **remembered by the device**: a tablet reopening the page finds it
in kiosk mode, with no URL parameter and no action. That choice wins over the
installation setting: if "Start in kiosk mode" is ticked but you leave kiosk
mode on your computer, that computer keeps its menu. The same button leaves, and
Jeedom gets its menu back.

The address works too, for a bookmark or a start page:

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe&fullscreen=1
```

In kiosk mode jeeGlow also asks the browser to **keep the screen on**. That
request only exists in a secure context: if you open Jeedom over plain HTTP by
its IP address, it is unavailable and the tablet will go to sleep as before.
That is a browser limit, not a missing setting.

Two settings go with this mode, in the plugin configuration, and apply to it
only:

- **Return home after** *n* minutes of inactivity. A tablet left on one room
  finds its way back to the overview. An open detail panel suspends that return:
  nobody's reading gets interrupted.
- **Night dimming**: a veil darkens the screen, from 0 to 70 per cent. Night
  hours are the ones you already gave Jeedom to switch themes. A web page cannot
  control the backlight: this is a veil, not a brightness change.

For a properly locked wall tablet:

1. Create a dedicated user (**Settings → System → Users**) with the
   **restricted** profile.
2. Grant read access only to the objects and devices it should see.
3. In its profile, choose **jeeGlow** as the home page.
4. On the tablet, open the address above with `&fullscreen=1` and add it to the
   home screen.

## Settings

**Plugins → Plugin management → jeeGlow → Configuration**:

- **Displayed title**: the name at the top of the dashboard.
- **Short names**: the shortening described above, on by default.
- **Show devices without an object**: groups them in an "Unassigned" room.
- **Start in kiosk mode**, **Return home after** and **Night dimming**: see
  kiosk mode.

## Read-only users

A user allowed to **see** a device but not to **act** on it gets no button, no
slider and no list: the card shows the state and stops there. The core would
refuse the execution anyway, but a dashboard covered in commands answering with
a red alert would make no sense.

Scenarios follow the same rule: only the ones you are allowed to run appear as
scenes, and the server checks that right again on every tap — a filtered list is
not a closed door.

## What jeeGlow does not do

- It modifies **no** device, command or Jeedom setting. The only writes it can
  make, both reserved for administrators, are the display name — which lives in
  jeeGlow's own configuration — and a device's room.
- It honours what you already decided: an object hidden from the dashboard stays
  hidden, a disabled or invisible device does not show up.
- It does not reuse the native widgets: the cards are its own. A custom widget
  set on a command is therefore not used here.
