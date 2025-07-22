/*:
 * @target MZ
 * @plugindesc VCF Core Engine - Basic enhancements for RPG Maker MZ.
 * @author VCFgamingstudios
 *
 * @param Fast Forward Key
 * @text Fast Forward Key
 * @type select
 * @option shift
 * @option control
 * @option tab
 * @default shift
 * @desc Hold this key to speed up map updates.
 *
 * @param Jump Key
 * @text Jump Key
 * @type select
 * @option pageup
 * @option pagedown
 * @option shift
 * @default pageup
 * @desc Press this key for a smart jump forward.

 * @param Dash Key
 * @text Dash Key
 * @type select
 * @option shift
 * @option control
 * @option tab
 * @default shift
 * @desc Hold this key to dash while moving.
 *
 * @param Jump Distance
 * @type number
 * @min 1
 * @max 5
 * @default 2
 * @desc Distance in tiles for the smart jump.
 *
 * @param Max Actor Level
 * @type number
 * @default 99
 * @desc Maximum level actors can reach.
 *
 * @param Enemy HP Multiplier
 * @type number
 * @decimals 2
 * @default 1.0
 * @desc Multiplier applied to enemy base HP.
 *
 * @param Enemy Level Offset
 * @type number
 * @default 0
 * @desc Adds this value to each enemy level property.
 *
 * @param Camera Pan Speed
 * @type number
 * @default 15
 * @desc Default duration for camera pan.

 * @param Crystal Save Slot
 * @type number
 * @default 1
 * @desc Save slot used by SaveCrystal and BossCrystal commands.

 * @param Show HUD
 * @type boolean
 * @default true
 * @desc Display a simple HP/MP/Stamina HUD.

 * @param HUD X
 * @type number
 * @default 10
 * @desc X position of the HUD.

 * @param HUD Y
 * @type number
 * @default 10
 * @desc Y position of the HUD.

 * @param Max Stamina
 * @type number
 * @default 100
 * @desc Maximum stamina value for the player.

 * @param Dash Stamina Cost
 * @type number
 * @default 1
 * @desc Stamina drained per frame while dashing.

 * @param Jump Stamina Cost
 * @type number
 * @default 20
 * @desc Stamina drained when performing a smart jump.

 * @param Stamina Regen
 * @type number
 * @decimals 2
 * @default 0.5
 * @desc Stamina regained each frame when not dashing or jumping.
 *
 * @help VCF_Core.js
 * This plugin provides several foundational features:
 *  - Fast-forward map scenes while holding the configured key.
 *  - Smart jump when the jump key is pressed.
 *  - Adjustable actor level cap and enemy HP multiplier.
 *  - Simple camera panning via plugin command.
 *
 * Plugin Command:
 *   PanCamera x y duration
 *     - x, y: tile coordinates to center on.
 *     - duration: frames for the pan (optional).
 */
