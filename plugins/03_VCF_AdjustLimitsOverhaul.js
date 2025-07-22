/*:
 * @target MZ
 * @plugindesc VCF Adjust Limits Overhaul - extends VCF_CoreEngine with base stat notetags and extra parameters.
 * @author VCF
 *
 * @param DashSpCost
 * @type number
 * @desc SP consumed per frame while dashing.
 * @default 1

 * @param JumpSpCost
 * @type number
 * @desc SP cost to jump.
 * @default 10
 *
 * @help
 * Actors can specify initial parameter bonuses with notetags such as
 *   <ATK:50>
 *   <MHP:500>
 *   <SP:20>
 * New parameters Dexterity (DEX), Vigor (VIG), Charisma (CHA), Wisdom (WIS),
 * Intelligence (INT), and Precognition (PRE) can also be set with
 *   <DEX:5>  <VIG:3> <CHA:1> <WIS:4> <INT:6> <PRE:2>
 * The plugin stores these values on the actor for use in formulas. Weapons and
 * armors can also supply these parameters using the same tags. Damage type
 * ratings can be set with <Piercing:x>, <Bludgeoning:x>, and <Slashing:x> for
 * custom formulas.
 *
 * Script calls:
 *   VCF.dexDamage(a, b)  # basic DEX based attack formula
 *   VCF.wisDamage(a, b)  # basic WIS based magic formula
 */
