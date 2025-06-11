/*:
 * @plugindesc VCF Core Engine - Provides dash, jump, stat break limits, camera pan controls, and crystal utilities.
 * @author VCF
 *
 * @param MaxLevel
 * @type number
 * @min 1
 * @desc Default maximum level for actors. 0 = unlimited
 * @default 99
 *
 * @param MinimalLevel
 * @type number
 * @min 1
 * @desc Default minimum level for actors
 * @default 1
 *
 * @param MaxHP
 * @type number
 * @desc Default maximum HP. 0 = unlimited
 * @default 0
 *
 * @param MaxMP
 * @type number
 * @desc Default maximum MP. 0 = unlimited
 * @default 0
 *
 * @param MaxATK
 * @type number
 * @desc Default maximum ATK. 0 = unlimited
 * @default 0
 *
 * @param MaxDEF
 * @type number
 * @desc Default maximum DEF. 0 = unlimited
 * @default 0
 *
 * @param MaxMAT
 * @type number
 * @desc Default maximum MAT. 0 = unlimited
 * @default 0
 *
 * @param MaxMDF
 * @type number
 * @desc Default maximum MDF. 0 = unlimited
 * @default 0
 *
 * @param MaxAGI
 * @type number
 * @desc Default maximum AGI. 0 = unlimited
 * @default 0
 *
 * @param MaxLUK
 * @type number
 * @desc Default maximum LUK. 0 = unlimited
 * @default 0
 *
 * @help
 * This plugin introduces a basic set of systems used by the VCF projects.
 * Features:
 *   - Dash and jump controls.
 *   - Stats (HP, MP, ATK, DEF, MAT, MDF, AGI, LUK) can exceed normal limits.
 *   - Camera panning plugin command.
 *   - Save Crystal and Healing Crystal helpers.
 *   - Crystal Dungeon unlocks via Relationship System (stub implementation).
 *
 * Plugin Commands:
 *   VCF_DASH_ON            # Enable dash mode
 *   VCF_DASH_OFF           # Disable dash mode
 *   VCF_JUMP x y           # Jump by x,y tiles
 *   VCF_CAMERA_PAN x y f   # Pan camera to x,y over f frames
 *   VCF_UNLOCK_DUNGEON id  # Unlock dungeon with given id
 *   VCF_SET_PARAM a p v    # Set actor a param p to v
 *   VCF_ADD_PARAM a p v    # Add v to actor a param p
 *   VCF_SET_LEVEL a lv     # Set actor a level to lv
 *   VCF_SET_GOLD v         # Set party gold to v
 *   VCF_ADD_GOLD v         # Add v gold to party
 *
 * Plugin Parameters allow setting default limits for levels and stats.
 * A value of 0 means the parameter is unlimited.
 * Actors can override these using the following notetags:
 *   <MaxLevel:n>
 *   <MinimalLevel:n> or <MinLevel:n>
 *   <MaxHP:n> <MaxMP:n>
 *   <MaxATK:n> <MaxDEF:n>
 *   <MaxMAT:n> <MaxMDF:n>
 *   <MaxAGI:n> <MaxLUK:n>
 */

