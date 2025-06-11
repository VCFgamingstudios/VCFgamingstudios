/*:
 * @target MZ
 * @plugindesc VCF Weapon Core - Adds weapon license progression, type requirements and mythic relic features.
 * @author VCF
 *
 * @param LicenseNames
 * @type string
 * @desc Comma separated list of license ranks in order.
 * @default Beginner,Adept,Advanced,Master,Prodigy

 * @param LicenseTypes
 * @type string
 * @desc Comma separated list of weapon license types such as Sword,Axe.
 * @default Sword,Axe,Staff,Bow
 *
 * @param LicenseThreshold
 * @type number
 * @desc Battles required to increase license rank.
 * @default 25
 *
 * @help
 * Weapons can require a license to equip with <RequiredLicense:Rank>.
 * Actors gain license ranks after a number of battles while wielding a weapon.
 * Each weapon belongs to a license type defined by the plugin parameter
 * `LicenseTypes` or <LicenseType:Name>. Actors earn license points (LP)
 * when they finish battles with a weapon. LP is tracked per type and when
 * it reaches `LicenseThreshold` the rank increases.
 * Mythic relics marked with <MythicRelic> and <UnleashSkill:id> replace the
 * normal attack with their Unleash skill. Weapons may add stats via
 * <AugmentATK:n>, <AugmentMHP:n>, etc, and cause a bleed state with
 * <Bleed:stateId>. Items grant LP with <LPBoost:Type,Amount>. A HUD on the
 * map shows the party leader's current LP progress.
 *
 * Plugin Commands:
 *   VCF_SET_LICENSE actorId type rank   # Set actor license rank
 *   VCF_ADD_LP actorId type amount      # Add license points
 *   VCF_SET_LP actorId type value       # Set license points
 *   VCF_BOOST_LP actorId type percent   # Multiply LP by 1+percent/100
 *   VCF_REMOVE_LP actorId type amount   # Subtract license points
 *   VCF_RESET_LICENSE actorId type      # Reset rank and points
*/
(function() {
    const pluginName = 'VCF_WeaponCore';
    const params = PluginManager.parameters(pluginName);
    const licenseNames = (params['LicenseNames'] || 'Beginner,Adept,Advanced,Master,Prodigy')
        .split(',').map(n => n.trim());
    const licenseTypes = (params['LicenseTypes'] || 'Sword,Axe,Staff,Bow')
        .split(',').map(t => t.trim()).filter(t => t);
    const threshold = Number(params['LicenseThreshold'] || 25);
    const augmentKeys = ['MHP','MMP','ATK','DEF','MAT','MDF','AGI','LUK'];

    const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        if (!_DataManager_isDatabaseLoaded.call(this)) return false;
        if (!this._vcfWeaponNotetags) {
            this.processVcfWeaponNotetags($dataWeapons);
            this.processVcfLpItemNotetags($dataItems);
            this._vcfWeaponNotetags = true;
        }
        return true;
    };

    DataManager.processVcfWeaponNotetags = function(group) {
        group.forEach(w => {
            if (!w) return;
            w.vcfRequiredLicense = parseLicense(w.meta.RequiredLicense);
            w.vcfLicenseType = parseLicenseType(w.meta.LicenseType);
            if (w.vcfLicenseType == null) w.vcfLicenseType = (w.wtypeId || 1) - 1;
            w.vcfUnleashSkill = Number(w.meta.UnleashSkill || 0);
            w.vcfMythic = w.meta.MythicRelic !== undefined;
            w.vcfBleed = Number(w.meta.Bleed || 0);
            w.vcfAugments = {};
            augmentKeys.forEach((key,i) => {
                const val = Number(w.meta['Augment' + key] || 0);
                if (val) w.vcfAugments[i] = val;
            });
        });
    };

    DataManager.processVcfLpItemNotetags = function(group) {
        group.forEach(it => {
            if (!it) return;
            const m = /<LPBoost\s*:(\w+),(\d+)>/i.exec(it.note);
            if (m) {
                const type = parseLicenseType(m[1]);
                if (type != null) it.vcfLpBoost = {type, value: Number(m[2])};
            }
        });
    };

    function parseLicense(text) {
        if (!text) return 0;
        const idx = licenseNames.indexOf(text);
        return idx >= 0 ? idx : Number(text);
    }

    function parseLicenseType(text) {
        if (!text) return null;
        const idx = licenseTypes.indexOf(text);
        return idx >= 0 ? idx : null;
    }

    const _Game_Actor_setup = Game_Actor.prototype.setup;
    Game_Actor.prototype.setup = function(actorId) {
        _Game_Actor_setup.call(this, actorId);
        this._vcfLicenseRanks = Array(licenseTypes.length).fill(0);
        this._vcfLicensePoints = Array(licenseTypes.length).fill(0);
    };

    Game_Actor.prototype.licenseRank = function(type) {
        return this._vcfLicenseRanks[type ?? 0] || 0;
    };

    Game_Actor.prototype.licenseName = function(type) {
        return licenseNames[this.licenseRank(type)] || '';
    };

    Game_Actor.prototype.licensePoints = function(type) {
        return this._vcfLicensePoints[type ?? 0] || 0;
    };

    Game_Actor.prototype.addLicensePoints = function(type, amount) {
        if (type == null) return;
        this._vcfLicensePoints[type] = (this._vcfLicensePoints[type] || 0) + amount;
        while (this._vcfLicensePoints[type] >= threshold && this._vcfLicenseRanks[type] < licenseNames.length - 1) {
            this._vcfLicensePoints[type] -= threshold;
            this._vcfLicenseRanks[type]++;
        }
    };

    Game_Actor.prototype.setLicensePoints = function(type, value) {
        if (type == null) return;
        this._vcfLicensePoints[type] = Math.max(0, value);
    };

    Game_Actor.prototype.gainBattleLicense = function() {
        const w = this.weapons()[0];
        if (w) this.addLicensePoints(w.vcfLicenseType, 1);
    };

    Game_Actor.prototype.loseEscapeLicense = function() {
        const w = this.weapons()[0];
        if (w) {
            const type = w.vcfLicenseType;
            this._vcfLicensePoints[type] = Math.max(0, (this._vcfLicensePoints[type] || 0) - 1);
        }
    };

    const _Game_Actor_onBattleEnd = Game_Actor.prototype.onBattleEnd;
    Game_Actor.prototype.onBattleEnd = function() {
        _Game_Actor_onBattleEnd.call(this);
        this.gainBattleLicense();
    };

    Game_Actor.prototype.canDualWield = function() {
        return false;
    };

    const _Game_Actor_canEquip = Game_Actor.prototype.canEquip;
    Game_Actor.prototype.canEquip = function(item) {
        if (DataManager.isWeapon(item)) {
            const req = item.vcfRequiredLicense || 0;
            const type = item.vcfLicenseType;
            if (req > this.licenseRank(type)) return false;
        }
        return _Game_Actor_canEquip.call(this, item);
    };

    const _Game_Actor_paramPlus = Game_Actor.prototype.paramPlus;
    Game_Actor.prototype.paramPlus = function(paramId) {
        let value = _Game_Actor_paramPlus.call(this, paramId);
        this.weapons().forEach(w => {
            if (w && w.vcfAugments[paramId]) value += w.vcfAugments[paramId];
        });
        return value;
    };

    const _Game_BattlerBase_attackSkillId = Game_BattlerBase.prototype.attackSkillId;
    Game_BattlerBase.prototype.attackSkillId = function() {
        if (this.isActor()) {
            const w = this.weapons()[0];
            if (w && w.vcfMythic && w.vcfUnleashSkill) return w.vcfUnleashSkill;
        }
        return _Game_BattlerBase_attackSkillId.call(this);
    };

    const _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        _Game_Action_apply.call(this, target);
        if (this.isAttack() && this.subject().isActor()) {
            const w = this.subject().weapons()[0];
            if (w && w.vcfBleed) target.addState(w.vcfBleed);
        }
        const item = this.item();
        if (this.subject().isActor() && item && item.vcfLpBoost) {
            this.subject().addLicensePoints(item.vcfLpBoost.type, item.vcfLpBoost.value);
        }
    };

    PluginManager.registerCommand(pluginName, 'VCF_SET_LICENSE', args => {
        const actor = $gameActors.actor(Number(args.actorId));
        const type = parseLicenseType(args.type);
        if (!actor || type == null) return;
        const r = isNaN(args.rank) ? parseLicense(args.rank) : Number(args.rank);
        actor._vcfLicenseRanks[type] = Math.max(0, Math.min(licenseNames.length - 1, r));
        actor._vcfLicensePoints[type] = 0;
    });

    PluginManager.registerCommand(pluginName, 'VCF_ADD_LP', args => {
        const actor = $gameActors.actor(Number(args.actorId));
        const type = parseLicenseType(args.type);
        if (actor && type != null) actor.addLicensePoints(type, Number(args.amount));
    });

    PluginManager.registerCommand(pluginName, 'VCF_SET_LP', args => {
        const actor = $gameActors.actor(Number(args.actorId));
        const type = parseLicenseType(args.type);
        if (actor && type != null) actor.setLicensePoints(type, Number(args.value));
    });

    PluginManager.registerCommand(pluginName, 'VCF_BOOST_LP', args => {
        const actor = $gameActors.actor(Number(args.actorId));
        const type = parseLicenseType(args.type);
        if (actor && type != null) {
            const current = actor.licensePoints(type);
            actor.setLicensePoints(type, Math.floor(current * (1 + Number(args.percent) / 100)));
        }
    });

    PluginManager.registerCommand(pluginName, 'VCF_REMOVE_LP', args => {
        const actor = $gameActors.actor(Number(args.actorId));
        const type = parseLicenseType(args.type);
        if (actor && type != null) {
            actor.setLicensePoints(type, Math.max(0, actor.licensePoints(type) - Number(args.amount)));
        }
    });

    PluginManager.registerCommand(pluginName, 'VCF_RESET_LICENSE', args => {
        const actor = $gameActors.actor(Number(args.actorId));
        const type = parseLicenseType(args.type);
        if (actor && type != null) {
            actor._vcfLicenseRanks[type] = 0;
            actor._vcfLicensePoints[type] = 0;
        }
    });

    // --------------------------------------------------
    // LP HUD
    // --------------------------------------------------
    function Window_LicenseHud(rect) {
        Window_Base.call(this, rect);
        this.refresh();
    }
    Window_LicenseHud.prototype = Object.create(Window_Base.prototype);
    Window_LicenseHud.prototype.constructor = Window_LicenseHud;

    Window_LicenseHud.prototype.refresh = function() {
        this.contents.clear();
        const actor = $gameParty.leader();
        if (!actor) return;
        const w = actor.weapons()[0];
        if (!w) return;
        const type = w.vcfLicenseType;
        const name = licenseTypes[type] || 'Type';
        const pts = actor.licensePoints(type);
        const text = `${name} LP ${pts}/${threshold}`;
        this.drawText(text, 0, 0, this.contents.width);
    };

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this.createLicenseHud();
    };

    Scene_Map.prototype.createLicenseHud = function() {
        const rect = new Rectangle(0, 0, 200, this.calcWindowHeight(1, true));
        this._licenseHud = new Window_LicenseHud(rect);
        this.addWindow(this._licenseHud);
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (this._licenseHud) this._licenseHud.refresh();
    };

    const _BattleManager_processEscape = BattleManager.processEscape;
    BattleManager.processEscape = function() {
        const success = _BattleManager_processEscape.call(this);
        if (success) {
            $gameParty.members().forEach(a => a.loseEscapeLicense());
        }
        return success;
    };
})();
