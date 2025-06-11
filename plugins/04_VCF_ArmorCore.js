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

    if (integrateEquip) {
        const _Window_MenuCommand_addMainCommands = Window_MenuCommand.prototype.addMainCommands;
        Window_MenuCommand.prototype.addMainCommands = function() {
            _Window_MenuCommand_addMainCommands.call(this);
            this._list = this._list.filter(cmd => cmd.symbol !== 'equip');
        };

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
})();
