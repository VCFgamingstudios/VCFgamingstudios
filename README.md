- 👋 Hi, I’m @VCFgamingstudios
- 👀 I’m interested in creating entertainment through games, video, and or animations.
- 🌱 I’m currently learning how to code at a beginners level, any advice is appreciated.
- 💞️ I’m looking to collaborate on anything that is creative and innovative, I like exploring different genres.
- 📫 How to reach me I'm on Facebook, Instagram, and YouTube.
- 😄 Pronouns: He/Him
- ⚡ Fun fact: I'm a very versatile creator, I rap, write songs, and create storylines that are unique and some are inspired in my world building talents.

<!---
VCFgamingstudios/VCFgamingstudios is a ✨ special ✨ repository because its `README.md` (this file) appears on your GitHub profile.
You can click the Preview link to take a look at your changes.
--->

## VCF Core Engine for RPG Maker MZ

This repository now includes a custom plugin `VCF_Core.js` located in the `plugins` folder. Copy the file into your project's `js/plugins` directory and enable it from the plugin manager. The plugin currently provides:

* Fast-forward on maps using a configurable key
* A smart jump action triggered by the "Jump Key"
* Camera panning via the `PanCamera` plugin command
* Parameters to raise the actor level cap and scale enemy HP
* Optional HUD showing HP, MP, and stamina
* Stamina drains while dashing or performing a smart jump
* Dash key can be reassigned
* `SaveCrystal` command for quick saving at crystals
* `HealCrystal`/`RecoveryCrystal` commands to fully restore the party
* `BossCrystal` command to heal, save, and set a checkpoint at once
* `SetRespawn` and `Respawn` commands to manage boss dungeon checkpoints

Set the **Crystal Save Slot** parameter to choose which savefile ID these crystal commands use.

Adjust the parameters in the plugin manager to suit your project and use the `PanCamera` command to smoothly move the camera to any tile coordinates.
