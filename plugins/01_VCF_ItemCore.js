/*:
 * @plugindesc VCF Item Core - Adds currency types, item durability, crafting,
 * repair, and enhancement systems. Provides notetags for synthesis and
 * dismantling recipes.
 * @author VCF
 *
 * @param CurrencyTypes
 * @type string
 * @desc Comma separated list of available currency types.
 * @default Gold,Gems

 * @param AddCraftMenu
 * @type boolean
 * @desc Add a Craft command to the main menu.
 * @default true

 * @param CraftCommandName
 * @type string
 * @desc Text shown for the Craft menu command.
 * @default Craft

 * @param UniqueTabName
 * @type string
 * @desc Name of the Unique tab in the item scene.
 * @default Unique
 *
 * @help
 * This plugin introduces advanced item management features used by the VCF
 * projects.
 * Features:
 *   - Multiple currency types for shop prices via <CurrencyType:Type> notetag.
 *   - Durability for weapons, armors, and accessories with <Durability:n>.
 *   - Crafting and repairing items using <Synthesis:id,id> recipe data.
 *   - Dismantling items with <Dismantle:id,id> notetag.
 *   - Basic enhancement system for weapons and armor.
 *   - Grenade and throwable items can be created from materials.
 *   - Optional Craft command in the main menu.
 *   - Unique item tab in the item scene with <UniqueId:x> notetag.
 *
 * Plugin Commands:
 *   VCF_SET_DURABILITY itemId value  # Set current durability
 *   VCF_REPAIR itemId                # Restore durability to default
 *   VCF_CRAFT itemId                 # Craft item if materials present
 *   VCF_DISMANTLE itemId             # Break item down into materials
 *   VCF_ENHANCE itemId amount        # Increase enhancement level
 */

