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
| **Home** | The state of the house: a few measurements as badges, then one tile per domain with what is running |
| **Functions** | The default arrangement: Lights, Sockets, Shutters, Heating, Security, Cameras, Media, Appliances, Weather, Energy, Sensors, Information |
| **Rooms** | Your Jeedom objects, plus "Unassigned" |
| **System** | Your devices by plugin — the troubleshooting view |

The default arrangement is **function, not room**, for a stubborn reason: on an
ordinary installation half the devices belong to no object. A dashboard arranged
by room is half empty on day one. Rooms remain a view of their own, which
becomes the right one as you tidy up.

A device's domain is derived from the core's generic type families. A device
with no typed command lands in "Information".

The address carries the view and the tab — `#view=functions&tab=light` — so a
tablet can start exactly where you want.

## The detail panel

A card only shows the essentials: its state, its main controls and up to three
measurements. **Tapping the card header opens the detail**, as a side panel on a
computer and as a bottom sheet on tablets and phones: every piece of
information, every command, the plugin widget.

The body of the card acts: a tap turns on, turns off, raises or lowers. Two
distinct gestures, with no long press — on a wall tablet a long press is a
lottery.

## Opening the dashboard

Menu **Plugins → Other → jeeGlow**, or directly:

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe
```

## What jeeGlow shows

For every object (a room, a floor), jeeGlow lists the **enabled and visible**
devices you are allowed to see, and picks a card for each one from the **generic
types** of its commands:

| Card | Recognised by |
|---|---|
| Light | `LIGHT_STATE`, `LIGHT_ON`, `LIGHT_OFF`, `LIGHT_TOGGLE`, `LIGHT_SLIDER` |
| Shutter | `FLAP_STATE`, `FLAP_UP`, `FLAP_DOWN`, `FLAP_STOP`, `FLAP_SLIDER` |
| Socket | `ENERGY_STATE`, `ENERGY_ON`, `ENERGY_OFF`, `ENERGY_SLIDER` |
| Sensor | no visible action command: the device only measures |
| Generic | everything else: visible info commands, then visible actions |

A device matching several cards takes the first one in that list.

**If a card looks wrong**, the cause is almost always the same: the commands
have no generic type. Open the device, *Commands* tab, and fill in the *Generic
type* column. The dashboard follows immediately — and so do the mobile
application and the voice assistants.

## The cards in practice

- **Light and socket**: tapping anywhere on the card toggles it. The whole card
  lights up when it is on. The slider, when there is one, only sends its value
  when released.
- **Shutter**: up, stop, down, and the position as a percentage when the device
  reports it.
- **Sensor**: the first measurement in large type, the others below.
- **Generic**: visible information, then actions as buttons, lists or sliders.

Values refresh **in real time**, with no reload: jeeGlow listens to the same
event stream as the original dashboard.

The device list itself is read again whenever the page becomes visible after
more than five minutes. A device added, renamed or moved to another room shows
up on a wall tablet on its own, without touching it.

Only **visible** commands are shown, plus the ones a card needs. To remove a
value from the dashboard, untick *Display* on the command.

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
shows the most readable field instead,
underlined with dots. **Tapping it unfolds the detail**: one field per line,
lists announced by their number of items, each one summarised in turn. Tapping
again folds it back.

Timestamps are rendered as dates — the time alone if it is today, day and time
otherwise — rather than as a number of seconds. A numeric command without a
unit whose value looks like a timestamp gets the same treatment: an energy
counter carries a unit and stays a number.

## Images

A command whose value is the address of an image — a robot's map, a doorbell
snapshot, a camera still — is displayed **as an image**, not as an address. If
it fails to load, the text line takes its place again rather than leaving a
hole.

## What a card does not show at first

A card shows at most six pieces of information and eight commands. Beyond that
it says so: **"+ 4 more"**, one tap unfolds the rest. Nothing disappears
silently.

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

In the detail panel, **historised** commands are plotted over the last 24 hours,
two charts at most. Jeedom's own chart engine draws them: same data, same
colours as everywhere else.

## Kiosk mode

The button in the top right corner switches to full screen: **the Jeedom menu
and top bar disappear**, along with the footer. Only the dashboard remains.

Three ways to get there, from the most direct to the most lasting:

1. **The "Kiosk" button** at the bottom of the left rail, which says what it
   does and how to leave.
2. **The address**, for a bookmark or a start page (see below).
3. **The "Start in kiosk mode" setting** in the plugin configuration: jeeGlow
   then opens without the menu, on every device, with nothing to click. That is
   what a wall tablet needs.

The mode is **remembered by the device**: a tablet reopening the page finds it
in kiosk mode, with no URL parameter and no action. That choice wins over the
installation setting: if "Start in kiosk mode" is ticked but you leave kiosk
mode on your computer, that computer keeps its menu.

The address works too, for a bookmark or a start page:

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe&fullscreen=1
```

The time and date are shown at the top of the home view, in Jeedom's language —
not the browser's, which is not necessarily yours on a tablet.

In kiosk mode jeeGlow also asks the browser to **keep the screen on**. That
request only exists in a secure context: if you open Jeedom over plain HTTP by
its IP address, it is unavailable and the tablet will go to sleep as before.

Two settings go with this mode, in the plugin configuration, and apply to it
only:

- **Return home after** *n* minutes of inactivity. An open detail panel suspends
  that return: nobody's reading gets interrupted.
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

## Picking a room

The pills under the title filter by room. The choice is written in the address
(`#room=5`), so a tablet can start directly on the kitchen. Search, on the other
hand, looks through every room.

## Settings

**Plugins → Plugin management → jeeGlow → Configuration**:

- **Displayed title**: the name at the top of the dashboard.
- **Show devices without an object**: groups them in an "Unassigned" room.

## Read-only users

A user allowed to **see** a device but not to **act** on it gets no button, no
slider and no list: the card shows the state and stops there. The core would
refuse the execution anyway, but a dashboard covered in commands answering with
a red alert would make no sense.

## What jeeGlow does not do

- It modifies **no** device, command or Jeedom setting.
- It honours what you already decided: an object hidden from the dashboard stays
  hidden, a disabled or invisible device does not show up.
- It does not reuse the native widgets: the cards are its own. A custom widget
  set on a command is therefore not used here.
