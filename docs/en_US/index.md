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

Only **visible** commands are shown, plus the ones a card needs. To remove a
value from the dashboard, untick *Display* on the command.

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
- **Hide empty rooms**: hides objects that only structure the tree, such as a
  floor.

## What jeeGlow does not do

- It modifies **no** device, command or Jeedom setting.
- It honours what you already decided: an object hidden from the dashboard stays
  hidden, a disabled or invisible device does not show up.
- It does not reuse the native widgets: the cards are its own. A custom widget
  set on a command is therefore not used here.