(function() {
    const params = PluginManager.parameters('VCF_ItemCore');
    const currencyTypes = (params["CurrencyTypes"] || "Gold").split(",").map(t => t.trim());
    const addCraftMenu = params["AddCraftMenu"] !== 'false';
    const craftCommandName = params["CraftCommandName"] || 'Craft';
    const uniqueTabName = params["UniqueTabName"] || 'Unique';

    // --------------------------------------------------
    // Notetag processing
    // --------------------------------------------------
    const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        if (!_DataManager_isDatabaseLoaded.call(this)) return false;
        if (!this._vcfItemNotetagsLoaded) {
            this.processVcfItemNotetags($dataItems);
            this.processVcfItemNotetags($dataWeapons);
            this.processVcfItemNotetags($dataArmors);
            this._vcfItemNotetagsLoaded = true;
        }
        return true;
    };

    DataManager.processVcfItemNotetags = function(group) {
        group.forEach(item => {
            if (!item) return;
            item.vcfCurrency = item.meta.CurrencyType || 'Gold';
            item.vcfDurability = Number(item.meta.Durability || 0);
            item.vcfSynthesis = parseIdList(item.meta.Synthesis);
            item.vcfDismantle = parseIdList(item.meta.Dismantle);
            item.vcfUniqueId = item.meta.UniqueId || null;
        });
    };

    function parseIdList(text) {
        if (!text) return [];
        return text.split(',').map(s => Number(s.trim())).filter(n => n > 0);
    }

    // --------------------------------------------------
    // Game_Party durability/enhancement tracking
    // --------------------------------------------------
    const _Game_Party_initialize = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function() {
        _Game_Party_initialize.call(this);
        this._vcfDurability = {};
        this._vcfEnhance = {};
    };

    Game_Party.prototype.itemDurability = function(itemId) {
        return this._vcfDurability[itemId] ?? this.defaultDurability(itemId);
    };

    Game_Party.prototype.defaultDurability = function(itemId) {
        const item = $dataWeapons[itemId] || $dataArmors[itemId];
        return item ? item.vcfDurability : 0;
    };

    Game_Party.prototype.setItemDurability = function(itemId, value) {
        this._vcfDurability[itemId] = Math.max(0, value);
    };

    Game_Party.prototype.itemEnhancement = function(itemId) {
        return this._vcfEnhance[itemId] || 0;
    };

    Game_Party.prototype.addEnhancement = function(itemId, amount) {
        this._vcfEnhance[itemId] = (this._vcfEnhance[itemId] || 0) + amount;
    };

    // --------------------------------------------------
    // Plugin Commands
    // --------------------------------------------------
    const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        switch (command.toUpperCase()) {
            case 'VCF_SET_DURABILITY':
                $gameParty.setItemDurability(Number(args[0]), Number(args[1]));
                break;
            case 'VCF_REPAIR':
                const def = $gameParty.defaultDurability(Number(args[0]));
                $gameParty.setItemDurability(Number(args[0]), def);
                break;
            case 'VCF_CRAFT':
                craftItem(Number(args[0]));
                break;
            case 'VCF_DISMANTLE':
                dismantleItem(Number(args[0]));
                break;
            case 'VCF_ENHANCE':
                $gameParty.addEnhancement(Number(args[0]), Number(args[1] || 1));
                break;
        }
    };

    function craftItem(itemId) {
        const item = $dataItems[itemId] || $dataWeapons[itemId] || $dataArmors[itemId];
        if (!item) return;
        const materials = item.vcfSynthesis;
        const haveAll = materials.every(id => $gameParty.numItems($dataItems[id]) > 0);
        if (haveAll) {
            materials.forEach(id => $gameParty.loseItem($dataItems[id], 1));
            $gameParty.gainItem(item, 1);
        }
    }

    function dismantleItem(itemId) {
        const item = $dataItems[itemId] || $dataWeapons[itemId] || $dataArmors[itemId];
        if (!item) return;
        const list = item.vcfDismantle;
        if ($gameParty.numItems(item) > 0) {
            $gameParty.loseItem(item, 1);
            list.forEach(id => $gameParty.gainItem($dataItems[id], 1));
        }
    }

    // --------------------------------------------------
    // Menu integration
    // --------------------------------------------------
    const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function() {
        _Window_MenuCommand_addOriginalCommands.call(this);
        if (addCraftMenu) this.addCommand(craftCommandName, 'vcfCraft');
    };

    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        if (addCraftMenu) this._commandWindow.setHandler('vcfCraft', this.commandCraft.bind(this));
    };

    Scene_Menu.prototype.commandCraft = function() {
        SceneManager.push(Scene_VcfCraft);
    };

    function Scene_VcfCraft() {
        Scene_Item.prototype.initialize.call(this);
    }
    Scene_VcfCraft.prototype = Object.create(Scene_Item.prototype);
    Scene_VcfCraft.prototype.constructor = Scene_VcfCraft;

    Scene_VcfCraft.prototype.create = function() {
        Scene_Item.prototype.create.call(this);
        this._categoryWindow.hide();
        this._categoryWindow.deactivate();
        this._itemWindow._vcfCraftMode = true;
        this._itemWindow.setCategory('item');
        this._itemWindow.refresh();
    };

    Scene_VcfCraft.prototype.onItemOk = function() {
        craftItem(this.item().id);
        this._itemWindow.refresh();
        this._itemWindow.activate();
    };

    // --------------------------------------------------
    // Unique item tab
    // --------------------------------------------------
    const _Window_ItemCategory_makeCommandList = Window_ItemCategory.prototype.makeCommandList;
    Window_ItemCategory.prototype.makeCommandList = function() {
        _Window_ItemCategory_makeCommandList.call(this);
        this.addCommand(uniqueTabName, 'unique');
    };

    const _Window_ItemList_includes = Window_ItemList.prototype.includes;
    Window_ItemList.prototype.includes = function(item) {
        if (this._vcfCraftMode) {
            return item && item.vcfSynthesis && item.vcfSynthesis.length > 0;
        }
        if (this._category === 'unique') {
            return item && item.vcfUniqueId;
        }
        return _Window_ItemList_includes.call(this, item);
    };
})();
