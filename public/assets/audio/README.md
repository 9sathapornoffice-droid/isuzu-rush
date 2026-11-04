# ISUZU RUSH - Custom Audio Assets Guide

By default, **ISUZU RUSH** features a built-in **Web Audio API synthesizer** that generates high-fidelity sound effects (Jumping, Coin collection, VIP Ticket chime, Crash impact, Energy restore, and energetic chip background music) procedurally with zero external file requirements.

If you wish to use real recorded studio MP3 / OGG files, you can place them into this folder with these exact filenames:

- `bgm.mp3` - Background music loop
- `jump.mp3` - Truck jump effect
- `coin.mp3` - Coin collection ding
- `ticket.mp3` - Rare ticket collection chime
- `fuel.mp3` - Fuel canister collection
- `hit.mp3` - Obstacle collision sound
- `gameover.mp3` - Game over jingle

The game automatically checks and uses custom sound files if present, seamlessly falling back to synthesized Web Audio if they are missing.
