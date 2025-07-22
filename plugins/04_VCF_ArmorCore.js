/*:
 * @target MZ
 * @plugindesc VCF Armor Core - Provides armor license progression and armor points.
 * @author VCF
 *
 * @param LicenseNames
 * @type string
 * @desc Comma separated list of armor license ranks.
 * @default Beginner,Adept,Advanced,Master,Prodigy
 *
 * @param LicenseTypes
 * @type string
 * @desc Comma separated list of armor license types.
 * @default Light,Medium,Heavy
 *
 * @param LicenseThreshold
 * @type number
 * @desc Battles required to increase armor license rank.
 * @default 25

 * @param AutoRegenAP
 * @type boolean
 * @desc Regenerate armor points to maximum after battle.
 * @default true
 *
 * @help
 * Armors can require a license rank with <RequiredAL:Rank> and specify
 * their license type with <ALType:Name>. Each armor may also define
 * <ArmorPoints:n> that act as a shield before HP is damaged. Actors gain
 * license points after battles based on their equipped armor. Skills can
 * tag damage types with <DamageType:PD>, <DamageType:BD>, or
 * <DamageType:SD>. Damage of these types first subtracts from armor points
 * before reducing HP. Running from battle decreases weapon license points
 * by one.
 *
 * Plugin Commands:
 *   VCF_RESTORE_AP actorId          # Refill actor's armor points
 */