(function() {
    const pluginName = 'VCF_AdjustLimitsOverhaul';

    const params = PluginManager.parameters(pluginName);
    const dashCost = Number(params['DashSpCost'] || 1);
    const jumpCost = Number(params['JumpSpCost'] || 10);

    const paramNames = ['MHP','MMP','ATK','DEF','MAT','MDF','AGI','LUK'];
    const extraNames = ['SP','DEX','VIG','CHA','WIS','INT','PRE'];

    const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        if (!_DataManager_isDatabaseLoaded.call(this)) return false;
        if (!this._vcfAdjNotetags) {
            this.processVcfAdjustActorNotetags($dataActors);
            this.processVcfAdjustItemNotetags($dataWeapons);
            this.processVcfAdjustItemNotetags($dataArmors);
            this._vcfAdjNotetags = true;
        }
        return true;
    };

    DataManager.processVcfAdjustActorNotetags = function(group) {
        group.forEach(actor => {
            if (!actor) return;
            actor.vcfParamAdjust = Array(paramNames.length).fill(0);
            paramNames.forEach((p,i)=>{
                if (actor.meta[p]) actor.vcfParamAdjust[i] = Number(actor.meta[p]);
            });
            actor.vcfExtraParams = {};
            extraNames.forEach(n => {
                if (actor.meta[n]) actor.vcfExtraParams[n] = Number(actor.meta[n]);
            });
        });
    };

    DataManager.processVcfAdjustItemNotetags = function(group) {
        group.forEach(item => {
            if (!item) return;
            item.vcfPiercing = Number(item.meta.Piercing || 0);
            item.vcfBludgeoning = Number(item.meta.Bludgeoning || 0);
            item.vcfSlashing = Number(item.meta.Slashing || 0);
            item.vcfExtraParams = {};
            extraNames.forEach(n => {
                if (item.meta[n]) item.vcfExtraParams[n] = Number(item.meta[n]);
            });
        });
    };

    const _Game_Actor_setup = Game_Actor.prototype.setup;
    Game_Actor.prototype.setup = function(actorId) {
        _Game_Actor_setup.call(this, actorId);
        this.applyVcfAdjustParams();
    };

    Game_Actor.prototype.applyVcfAdjustParams = function() {
        const adjust = this.actor().vcfParamAdjust || [];
        adjust.forEach((v,i)=>{ if (v) this.addParam(i, v); });
        this.refreshVcfExtras();
        this._vcfSp = this._vcfExtraParams.SP;
    };

    Game_Actor.prototype.refreshVcfExtras = function() {
        const base = this.actor().vcfExtraParams || {};
        const extras = {SP:0,DEX:0,VIG:0,CHA:0,WIS:0,INT:0,PRE:0};
        Object.keys(base).forEach(k => extras[k] = base[k]);
        this.equips().forEach(eq => {
            if (eq && eq.vcfExtraParams) {
                Object.keys(eq.vcfExtraParams).forEach(k => {
                    extras[k] = (extras[k] || 0) + eq.vcfExtraParams[k];
                });
            }
        });
        this._vcfExtraParams = extras;
    };

    const _Game_Actor_refresh = Game_Actor.prototype.refresh;
    Game_Actor.prototype.refresh = function() {
        _Game_Actor_refresh.call(this);
        this.refreshVcfExtras();
    };

    // new parameter accessors
    Game_Actor.prototype.dex = function() { return this._vcfExtraParams.DEX || 0; };
    Game_Actor.prototype.vig = function() { return this._vcfExtraParams.VIG || 0; };
    Game_Actor.prototype.cha = function() { return this._vcfExtraParams.CHA || 0; };
    Game_Actor.prototype.wis = function() { return this._vcfExtraParams.WIS || 0; };
    Game_Actor.prototype.intel = function() { return this._vcfExtraParams.INT || 0; };
    Game_Actor.prototype.pre = function() { return this._vcfExtraParams.PRE || 0; };

    Game_Actor.prototype.sp = function() { return this._vcfSp || 0; };
    Game_Actor.prototype.setSp = function(value) { this._vcfSp = Math.max(0, value); };
    Game_Actor.prototype.maxSp = function() { return this.vig() + (this.actor().vcfExtraParams?.SP || 0); };

    // --------------------------------------------------
    // Stamina usage when dashing and jumping
    // --------------------------------------------------
    const _Game_Player_isDashing = Game_Player.prototype.isDashing;
    Game_Player.prototype.isDashing = function() {
        if (!_Game_Player_isDashing.call(this)) return false;
        const actor = $gameParty.leader();
        return actor ? actor.sp() > 0 : false;
    };

    const _Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _Game_Player_update.call(this, sceneActive);
        this.updateVcfSp();
    };

    Game_Player.prototype.updateVcfSp = function() {
        const actor = $gameParty.leader();
        if (!actor) return;
        if (this.isDashing() && this.isMoving()) {
            actor.setSp(actor.sp() - dashCost);
        } else if (actor.sp() < actor.maxSp()) {
            actor.setSp(actor.sp() + 1);
        }
    };

    const _Game_Player_jump = Game_Player.prototype.jump;
    Game_Player.prototype.jump = function(xPlus, yPlus) {
        const actor = $gameParty.leader();
        if (actor && actor.sp() >= jumpCost) {
            actor.setSp(actor.sp() - jumpCost);
            _Game_Player_jump.call(this, xPlus, yPlus);
        }
    };

    // --------------------------------------------------
    // HP/MP/SP HUD
    // --------------------------------------------------
    function Window_VcfStatusHud(rect) {
        Window_StatusBase.call(this, rect);
        this.refresh();
    }
    Window_VcfStatusHud.prototype = Object.create(Window_StatusBase.prototype);
    Window_VcfStatusHud.prototype.constructor = Window_VcfStatusHud;

    Window_VcfStatusHud.prototype.refresh = function() {
        this.contents.clear();
        const actor = $gameParty.leader();
        if (!actor) return;
        const line = this.lineHeight();
        this.drawActorHp(actor, 0, 0, 200);
        this.drawActorMp(actor, 0, line, 200);
        this.drawActorSp(actor, 0, line * 2, 200);
    };

    Window_VcfStatusHud.prototype.drawActorSp = function(actor, x, y, width) {
        const color1 = this.textColor(30);
        const color2 = this.textColor(31);
        this.drawGauge(x, y, width, actor.sp() / actor.maxSp(), color1, color2);
        this.changeTextColor(this.systemColor());
        this.drawText('SP', x, y, 44);
        this.drawCurrentAndMax(actor.sp(), actor.maxSp(), x, y, width,
            this.normalColor(), this.normalColor());
    };

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this.createVcfStatusHud();
    };

    Scene_Map.prototype.createVcfStatusHud = function() {
        const rect = new Rectangle(0, 0, 200, this.calcWindowHeight(3, true));
        this._vcfStatusHud = new Window_VcfStatusHud(rect);
        this.addWindow(this._vcfStatusHud);
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (this._vcfStatusHud) this._vcfStatusHud.refresh();
    };

    PluginManager.registerCommand(pluginName, 'VCF_SET_SP', args => {
        const actor = $gameActors.actor(Number(args.actorId));
        if (actor) actor.setSp(Number(args.value));
    });

    PluginManager.registerCommand(pluginName, 'VCF_ADD_SP', args => {
        const actor = $gameActors.actor(Number(args.actorId));
        if (actor) actor.setSp(actor.sp() + Number(args.value));
    });

    window.VCF = window.VCF || {};
    VCF.dexDamage = function(a, b) {
        return a.atk + a.dex() * 2 - b.def;
    };
    VCF.wisDamage = function(a, b) {
        return a.mat + a.wis() * 2 - b.mdf;
    };
})();
