/*:
 * @target MZ
 * @plugindesc VCF Weapon Core - Adds weapon license progression and mythic relic features.
 * @author VCF
 *
 * @param LicenseNames
 * @type string
 * @desc Comma separated list of license ranks in order.
 * @default Beginner,Adept,Advanced,Master,Prodigy
 *
 * @param LicenseThreshold
 * @type number
 * @desc Battles required to increase license rank.
 * @default 25
 *
 * @help
 * Weapons can require a license to equip with <RequiredLicense:Rank>.
 * Actors gain license ranks after a number of battles while wielding a weapon.
 * Mythic relics marked with <MythicRelic> and <UnleashSkill:id> replace the
 * normal attack with their Unleash skill.
 * Weapons may add stats via <AugmentATK:n>, <AugmentMHP:n>, etc, and cause a
 * bleed state with <Bleed:stateId>.
 *
 * Plugin Commands:
 *   VCF_SET_LICENSE actorId rank   # Set actor license rank by number or name
 */
(function() {
    const pluginName = 'VCF_WeaponCore';
    const params = PluginManager.parameters(pluginName);
    const licenseNames = (params['LicenseNames'] || 'Beginner,Adept,Advanced,Master,Prodigy')
        .split(',').map(n => n.trim());
    const threshold = Number(params['LicenseThreshold'] || 25);
    const augmentKeys = ['MHP','MMP','ATK','DEF','MAT','MDF','AGI','LUK'];

    const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        if (!_DataManager_isDatabaseLoaded.call(this)) return false;
        if (!this._vcfWeaponNotetags) {
            this.processVcfWeaponNotetags($dataWeapons);
            this._vcfWeaponNotetags = true;
        }
        return true;
    };

    DataManager.processVcfWeaponNotetags = function(group) {
        group.forEach(w => {
            if (!w) return;
            w.vcfRequiredLicense = parseLicense(w.meta.RequiredLicense);
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

    function parseLicense(text) {
        if (!text) return 0;
        const idx = licenseNames.indexOf(text);
        return idx >= 0 ? idx : Number(text);
    }

    const _Game_Actor_setup = Game_Actor.prototype.setup;
    Game_Actor.prototype.setup = function(actorId) {
        _Game_Actor_setup.call(this, actorId);
        this._vcfLicenseRank = 0;
        this._vcfLicenseBattles = 0;
    };

    Game_Actor.prototype.licenseRank = function() {
        return this._vcfLicenseRank || 0;
    };

    Game_Actor.prototype.licenseName = function() {
        return licenseNames[this.licenseRank()];
    };

    Game_Actor.prototype.increaseLicenseBattles = function() {
        if (!this.weapons()[0]) return;
        this._vcfLicenseBattles = (this._vcfLicenseBattles || 0) + 1;
        while (this._vcfLicenseBattles >= threshold && this._vcfLicenseRank < licenseNames.length - 1) {
            this._vcfLicenseBattles -= threshold;
            this._vcfLicenseRank++;
        }
    };

    const _Game_Actor_onBattleEnd = Game_Actor.prototype.onBattleEnd;
    Game_Actor.prototype.onBattleEnd = function() {
        _Game_Actor_onBattleEnd.call(this);
        this.increaseLicenseBattles();
    };

    Game_Actor.prototype.canDualWield = function() {
        return false;
    };

    const _Game_Actor_canEquip = Game_Actor.prototype.canEquip;
    Game_Actor.prototype.canEquip = function(item) {
        if (DataManager.isWeapon(item)) {
            const req = item.vcfRequiredLicense || 0;
            if (req > this.licenseRank()) return false;
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
    };

    PluginManager.registerCommand(pluginName, 'VCF_SET_LICENSE', args => {
        const actor = $gameActors.actor(Number(args.actorId));
        if (!actor) return;
        const r = isNaN(args.rank) ? parseLicense(args.rank) : Number(args.rank);
        actor._vcfLicenseRank = Math.max(0, Math.min(licenseNames.length - 1, r));
        actor._vcfLicenseBattles = 0;
    });
})();
