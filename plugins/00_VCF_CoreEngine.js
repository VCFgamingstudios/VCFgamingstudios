/*:
 * @plugindesc VCF Core Engine - Provides dash, jump, stat break limits, camera pan controls, and crystal utilities.
 * @author VCF
 *
 * @param MaxLevel
 * @type number
 * @min 1
 * @desc Default maximum level for actors. 0 = engine default
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
 * @desc Default maximum HP. 0 = engine default
 * @default 0
 *
 * @param MaxMP
 * @type number
 * @desc Default maximum MP. 0 = engine default
 * @default 0
 *
 * @param MaxATK
 * @type number
 * @desc Default maximum ATK. 0 = engine default
 * @default 0
 *
 * @param MaxDEF
 * @type number
 * @desc Default maximum DEF. 0 = engine default
 * @default 0
 *
 * @param MaxMAT
 * @type number
 * @desc Default maximum MAT. 0 = engine default
 * @default 0
 *
 * @param MaxMDF
 * @type number
 * @desc Default maximum MDF. 0 = engine default
 * @default 0
 *
 * @param MaxAGI
 * @type number
 * @desc Default maximum AGI. 0 = engine default
 * @default 0
 *
 * @param MaxLUK
 * @type number
 * @desc Default maximum LUK. 0 = engine default
 * @default 0

 * @param RelationshipTabName
 * @type string
 * @desc Label for the Relationships command in the menu.
 * @default Relationships

 * @param FriendLabel
 * @type string
 * @desc Display name for the Friend category.
 * @default Friend

 * @param LoverLabel
 * @type string
 * @desc Display name for the Lover category.
 * @default Lover

 * @param RivalLabel
 * @type string
 * @desc Display name for the Rival category.
 * @default Rival

 * @param AcquaintanceLabel
 * @type string
 * @desc Display name for the Acquaintance category.
 * @default Acquaintance
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
 *   VCF_SET_RELATION a b type value  # Set relation points
 *   VCF_ADD_RELATION a b type value  # Add relation points
 *
 * Plugin Parameters allow setting default limits for levels and stats.
 * A value of 0 uses the engine default instead of breaking the limit.
 * Actors can override these using the following notetags:
 *   <MaxLevel:n>
 *   <MinimalLevel:n> or <MinLevel:n>
 *   <MaxHP:n> <MaxMP:n>
 *   <MaxATK:n> <MaxDEF:n>
 *   <MaxMAT:n> <MaxMDF:n>
 *   <MaxAGI:n> <MaxLUK:n>
 *   <Relationship:actorId,category,value>
 */

