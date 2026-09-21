# jeeGlow

jeeGlow adds a second dashboard to Jeedom. It replaces nothing: the original
dashboard, the views and the designs stay where they are and keep working.
jeeGlow reads your objects, devices and commands, and draws a modern
presentation of them, usable on a desktop screen as well as on a wall tablet or
a phone.

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

## Kiosk mode

The button in the top right corner switches to full screen: the Jeedom menu and
footer disappear, only the dashboard remains. The address follows, so it can be
bookmarked or used as a start page on a tablet:

```
index.php?v=d&m=jeeglowbe&p=jeeglowbe&fullscreen=1
```

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
