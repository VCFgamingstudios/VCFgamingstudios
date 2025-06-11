/*:
 * @target MZ
 * @plugindesc VCF Party Core - Adjust max party size and customize the menu layout.
 * @author VCF
 *
 * @param MaxPartyMembers
 * @type number
 * @min 1
 * @max 16
 * @desc Default maximum number of party members.
 * @default 4
 *
 * @param ShowSave
 * @type boolean
 * @desc Display the Save command in the main menu.
 * @default true
 *
 * @param ShowEndGame
 * @type boolean
 * @desc Display the Game End command in the main menu.
 * @default true
 *
 * @param IntegrateEquip
 * @type boolean
 * @desc Move the Equip command inside the Item scene.
 * @default true
 *
 * @param MenuFontFace
 * @type string
 * @desc Font face used for menu windows.
 * @default GameFont
 *
 * @param MenuFontSize
 * @type number
 * @desc Font size for menu windows.
 * @default 20
 *
 * @param MenuBoxWidth
 * @type number
 * @desc Width of menu command windows.
 * @default 240
 *
 * @param MenuBoxHeight
 * @type number
 * @desc Height of each command row.
 * @default 36
 *
 * @param MenuBgColor
 * @type string
 * @desc Background color of menu scenes in CSS format.
 * @default #000000

 * @param IntegrateInventory
 * @type boolean
 * @desc Show the Inventory command inside the Item scene instead of on the main menu.
 * @default true

 * @param InventoryCommand
 * @type string
 * @desc Text used for the Inventory command.
 * @default Inventory

 * @param OverlayImage
 * @type file
 * @dir img/pictures
 * @desc Optional overlay graphic drawn on menu scenes.

 * @param OverlayX
 * @type number
 * @desc X position of the overlay graphic.
 * @default 0

 * @param OverlayY
 * @type number
 * @desc Y position of the overlay graphic.
 * @default 0

 * @param OverlayZ
 * @type number
 * @desc Z order of the overlay graphic.
 * @default 1

 * @param OverlayScale
 * @type number
 * @decimals 2
 * @desc Scale factor for the overlay graphic.
 * @default 1
 *
 * @help
 * This plugin lets you increase the battle party size up to 16 members and
 * overhaul the look of the menu. The Save and Game End commands can be hidden
 * and the Equip command can be moved into the Item scene instead of appearing
 * on the main menu.
 *
 * Plugin Commands:
 *   VCF_SET_PARTY_SIZE n        # Change the party battle member limit
 */