(function() {
    const parameters = PluginManager.parameters('VCF_CoreEngine');

    function parseLimit(v) {
        const n = Number(v || 0);
        return isNaN(n) ? 0 : n;
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

    const relTabName = String(parameters['RelationshipTabName'] || 'Relationships');
    const relLabels = {
        friend: String(parameters['FriendLabel'] || 'Friend'),
        lover: String(parameters['LoverLabel'] || 'Lover'),
        rival: String(parameters['RivalLabel'] || 'Rival'),
        acquaintance: String(parameters['AcquaintanceLabel'] || 'Acquaintance')
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
            actor.vcfRelationDefaults = {};
            const re = /<Relationship:\s*(\d+)\s*,\s*(friend|lover|rival|acquaintance)\s*,\s*(\d+)\s*>/ig;
            let m;
            while ((m = re.exec(actor.note)) !== null) {
                const id = Number(m[1]);
                const type = m[2].toLowerCase();
                const val = Number(m[3]);
                if (!actor.vcfRelationDefaults[id]) {
                    actor.vcfRelationDefaults[id] = {friend:0,lover:0,rival:0,acquaintance:0};
                }
                actor.vcfRelationDefaults[id][type] = val;
            }
        });
    };

    // --------------------------------------------------
    // Relationship data
    // --------------------------------------------------
    Game_Actor.prototype.initVcfRelations = function() {
        this._vcfRelations = JsonEx.makeDeepCopy(this.actor().vcfRelationDefaults || {});
    };

    const _VCF_CoreEngine_Game_Actor_setup = Game_Actor.prototype.setup;
    Game_Actor.prototype.setup = function(actorId) {
        _VCF_CoreEngine_Game_Actor_setup.call(this, actorId);
        this.initVcfRelations();
    };

    Game_Actor.prototype.relation = function(otherId, type) {
        const rel = this._vcfRelations?.[otherId];
        return rel ? (rel[type] || 0) : 0;
    };

    Game_Actor.prototype.setRelation = function(otherId, type, value) {
        if (!this._vcfRelations[otherId]) {
            this._vcfRelations[otherId] = {friend:0,lover:0,rival:0,acquaintance:0};
        }
        this._vcfRelations[otherId][type] = value;
    };

    Game_Actor.prototype.addRelation = function(otherId, type, value) {
        this.setRelation(otherId, type, this.relation(otherId, type) + value);
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
            case 'VCF_SET_RELATION':
                setRelation(Number(args[0]), Number(args[1]), args[2], Number(args[3]));
                break;
            case 'VCF_ADD_RELATION':
                addRelation(Number(args[0]), Number(args[1]), args[2], Number(args[3]));
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

    function setRelation(aId, bId, type, value) {
        const actor = actorById(aId);
        if (actor) actor.setRelation(bId, type.toLowerCase(), value);
    }

    function addRelation(aId, bId, type, value) {
        const actor = actorById(aId);
        if (actor) actor.addRelation(bId, type.toLowerCase(), value);
    }

    // --------------------------------------------------
    // Menu - Relationship tab
    // --------------------------------------------------
    const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function() {
        _Window_MenuCommand_addOriginalCommands.call(this);
        this.addCommand(relTabName, 'vcfRelationship');
    };

    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler('vcfRelationship', this.commandRelationship.bind(this));
    };

    Scene_Menu.prototype.commandRelationship = function() {
        SceneManager.push(Scene_VcfRelationship);
    };

    function Scene_VcfRelationship() {
        this.initialize(...arguments);
    }
    Scene_VcfRelationship.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_VcfRelationship.prototype.constructor = Scene_VcfRelationship;

    Scene_VcfRelationship.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_VcfRelationship.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this.createCommandWindow();
    };

    Scene_VcfRelationship.prototype.createCommandWindow = function() {
        const rect = this.commandWindowRect();
        this._commandWindow = new Window_RelationshipCommand(rect);
        this._commandWindow.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._commandWindow);
    };

    Scene_VcfRelationship.prototype.commandWindowRect = function() {
        const ww = 240;
        const wh = this.calcWindowHeight(5, true);
        const wx = (Graphics.boxWidth - ww) / 2;
        const wy = (Graphics.boxHeight - wh) / 2;
        return new Rectangle(wx, wy, ww, wh);
    };

    function Window_RelationshipCommand(rect) {
        Window_Command.call(this, rect);
    }
    Window_RelationshipCommand.prototype = Object.create(Window_Command.prototype);
    Window_RelationshipCommand.prototype.constructor = Window_RelationshipCommand;

    Window_RelationshipCommand.prototype.makeCommandList = function() {
        this.addCommand(relLabels.friend, 'friend');
        this.addCommand(relLabels.lover, 'lover');
        this.addCommand(relLabels.rival, 'rival');
        this.addCommand(relLabels.acquaintance, 'acquaintance');
    };

    // --------------------------------------------------
    // Gauge drawing
    // --------------------------------------------------
    const _Window_Base_drawCurrentAndMax = Window_Base.prototype.drawCurrentAndMax;
    Window_Base.prototype.drawCurrentAndMax = function(current, max, x, y, width, color1, color2) {
        const valueWidth = Math.max(this.textWidth(String(current)), this.textWidth(String(max)), this.textWidth('000000'));
        const slashWidth = this.textWidth('/');
        const x1 = x + width - valueWidth;
        const x2 = x1 - slashWidth;
        const x3 = x2 - valueWidth;
        this.changeTextColor(color1);
        this.drawText(current, x1, y, valueWidth, 'right');
        this.changeTextColor(color2);
        this.drawText('/', x2, y, slashWidth, 'right');
        this.drawText(max, x3, y, valueWidth, 'right');
    };

    // --------------------------------------------------
    // Stat and level limits
    // --------------------------------------------------
    const _Game_BattlerBase_paramMax = Game_BattlerBase.prototype.paramMax;
    Game_BattlerBase.prototype.paramMax = function(paramId) {
        const actor = this.isActor() ? this.actor() : null;
        if (actor && actor.vcfLimits) {
            const limit = actor.vcfLimits.maxParams[paramId];
            if (limit > 0) return limit;
        }
        return _Game_BattlerBase_paramMax.call(this, paramId);
    };

    const _Game_Actor_maxLevel = Game_Actor.prototype.maxLevel;
    Game_Actor.prototype.maxLevel = function() {
        if (this.actor().vcfLimits && this.actor().vcfLimits.maxLevel > 0) {
            return this.actor().vcfLimits.maxLevel;
        }
        return _Game_Actor_maxLevel.call(this);
    };

    const _Game_Actor_minLevel = Game_Actor.prototype.minLevel || function(){return 1;};
    Game_Actor.prototype.minLevel = function() {
        if (this.actor().vcfLimits && this.actor().vcfLimits.minLevel > 0) {
            return this.actor().vcfLimits.minLevel;
        }
        return _Game_Actor_minLevel.call(this);
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
