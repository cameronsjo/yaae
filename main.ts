import { Plugin } from 'obsidian';
import { YaaeSettings, DEFAULT_SETTINGS } from './src/types';

export default class YaaePlugin extends Plugin {
  settings: YaaeSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    console.log('Loading YAAE plugin');
  }

  onunload() {
    console.log('Unloading YAAE plugin');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
