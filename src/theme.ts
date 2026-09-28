import type { IonicConfig } from '@ionic/core/components';
import type { AnimationPosition } from './sheets-of-glass.js';

export const cloneElement = (tagName: string, useCache: boolean = true): HTMLElement => {
  if (useCache) {
    const cachedElement = document.querySelector(`${tagName}.ion-cloned-element`);
    if (cachedElement !== null) return cachedElement as HTMLElement;
  }
  const clonedEl = document.createElement(tagName);
  clonedEl.classList.add('ion-cloned-element');
  clonedEl.style.setProperty('display', 'none');
  document.body.appendChild(clonedEl);
  return clonedEl;
};

export const getStep = (targetX: number, position: AnimationPosition) => {
  const currentX = targetX - position.width / 2;
  return Math.max(0, Math.min(1, (currentX - position.minPositionX) / (position.maxPositionX - position.minPositionX)));
};

export const changeSelectedElement = (target: HTMLElement, selected: HTMLElement, tagName: string, selectedClass: string): void => {
  target.querySelectorAll(tagName).forEach((element) => {
    element.classList.remove(selectedClass, 'ion-activated');
  });
  selected.classList.add('ion-activated');
};

export class Config {
  private values = new Map<keyof IonicConfig, unknown>();
  reset(config: IonicConfig) {
    this.values = new Map(Object.entries(config) as [keyof IonicConfig, unknown][]);
  }
  get<T = unknown>(key: keyof IonicConfig, fallback?: T): T {
    const value = this.values.get(key);
    return (value !== undefined ? value : fallback) as T;
  }
  getBoolean(key: keyof IonicConfig, fallback = false): boolean {
    const value = this.values.get(key);
    if (value === undefined) return fallback;
    return typeof value === 'string' ? value === 'true' : !!value;
  }
  getNumber(key: keyof IonicConfig, fallback?: number): number {
    const value = Number.parseFloat(String(this.values.get(key)));
    return Number.isNaN(value) ? (fallback ?? Number.NaN) : value;
  }
  set(key: keyof IonicConfig, value: unknown) {
    this.values.set(key, value);
  }
}

export const config = /* @__PURE__ */ new Config();
