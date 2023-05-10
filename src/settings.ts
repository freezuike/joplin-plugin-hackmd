import joplin from 'api';
import { SettingStorage, SettingItem, SettingItemType } from 'api/types';

export default class Settings {
    private static readonly sectionName = "HackMD";
    public static readonly tokenField = "token";
    public static readonly urlField = "url";

    private static settingsItems: Record<string, SettingItem> = {
        [Settings.tokenField]: {
            type: SettingItemType.String,
            label: "HackMD token",
            value: "",
            public: true,
            secure: true,
            storage: SettingStorage.Database,
            section: Settings.sectionName
        },
        [Settings.urlField]: {
            type: SettingItemType.String,
            label: "HackMD url",
            value: "https://api.hackmd.io/v1",
            public: true,
            section: Settings.sectionName
        }
    };

    static async init() {
        await Settings.registerSection();
        Settings.registerSettings();
    }

    private static async registerSection() {
        await joplin.settings.registerSection("HackMD", {
            label: "HackMD sync",
            name: Settings.sectionName
        });
        console.debug("Settings section registered");
    }

    private static async registerSettings() {
        await joplin.settings.registerSettings(Settings.settingsItems);
        console.debug("Settings registered");
    }

    public static async getToken() {
        return joplin.settings.value(Settings.tokenField);
    }
    public static async getUrl() {
        return joplin.settings.value(Settings.urlField);
    }
}