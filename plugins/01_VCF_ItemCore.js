/*:
 * @target MZ
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
 *   - Recipe Books, Smithing Guides, and Armory Blueprints gate crafting.
 *   - Items may define <RepairCost:n> to charge gold when repaired.
 *   - Item, weapon, and armor storage for overflow inventory.
*
 * Plugin Commands:
 *   VCF_SET_DURABILITY itemId value  # Set current durability
 *   VCF_REPAIR itemId                # Restore durability to default
 *   VCF_CRAFT itemId                 # Craft item if materials present
 *   VCF_DISMANTLE itemId             # Break item down into materials
 *   VCF_ENHANCE itemId amount        # Increase enhancement level
 *   VCF_LEARN_BOOK id               # Learn a recipe book
 *   VCF_LEARN_GUIDE id              # Learn a smithing guide
 *   VCF_LEARN_BLUEPRINT id          # Learn an armory blueprint
 *   VCF_STORE type id amount        # Store item/weapon/armor
 *   VCF_RETRIEVE type id amount     # Retrieve from storage
 *   VCF_REPAIR_ALL                 # Repair all tracked equipment
*/

(function() {
    const pluginName = 'VCF_ItemCore';
    const params = PluginManager.parameters(pluginName);
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
            item.vcfRecipeBook = Number(item.meta.RecipeBook || 0);
            item.vcfSmithingGuide = Number(item.meta.SmithingGuide || 0);
            item.vcfBlueprint = Number(item.meta.ArmoryBlueprint || item.meta.Blueprint || 0);
            item.vcfRepairCost = Number(item.meta.RepairCost || 0);
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
        this._vcfRecipes = { books: [], guides: [], blueprints: [] };
        this._vcfStorage = { items: {}, weapons: {}, armors: {} };
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

    Game_Party.prototype.repairItem = function(itemId) {
        const def = this.defaultDurability(itemId);
        const item = $dataWeapons[itemId] || $dataArmors[itemId];
        if (!item || def <= 0) return;
        const cost = item.vcfRepairCost || 0;
        if ($gameParty.gold() >= cost) {
            this.loseGold(cost);
            this.setItemDurability(itemId, def);
        }
    };

    Game_Party.prototype.repairAll = function() {
        Object.keys(this._vcfDurability).forEach(id => this.repairItem(Number(id)));
    };

    Game_Party.prototype.itemEnhancement = function(itemId) {
        return this._vcfEnhance[itemId] || 0;
    };

    Game_Party.prototype.addEnhancement = function(itemId, amount) {
        this._vcfEnhance[itemId] = (this._vcfEnhance[itemId] || 0) + amount;
    };

    Game_Party.prototype.learnRecipeBook = function(id) {
        if (!this._vcfRecipes.books.includes(id)) this._vcfRecipes.books.push(id);
    };

    Game_Party.prototype.learnSmithingGuide = function(id) {
        if (!this._vcfRecipes.guides.includes(id)) this._vcfRecipes.guides.push(id);
    };

    Game_Party.prototype.learnBlueprint = function(id) {
        if (!this._vcfRecipes.blueprints.includes(id)) this._vcfRecipes.blueprints.push(id);
    };

    Game_Party.prototype.knowsRecipeFor = function(item) {
        if (item.vcfRecipeBook) return this._vcfRecipes.books.includes(item.vcfRecipeBook);
        if (item.vcfSmithingGuide) return this._vcfRecipes.guides.includes(item.vcfSmithingGuide);
        if (item.vcfBlueprint) return this._vcfRecipes.blueprints.includes(item.vcfBlueprint);
        return true;
    };

    Game_Party.prototype.storageContainer = function(item) {
        if (DataManager.isItem(item)) return this._vcfStorage.items;
        if (DataManager.isWeapon(item)) return this._vcfStorage.weapons;
        if (DataManager.isArmor(item)) return this._vcfStorage.armors;
        return null;
    };

    Game_Party.prototype.storeItem = function(item, amount) {
        const store = this.storageContainer(item);
        if (store) {
            store[item.id] = (store[item.id] || 0) + amount;
            this.loseItem(item, amount, false);
        }
    };

    Game_Party.prototype.retrieveItem = function(item, amount) {
        const store = this.storageContainer(item);
        if (store && store[item.id]) {
            const take = Math.min(store[item.id], amount);
            store[item.id] -= take;
            this.gainItem(item, take, false);
        }
    };

    // --------------------------------------------------
    // Plugin Commands (RPG Maker MZ)
    // --------------------------------------------------

    PluginManager.registerCommand(pluginName, 'VCF_SET_DURABILITY', args => {
        $gameParty.setItemDurability(Number(args.id), Number(args.value));
    });

    PluginManager.registerCommand(pluginName, 'VCF_REPAIR', args => {
        const def = $gameParty.defaultDurability(Number(args.id));
        $gameParty.setItemDurability(Number(args.id), def);
    });

    PluginManager.registerCommand(pluginName, 'VCF_REPAIR_ALL', () => {
        $gameParty.repairAll();
    });

    PluginManager.registerCommand(pluginName, 'VCF_CRAFT', args => {
        craftItem(Number(args.id));
    });

    PluginManager.registerCommand(pluginName, 'VCF_DISMANTLE', args => {
        dismantleItem(Number(args.id));
    });

    PluginManager.registerCommand(pluginName, 'VCF_ENHANCE', args => {
        $gameParty.addEnhancement(Number(args.id), Number(args.amount || 1));
    });

    PluginManager.registerCommand(pluginName, 'VCF_LEARN_BOOK', args => {
        $gameParty.learnRecipeBook(Number(args.id));
    });

    PluginManager.registerCommand(pluginName, 'VCF_LEARN_GUIDE', args => {
        $gameParty.learnSmithingGuide(Number(args.id));
    });

    PluginManager.registerCommand(pluginName, 'VCF_LEARN_BLUEPRINT', args => {
        $gameParty.learnBlueprint(Number(args.id));
    });

    PluginManager.registerCommand(pluginName, 'VCF_STORE', args => {
        storeRetrieveItem('store', [args.type, args.id, args.amount]);
    });

    PluginManager.registerCommand(pluginName, 'VCF_RETRIEVE', args => {
        storeRetrieveItem('retrieve', [args.type, args.id, args.amount]);
    });

    function craftItem(itemId) {
        const item = $dataItems[itemId] || $dataWeapons[itemId] || $dataArmors[itemId];
        if (!item) return;
        if (!$gameParty.knowsRecipeFor(item)) return;
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

    function storeRetrieveItem(mode, args) {
        const type = args[0];
        const id = Number(args[1]);
        const amt = Number(args[2] || 1);
        let item;
        if (type === 'item') item = $dataItems[id];
        else if (type === 'weapon') item = $dataWeapons[id];
        else if (type === 'armor') item = $dataArmors[id];
        if (!item) return;
        if (mode === 'store') $gameParty.storeItem(item, amt);
        else $gameParty.retrieveItem(item, amt);
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
            return item && item.vcfSynthesis && item.vcfSynthesis.length > 0 && $gameParty.knowsRecipeFor(item);
        }
        if (this._category === 'unique') {
            return item && item.vcfUniqueId;
        }
        return _Window_ItemList_includes.call(this, item);
    };
})();
