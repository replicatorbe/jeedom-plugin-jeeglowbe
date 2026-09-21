# Changelog

## 0.1

First release.

- Alternative dashboard, leaving the original dashboard untouched.
- Cards derived from generic types: light, shutter, socket, sensor, plus a
  generic fallback card for everything else.
- Real time value updates.
- Room filter, search, full screen mode for wall tablets.
- Light or dark theme, matched automatically to the Jeedom theme.
- Commands returning a structure are no longer printed raw: the card shows the
  most readable field, the detail unfolds on tap, and timestamps are rendered as
  dates.
- Values pointing at an image are displayed as images.
- A plugin's own widget, when it wrote one for its command, is shown as is
  inside the card.
- A card announces what it does not show: "+ n more".