(function() {
    const pluginName = 'VCF_ArmorCore';
    const params = PluginManager.parameters(pluginName);
    const licenseNames = (params['LicenseNames'] || 'Beginner,Adept,Advanced,Master,Prodigy').split(',').map(n=>n.trim());
    const licenseTypes = (params['LicenseTypes'] || 'Light,Medium,Heavy').split(',').map(t=>t.trim()).filter(t=>t);
    const threshold = Number(params['LicenseThreshold'] || 25);
    const autoRegen = params['AutoRegenAP'] !== 'false';
    const augmentKeys = ['MHP','MMP','ATK','DEF','MAT','MDF','AGI','LUK'];

    const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        if(!_DataManager_isDatabaseLoaded.call(this)) return false;
        if(!this._vcfArmorTags){
            this.processVcfArmorNotetags($dataArmors);
            this.processVcfDamageTypeNotetags($dataSkills);
            this.processVcfDamageTypeNotetags($dataItems);
            this._vcfArmorTags = true;
        }
        return true;
    };

    DataManager.processVcfArmorNotetags = function(group){
        group.forEach(a=>{
            if(!a) return;
            a.vcfRequiredLicense = parseLicense(a.meta.RequiredAL);
            a.vcfLicenseType = parseLicenseType(a.meta.ALType);
            if(a.vcfLicenseType==null) a.vcfLicenseType = 0;
            a.vcfAp = Number(a.meta.ArmorPoints||0);
            a.vcfAugments = {};
            augmentKeys.forEach((k,i)=>{
                const v = Number(a.meta['Augment'+k]||0);
                if(v) a.vcfAugments[i]=v;
            });
        });
    };

    DataManager.processVcfDamageTypeNotetags = function(group){
        group.forEach(s=>{
            if(!s) return;
            const type = (s.meta.DamageType||'').toUpperCase();
            if(['PD','BD','SD'].includes(type)) s.vcfDamageType = type;
        });
    };

    function parseLicense(text){
        if(!text) return 0;
        const idx = licenseNames.indexOf(text);
        return idx>=0?idx:Number(text);
    }
    function parseLicenseType(text){
        if(!text) return null;
        const idx = licenseTypes.indexOf(text);
        return idx>=0?idx:null;
    }

    const _Game_Actor_setup = Game_Actor.prototype.setup;
    Game_Actor.prototype.setup = function(actorId){
        _Game_Actor_setup.call(this, actorId);
        this._vcfArmorRanks = Array(licenseTypes.length).fill(0);
        this._vcfArmorPoints = Array(licenseTypes.length).fill(0);
        this._vcfAp = 0;
        this._vcfMaxAp = 0;
    };

    Game_Actor.prototype.armorRank = function(type){
        return this._vcfArmorRanks[type??0]||0;
    };
    Game_Actor.prototype.armorPointsProgress = function(type){
        return this._vcfArmorPoints[type??0]||0;
    };
    Game_Actor.prototype.addArmorLicensePoints = function(type, amt){
        if(type==null) return;
        this._vcfArmorPoints[type]=(this._vcfArmorPoints[type]||0)+amt;
        while(this._vcfArmorPoints[type]>=threshold && this._vcfArmorRanks[type]<licenseNames.length-1){
            this._vcfArmorPoints[type]-=threshold;
            this._vcfArmorRanks[type]++;
        }
    };
    Game_Actor.prototype.setArmorLicensePoints = function(type,val){
        if(type==null) return;
        this._vcfArmorPoints[type]=Math.max(0,val);
    };

    Game_Actor.prototype.refreshArmorPoints = function(){
        let max=0;
        this.armors().forEach(a=>{ if(a) max += a.vcfAp||0; });
        this._vcfMaxAp = max;
        if(this._vcfAp>max) this._vcfAp = max;
        if(this._vcfAp==null) this._vcfAp = max;
    };

    Game_Actor.prototype.ap = function(){ return this._vcfAp||0; };
    Game_Actor.prototype.maxAp = function(){ return this._vcfMaxAp||0; };
    Game_Actor.prototype.setAp = function(value){ this._vcfAp = Math.max(0, Math.min(this.maxAp(), value)); };

    const _Game_Actor_refresh = Game_Actor.prototype.refresh;
    Game_Actor.prototype.refresh = function(){
        _Game_Actor_refresh.call(this);
        this.refreshArmorPoints();
    };

    Game_Actor.prototype.gainArmorLicense = function(){
        const a = this.armors()[0];
        if(a) this.addArmorLicensePoints(a.vcfLicenseType,1);
    };

    const _Game_Actor_onBattleEnd = Game_Actor.prototype.onBattleEnd;
    Game_Actor.prototype.onBattleEnd = function(){
        _Game_Actor_onBattleEnd.call(this);
        this.gainArmorLicense();
        if (autoRegen) this.setAp(this.maxAp());
    };

    const _Game_Actor_canEquip = Game_Actor.prototype.canEquip;
    Game_Actor.prototype.canEquip = function(item){
        if(DataManager.isArmor(item)){
            const req = item.vcfRequiredLicense||0;
            const type = item.vcfLicenseType;
            if(req>this.armorRank(type)) return false;
        }
        return _Game_Actor_canEquip.call(this,item);
    };

    const _Game_Actor_paramPlus = Game_Actor.prototype.paramPlus;
    Game_Actor.prototype.paramPlus = function(paramId){
        let v = _Game_Actor_paramPlus.call(this,paramId);
        this.armors().forEach(a=>{ if(a&&a.vcfAugments[paramId]) v += a.vcfAugments[paramId]; });
        return v;
    };

    // absorb armor points on damage
    const _Game_Action_executeHpDamage = Game_Action.prototype.executeHpDamage;
    Game_Action.prototype.executeHpDamage = function(target, value){
        if(target.isActor() && value>0){
            const type = this.item().vcfDamageType;
            if(type && ['PD','BD','SD'].includes(type)){
                const apLoss = Math.min(target.ap(), value);
                target.setAp(target.ap() - apLoss);
                value -= apLoss;
            }
        }
        _Game_Action_executeHpDamage.call(this,target,value);
    };

    PluginManager.registerCommand(pluginName, 'VCF_RESTORE_AP', args => {
        const actor = $gameActors.actor(Number(args.actorId));
        if (actor) actor.setAp(actor.maxAp());
    });

})();
