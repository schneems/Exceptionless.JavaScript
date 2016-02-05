import { IStorage } from './IStorage';
import { IStorageItem } from './IStorageItem';

interface IndexEntry {
  name: string;
  timestamp: number;
}

export abstract class KeyValueStorageBase implements IStorage {
  private maxItems: number;
  private timestamp: number;
  private index: IndexEntry[];

  constructor(maxItems) {
    this.maxItems = maxItems;
  }

  save(path: string, value: any): boolean {
    if (!path || !value) {
      return false;
    }

    this.ensureIndex();

    this.remove(path);
    let entry = { name: path, timestamp: ++this.timestamp };
    this.index.push(entry);
    let key = this.getKey(entry);
    let json = JSON.stringify(value);
    this.write(key, json);

    return true;
  }

  get(path: string): any {
    try {

      this.ensureIndex();

      let entry = this.findEntry(path);
      if (!entry) {
        return null;
      }

      let fullPath = this.getKey(entry);
      let json = this.read(fullPath);
      return JSON.parse(json, parseDate);
    } catch (e) {
      return null;
    }
  }

  getList(searchPattern?: string, limit?: number): IStorageItem[] {
    this.ensureIndex();
    let entries = this.index;

    if (searchPattern) {
      let regex = new RegExp(searchPattern);
      entries = entries.filter(entry => regex.test(entry.name));
    }

    if (entries.length > this.maxItems) {
      entries = entries.slice(entries.length - this.maxItems);
    }

    if (entries.length > limit) {
      entries = entries.slice(0, limit);
    }

    let items = entries.map(e => this.loadEntry(e));
    return items;
  }

  remove(path: string): void {
    try {
      this.ensureIndex();
      let entry = this.findEntry(path);
      if (!entry) {
        return null;
      }

      let key = this.getKey(entry);
      this.delete(key);
      this.removeEntry(entry);
    } catch (e) { }
  }

  protected abstract write(key: string, value: string): void;

  protected abstract read(key: string): string;

  protected abstract readDate(key: string): number;

  protected abstract delete(key: string);

  protected abstract getEntries(): string[];

  protected getKey(entry: {name: string, timestamp: number}): string {
    return entry.name + '__' + entry.timestamp;
  }

  protected getEntry(encodedEntry: string): { name: string, timestamp: number } {
    let parts = encodedEntry.split('__');
    return {
      name: parts[0],
      timestamp: parseInt(parts[1], 10)
    };
  }

  private ensureIndex() {
    if (!this.index) {
      this.index = this.createIndex();
      this.timestamp = this.index.length > 0
        ? this.index[this.index.length - 1].timestamp
        : 0;
    }
  }

  private loadEntry(entry: IndexEntry) {
    let key = this.getKey(entry);
    let created = this.readDate(key);
    let json = this.read(key);
    let value = JSON.parse(json, parseDate);
    return {
      created: created,
      path: entry.name,
      value
    };
  }

  private findEntry(path: string) {
    for (let i = this.index.length - 1; i >= 0; i--) {
      if (this.index[i].name === path) {
        return this.index[i];
      }
    }
    return null;
  }

  private removeEntry(entry: IndexEntry) {
    let i = this.index.indexOf(entry);
    if (i > -1) {
      this.index.splice(i, 1);
    }
  }

  private createIndex() {
    let keys = this.getEntries();
    return keys
      .map(key => this.getEntry(key))
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}

function parseDate(key, value) {
  let dateRegx = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/g;
  if (typeof value === 'string') {
    let a = dateRegx.exec(value);
    if (a) {
      return new Date(value);
    }
  }
  return value;
};