(function() {
    const pluginName = 'VCF_PartyCoreEngine';
    const params = PluginManager.parameters(pluginName);
    const maxMembers = Math.min(16, Math.max(1, Number(params['MaxPartyMembers'] || 4)));
    const showSave = params['ShowSave'] !== 'false';
    const showEnd = params['ShowEndGame'] !== 'false';
    const integrateEquip = params['IntegrateEquip'] !== 'false';
    const fontFace = params['MenuFontFace'] || 'GameFont';
    const fontSize = Number(params['MenuFontSize'] || 20);
    const menuWidth = Number(params['MenuBoxWidth'] || 240);
const menuRowHeight = Number(params['MenuBoxHeight'] || 36);
const menuBgColor = params['MenuBgColor'] || '#000000';
const integrateInventory = params['IntegrateInventory'] !== 'false';
const inventoryName = params['InventoryCommand'] || 'Inventory';
const overlayImage = params['OverlayImage'] || '';
const overlayX = Number(params['OverlayX'] || 0);
const overlayY = Number(params['OverlayY'] || 0);
const overlayZ = Number(params['OverlayZ'] || 1);
const overlayScale = Number(params['OverlayScale'] || 1);

    // --------------------------------------------------
    // Party size
    // --------------------------------------------------
    const _Game_Party_initialize = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function() {
        _Game_Party_initialize.call(this);
        this._vcfMaxMembers = maxMembers;
    };

    Game_Party.prototype.maxBattleMembers = function() {
        return this._vcfMaxMembers;
    };

    Game_Party.prototype.setMaxBattleMembers = function(n) {
        this._vcfMaxMembers = Math.min(16, Math.max(1, Number(n) || maxMembers));
    };

    PluginManager.registerCommand(pluginName, 'VCF_SET_PARTY_SIZE', args => {
        $gameParty.setMaxBattleMembers(Number(args.n || args.size || maxMembers));
    });

    // --------------------------------------------------
    // Menu appearance
    // --------------------------------------------------
    const _Window_Base_standardFontFace = Window_Base.prototype.standardFontFace;
    Window_Base.prototype.standardFontFace = function() {
        if (SceneManager._scene instanceof Scene_MenuBase) {
            return fontFace;
        }
        return _Window_Base_standardFontFace.call(this);
    };

    const _Window_Base_standardFontSize = Window_Base.prototype.standardFontSize;
    Window_Base.prototype.standardFontSize = function() {
        if (SceneManager._scene instanceof Scene_MenuBase) {
            return fontSize;
        }
        return _Window_Base_standardFontSize.call(this);
    };

    const _Window_MenuCommand_windowWidth = Window_MenuCommand.prototype.windowWidth;
    Window_MenuCommand.prototype.windowWidth = function() {
        return menuWidth;
    };

    Window_MenuCommand.prototype.itemHeight = function() {
        return menuRowHeight;
    };

    const _Scene_MenuBase_createBackground = Scene_MenuBase.prototype.createBackground;
    Scene_MenuBase.prototype.createBackground = function() {
        _Scene_MenuBase_createBackground.call(this);
        if (menuBgColor) {
            const sprite = new Sprite(new Bitmap(Graphics.width, Graphics.height));
            sprite.bitmap.fillAll(menuBgColor);
            this.addChildAt(sprite, 0);
        }
        if (overlayImage) {
            const overlay = new Sprite(ImageManager.loadPicture(overlayImage));
            overlay.move(overlayX, overlayY);
            overlay.scale.x = overlay.scale.y = overlayScale;
            this.addChildAt(overlay, overlayZ);
        }
    };

    // --------------------------------------------------
    // Menu commands
    // --------------------------------------------------
    const _Window_MenuCommand_addSaveCommand = Window_MenuCommand.prototype.addSaveCommand;
    Window_MenuCommand.prototype.addSaveCommand = function() {
        if (showSave) _Window_MenuCommand_addSaveCommand.call(this);
    };

    const _Window_MenuCommand_addGameEndCommand = Window_MenuCommand.prototype.addGameEndCommand;
    Window_MenuCommand.prototype.addGameEndCommand = function() {
        if (showEnd) _Window_MenuCommand_addGameEndCommand.call(this);
    };

    const _Window_MenuCommand_addMainCommands = Window_MenuCommand.prototype.addMainCommands;
    Window_MenuCommand.prototype.addMainCommands = function() {
        _Window_MenuCommand_addMainCommands.call(this);
        if (integrateEquip) {
            this._list = this._list.filter(cmd => cmd.symbol !== 'equip');
        }
        if (!integrateInventory) {
            this.addCommand(inventoryName, 'vcfInventory');
        }
    };

    if (integrateInventory === false) {
        const _Scene_Menu_createCommandWindow2 = Scene_Menu.prototype.createCommandWindow;
        Scene_Menu.prototype.createCommandWindow = function() {
            _Scene_Menu_createCommandWindow2.call(this);
            this._commandWindow.setHandler('vcfInventory', this.commandInventory.bind(this));
        };
    }

    if (integrateInventory) {
        const _Scene_Item_createInv = Scene_Item.prototype.create;
        Scene_Item.prototype.create = function() {
            _Scene_Item_createInv.call(this);
            this.createInventoryCommand();
        };

        Scene_Item.prototype.createInventoryCommand = function() {
            const rect = this.inventoryCommandWindowRect();
            this._inventoryCommandWindow = new Window_Command(rect);
            this._inventoryCommandWindow.setHandler('inventory', this.commandInventory.bind(this));
            this._inventoryCommandWindow.setHandler('cancel', this.onInventoryCancel.bind(this));
            this._inventoryCommandWindow.addCommand(inventoryName, 'inventory');
            this.addWindow(this._inventoryCommandWindow);
        };

        Scene_Item.prototype.inventoryCommandWindowRect = function() {
            const ww = 160;
            const wh = this.calcWindowHeight(1, true);
            const wx = Graphics.boxWidth - ww;
            let wy = this._categoryWindow.y;
            if (this._equipCommandWindow) wy += this._equipCommandWindow.height;
            return new Rectangle(wx, wy, ww, wh);
        };

        Scene_Item.prototype.onInventoryCancel = function() {
            this._inventoryCommandWindow.close();
            this._inventoryCommandWindow.deactivate();
            this.activateItemWindow();
        };
    }

    if (integrateEquip) {
        const _Scene_Menu_commandItem = Scene_Menu.prototype.commandItem;
        Scene_Menu.prototype.commandItem = function() {
            _Scene_Menu_commandItem.call(this);
            if (this._commandWindow && !this._commandWindow.currentExt()) {
                SceneManager.push(Scene_Equip);
            }
        };

        const _Scene_Item_create = Scene_Item.prototype.create;
        Scene_Item.prototype.create = function() {
            _Scene_Item_create.call(this);
            this.createEquipCommand();
        };

        Scene_Item.prototype.createEquipCommand = function() {
            const rect = this.equipCommandWindowRect();
            this._equipCommandWindow = new Window_Command(rect);
            this._equipCommandWindow.setHandler('equip', this.commandEquip.bind(this));
            this._equipCommandWindow.setHandler('cancel', this.onEquipCancel.bind(this));
            this._equipCommandWindow.addCommand(TextManager.equip, 'equip');
            this.addWindow(this._equipCommandWindow);
        };

        Scene_Item.prototype.equipCommandWindowRect = function() {
            const ww = 160;
            const wh = this.calcWindowHeight(1, true);
            const wx = Graphics.boxWidth - ww;
            const wy = this._categoryWindow.y;
            return new Rectangle(wx, wy, ww, wh);
        };

        Scene_Item.prototype.commandEquip = function() {
            SceneManager.push(Scene_Equip);
        };

        Scene_Item.prototype.onEquipCancel = function() {
            this._equipCommandWindow.close();
            this._equipCommandWindow.deactivate();
            this.activateItemWindow();
        };
    }

    Scene_Menu.prototype.commandInventory = function() {
        SceneManager.push(Scene_VcfInventory);
    };

    Scene_Item.prototype.commandInventory = function() {
        SceneManager.push(Scene_VcfInventory);
    };

    function Scene_VcfInventory() {
        Scene_Item.prototype.initialize.call(this);
    }
    Scene_VcfInventory.prototype = Object.create(Scene_Item.prototype);
    Scene_VcfInventory.prototype.constructor = Scene_VcfInventory;

    Scene_VcfInventory.prototype.create = function() {
        Scene_Item.prototype.create.call(this);
        this._categoryWindow.hide();
        this._categoryWindow.deactivate();
        this._itemWindow._vcfInventoryMode = true;
        this._itemWindow.refresh();
    };

    Scene_VcfInventory.prototype.onItemOk = function() {
        const item = this.item();
        $gameParty.retrieveItem(item, 1);
        this._itemWindow.refresh();
        this._itemWindow.activate();
    };

    const _Window_ItemList_makeItemList = Window_ItemList.prototype.makeItemList;
    Window_ItemList.prototype.makeItemList = function() {
        if (this._vcfInventoryMode) {
            this._data = [];
            const store = $gameParty._vcfStorage;
            Object.keys(store.items).forEach(id => { if (store.items[id] > 0) this._data.push($dataItems[id]); });
            Object.keys(store.weapons).forEach(id => { if (store.weapons[id] > 0) this._data.push($dataWeapons[id]); });
            Object.keys(store.armors).forEach(id => { if (store.armors[id] > 0) this._data.push($dataArmors[id]); });
            this._data.push(null);
        } else {
            _Window_ItemList_makeItemList.call(this);
        }
    };

    const _Window_ItemList_drawItemNumber = Window_ItemList.prototype.drawItemNumber;
    Window_ItemList.prototype.drawItemNumber = function(item, x, y, width) {
        if (this._vcfInventoryMode) {
            const store = $gameParty.storageContainer(item);
            const num = store && store[item.id] ? store[item.id] : 0;
            this.drawText('x' + num, x, y, width, 'right');
        } else {
            _Window_ItemList_drawItemNumber.call(this, item, x, y, width);
        }
    };
})();