(function() {
    const parameters = PluginManager.parameters('VCF_CoreEngine');

    function parseLimit(v) {
        const n = Number(v || 0);
        return n > 0 ? n : Infinity;
    }

    const defaults = {
        maxLevel: parseLimit(parameters['MaxLevel']),
        minLevel: Number(parameters['MinimalLevel'] || 1),
        maxParams: [
            parseLimit(parameters['MaxHP']),
            parseLimit(parameters['MaxMP']),
            parseLimit(parameters['MaxATK']),
            parseLimit(parameters['MaxDEF']),
            parseLimit(parameters['MaxMAT']),
            parseLimit(parameters['MaxMDF']),
            parseLimit(parameters['MaxAGI']),
            parseLimit(parameters['MaxLUK'])
        ]
    };

    // --------------------------------------------------
    // Notetag processing
    // --------------------------------------------------
    const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        if (!_DataManager_isDatabaseLoaded.call(this)) return false;
        if (!this._vcfNotetagsLoaded) {
            this.processVcfActorNotetags($dataActors);
            this._vcfNotetagsLoaded = true;
        }
        return true;
    };

    DataManager.processVcfActorNotetags = function(group) {
        group.forEach(actor => {
            if (!actor) return;
            actor.vcfLimits = {
                maxLevel: parseLimit(actor.meta.MaxLevel || defaults.maxLevel),
                minLevel: Number(actor.meta.MinimalLevel || actor.meta.MinLevel || defaults.minLevel),
                maxParams: [
                    parseLimit(actor.meta.MaxHP || defaults.maxParams[0]),
                    parseLimit(actor.meta.MaxMP || defaults.maxParams[1]),
                    parseLimit(actor.meta.MaxATK || defaults.maxParams[2]),
                    parseLimit(actor.meta.MaxDEF || defaults.maxParams[3]),
                    parseLimit(actor.meta.MaxMAT || defaults.maxParams[4]),
                    parseLimit(actor.meta.MaxMDF || defaults.maxParams[5]),
                    parseLimit(actor.meta.MaxAGI || defaults.maxParams[6]),
                    parseLimit(actor.meta.MaxLUK || defaults.maxParams[7])
                ]
            };
        });
    };

    // --------------------------------------------------
    // Dash Control
    // --------------------------------------------------
    let vcfDashEnabled = true;

    const _Game_Player_dashing = Game_Player.prototype.isDashing;
    Game_Player.prototype.isDashing = function() {
        if (vcfDashEnabled) {
            return Input.isPressed('shift') || _Game_Player_dashing.call(this);
        } else {
            return _Game_Player_dashing.call(this);
        }
    };

    // Plugin commands
    const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        switch (command.toUpperCase()) {
            case 'VCF_DASH_ON':
                vcfDashEnabled = true;
                break;
            case 'VCF_DASH_OFF':
                vcfDashEnabled = false;
                break;
            case 'VCF_JUMP':
                const x = parseInt(args[0]);
                const y = parseInt(args[1]);
                $gamePlayer.jump(x, y);
                break;
            case 'VCF_CAMERA_PAN':
                const px = Number(args[0]);
                const py = Number(args[1]);
                const frames = Number(args[2] || 30);
                $gameMap.setDisplayPos(px, py);
                $gameScreen.startFlash([255,255,255,0], frames);
                break;
            case 'VCF_UNLOCK_DUNGEON':
                const id = Number(args[0]);
                // Stub: integrate with relationship system here
                $gameVariables.setValue(1000 + id, true);
                break;
            case 'VCF_SET_PARAM':
                setActorParam(Number(args[0]), Number(args[1]), Number(args[2]));
                break;
            case 'VCF_ADD_PARAM':
                addActorParam(Number(args[0]), Number(args[1]), Number(args[2]));
                break;
            case 'VCF_SET_LEVEL':
                setActorLevel(Number(args[0]), Number(args[1]));
                break;
            case 'VCF_SET_GOLD':
                $gameParty._gold = Number(args[0]);
                break;
            case 'VCF_ADD_GOLD':
                $gameParty.gainGold(Number(args[0]));
                break;
        }
    };

    function actorById(id) {
        return $gameActors.actor(id);
    }

    function setActorParam(actorId, paramId, value) {
        const actor = actorById(actorId);
        if (actor) {
            const diff = value - actor.paramBase(paramId);
            actor.addParam(paramId, diff);
        }
    }

    function addActorParam(actorId, paramId, value) {
        const actor = actorById(actorId);
        if (actor) {
            actor.addParam(paramId, value);
        }
    }

    function setActorLevel(actorId, level) {
        const actor = actorById(actorId);
        if (actor) {
            actor.changeLevel(level, false);
        }
    }

    // --------------------------------------------------
    // Stat and level limits
    // --------------------------------------------------
    Game_BattlerBase.prototype.paramMax = function(paramId) {
        if (this.isActor() && this.actor().vcfLimits) {
            return this.actor().vcfLimits.maxParams[paramId] || Infinity;
        }
        return Infinity;
    };

    Game_Actor.prototype.maxLevel = function() {
        return this.actor().vcfLimits ? this.actor().vcfLimits.maxLevel : 99;
    };

    Game_Actor.prototype.minLevel = function() {
        return this.actor().vcfLimits ? this.actor().vcfLimits.minLevel : 1;
    };

    const _Game_Actor_changeLevel = Game_Actor.prototype.changeLevel;
    Game_Actor.prototype.changeLevel = function(level, show) {
        const clamped = Math.max(this.minLevel(), Math.min(level, this.maxLevel()));
        _Game_Actor_changeLevel.call(this, clamped, show);
    };

    // Clamp base parameters when level exceeds class data
    const _Game_Actor_paramBase = Game_Actor.prototype.paramBase;
    Game_Actor.prototype.paramBase = function(paramId) {
        const params = this.currentClass().params[paramId];
        if (this._level >= params.length) {
            return params[params.length - 1];
        }
        return _Game_Actor_paramBase.call(this, paramId);
    };

    // --------------------------------------------------
    // Save and Healing Crystals (helpers)
    // --------------------------------------------------
    Scene_Map.prototype.callSaveCrystal = function() {
        SceneManager.push(Scene_Save);
    };

    Scene_Map.prototype.callHealingCrystal = function() {
        const hp = this.actor() && this.actor().mhp;
        if (hp) {
            this.actor().recoverAll();
        }
    };

})();