(() => {
    const pluginName = 'VCF_Core';
    const params = PluginManager.parameters(pluginName);
    const fastKey = params['Fast Forward Key'] || 'shift';
    const jumpKey = params['Jump Key'] || 'pageup';
    const dashKey = params['Dash Key'] || 'shift';
    const jumpDistance = Number(params['Jump Distance'] || 2);
    const maxActorLevel = Number(params['Max Actor Level'] || 99);
    const enemyHpMult = Number(params['Enemy HP Multiplier'] || 1);
    const enemyLevelOffset = Number(params['Enemy Level Offset'] || 0);
    const defaultPanSpeed = Number(params['Camera Pan Speed'] || 15);
    const crystalSaveSlot = Number(params['Crystal Save Slot'] || 1);
    const showHud = params['Show HUD'] !== 'false';
    const hudX = Number(params['HUD X'] || 10);
    const hudY = Number(params['HUD Y'] || 10);
    const maxStamina = Number(params['Max Stamina'] || 100);
    const dashCost = Number(params['Dash Stamina Cost'] || 1);
    const jumpCost = Number(params['Jump Stamina Cost'] || 20);
    const staminaRegen = Number(params['Stamina Regen'] || 0.5);
    let respawnData = null;

    // ----------------------------------------------------------------------
    // Stamina management
    const _Game_Player_initMembers = Game_Player.prototype.initMembers;
    Game_Player.prototype.initMembers = function() {
        _Game_Player_initMembers.call(this);
        this._stamina = maxStamina;
    };

    Game_Player.prototype.maxStamina = function() {
        return maxStamina;
    };

    Game_Player.prototype.stamina = function() {
        return this._stamina;
    };

    Game_Player.prototype.gainStamina = function(value) {
        this._stamina = Math.min(maxStamina, this._stamina + value);
    };

    Game_Player.prototype.consumeStamina = function(value) {
        this._stamina = Math.max(0, this._stamina - value);
    };

    const _Game_Player_isDashButtonPressed = Game_Player.prototype.isDashButtonPressed;
    Game_Player.prototype.isDashButtonPressed = function() {
        if (this._stamina <= 0) return false;
        return Input.isPressed(dashKey) || _Game_Player_isDashButtonPressed.call(this);
    };

    // Fast-forward map updates
    const _Scene_Map_updateMain = Scene_Map.prototype.updateMain;
    Scene_Map.prototype.updateMain = function() {
        if (Input.isPressed(fastKey)) {
            _Scene_Map_updateMain.call(this);
        }
        _Scene_Map_updateMain.call(this);
        $gameMap.updateCameraPan();
    };

    // Smart jump ability
    const _Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _Game_Player_update.call(this, sceneActive);
        if (sceneActive && Input.isTriggered(jumpKey)) {
            if (this.stamina() >= jumpCost && this.smartJump(jumpDistance)) {
                this.consumeStamina(jumpCost);
            }
        }
        if (this.isDashing() && this.isMoving()) {
            this.consumeStamina(dashCost);
        } else if (!Input.isPressed(jumpKey)) {
            this.gainStamina(staminaRegen);
        }
    };

    Game_Player.prototype.smartJump = function(dist) {
        const dir = this.direction();
        let tx = this.x;
        let ty = this.y;
        for (let i = 0; i < dist; i++) {
            tx = $gameMap.roundXWithDirection(tx, dir);
            ty = $gameMap.roundYWithDirection(ty, dir);
            if (!$gameMap.isPassable(tx, ty, dir)) return false;
        }
        this.jump(tx - this.x, ty - this.y);
        return true;
    };

    // Adjust actor max level
    Game_Actor.prototype.maxLevel = function() {
        return maxActorLevel;
    };

    // Apply enemy HP multiplier and store custom level
    const _Game_Enemy_setup = Game_Enemy.prototype.setup;
    Game_Enemy.prototype.setup = function(enemyId, x, y) {
        _Game_Enemy_setup.call(this, enemyId, x, y);
        this._level = (this.enemy().meta.Level || 1) + enemyLevelOffset;
    };

    const _Game_Enemy_paramBase = Game_Enemy.prototype.paramBase;
    Game_Enemy.prototype.paramBase = function(paramId) {
        let value = _Game_Enemy_paramBase.call(this, paramId);
        if (paramId === 0) {
            value = Math.round(value * enemyHpMult);
        }
        return value;
    };

    Game_Enemy.prototype.level = function() {
        return this._level || 1;
    };

    // ----------------------------------------------------------------------
    // HUD sprite
    function Sprite_VcfHud() {
        this.initialize(...arguments);
    }

    Sprite_VcfHud.prototype = Object.create(Sprite.prototype);
    Sprite_VcfHud.prototype.constructor = Sprite_VcfHud;

    Sprite_VcfHud.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this.bitmap = new Bitmap(150, 40);
        this.x = hudX;
        this.y = hudY;
    };

    Sprite_VcfHud.prototype.update = function() {
        Sprite.prototype.update.call(this);
        this.bitmap.clear();
        const actor = $gameParty.leader();
        if (!actor) return;
        drawBar(this.bitmap, 0, 0, 100, 8, '#ff0000', actor.hp / actor.mhp);
        drawBar(this.bitmap, 0, 12, 100, 8, '#0000ff', actor.mp / actor.mmp);
        drawBar(this.bitmap, 0, 24, 100, 8, '#00ff00', $gamePlayer.stamina() / $gamePlayer.maxStamina());
    };

    function drawBar(bitmap, x, y, width, height, color, rate) {
        bitmap.fillRect(x, y, width, height, 'rgba(0,0,0,0.5)');
        bitmap.fillRect(x, y, width * rate, height, color);
    }

    // Camera pan support
    Game_Map.prototype.startCameraPan = function(x, y, duration) {
        const cx = Graphics.width / this.tileWidth() / 2;
        const cy = Graphics.height / this.tileHeight() / 2;
        this._panTargetX = x - cx;
        this._panTargetY = y - cy;
        this._panDuration = duration;
    };

    Game_Map.prototype.updateCameraPan = function() {
        if (this._panDuration > 0) {
            this._displayX = (this._displayX * (this._panDuration - 1) + this._panTargetX) / this._panDuration;
            this._displayY = (this._displayY * (this._panDuration - 1) + this._panTargetY) / this._panDuration;
            this._panDuration--;
        }
    };

    // Attach the HUD sprite to the map
    const _Spriteset_Map_createUpperLayer = Spriteset_Map.prototype.createUpperLayer;
    Spriteset_Map.prototype.createUpperLayer = function() {
        _Spriteset_Map_createUpperLayer.call(this);
        if (showHud) {
            this._vcfHud = new Sprite_VcfHud();
            this.addChild(this._vcfHud);
        }
    };

    PluginManager.registerCommand(pluginName, 'PanCamera', args => {
        const x = Number(args.x || $gamePlayer.x);
        const y = Number(args.y || $gamePlayer.y);
        const d = Number(args.duration || defaultPanSpeed);
        $gameMap.startCameraPan(x, y, d);
    });

    PluginManager.registerCommand(pluginName, 'SaveCrystal', args => {
        const slot = crystalSaveSlot;
        DataManager._lastAccessedId = slot;
        if (DataManager.saveGame(slot)) {
            $gameMessage.add('Game saved.');
        }
    });

    PluginManager.registerCommand(pluginName, 'HealCrystal', args => {
        $gameParty.members().forEach(a => a.recoverAll());
        $gameMessage.add('Party fully healed.');
    });

    PluginManager.registerCommand(pluginName, 'RecoveryCrystal', args => {
        $gameParty.members().forEach(a => a.recoverAll());
        $gameMessage.add('Party fully healed.');
    });

    PluginManager.registerCommand(pluginName, 'BossCrystal', args => {
        const slot = crystalSaveSlot;
        DataManager._lastAccessedId = slot;
        if (DataManager.saveGame(slot)) {
            $gameParty.members().forEach(a => a.recoverAll());
            respawnData = {
                mapId: $gameMap.mapId(),
                x: $gamePlayer.x,
                y: $gamePlayer.y
            };
            $gameMessage.add('Checkpoint saved.');
        }
    });

    PluginManager.registerCommand(pluginName, 'SetRespawn', args => {
        respawnData = {
            mapId: $gameMap.mapId(),
            x: $gamePlayer.x,
            y: $gamePlayer.y
        };
    });

    PluginManager.registerCommand(pluginName, 'Respawn', args => {
        if (respawnData) {
            $gamePlayer.reserveTransfer(respawnData.mapId, respawnData.x, respawnData.y);
        }
    });
})();
