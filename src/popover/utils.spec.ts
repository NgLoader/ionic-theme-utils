import { describe, expect, it } from 'vitest';

import { calculateWindowAdjustment, getIndexOfItem, getNextItem, getPopoverPosition, getPrevItem } from './utils.js';

describe('popover utilities', () => {
  it('navigates only relative to ion-item elements', () => {
    const items = [document.createElement('ion-item'), document.createElement('ion-item')] as HTMLIonItemElement[];

    expect(getIndexOfItem(items, items[0])).toBe(0);
    expect(getIndexOfItem(items, document.createElement('div'))).toBe(-1);
    expect(getNextItem(items, items[0])).toBe(items[1]);
    expect(getPrevItem(items, items[1])).toBe(items[0]);
  });

  it('keeps a popover inside the left safe-area boundary', () => {
    expect(calculateWindowAdjustment('bottom', 20, -10, 16, 390, 844, 280, 140, 8, 'center', 'top')).toMatchObject({
      top: 28,
      left: 16,
      originX: 'left',
      checkSafeAreaLeft: true,
      checkSafeAreaRight: false,
    });
  });

  it('keeps a popover inside the right safe-area boundary', () => {
    expect(calculateWindowAdjustment('bottom', 20, 150, 16, 390, 844, 280, 140, 8, 'center', 'top')).toMatchObject({
      top: 28,
      left: 94,
      originX: 'right',
      checkSafeAreaLeft: false,
      checkSafeAreaRight: true,
    });
  });

  it.each([
    { isRTL: false, side: 'start' as const, left: 60, originX: 'right' },
    { isRTL: false, side: 'end' as const, left: 140, originX: 'left' },
    { isRTL: true, side: 'start' as const, left: 140, originX: 'left' },
    { isRTL: true, side: 'end' as const, left: 60, originX: 'right' },
  ])('maps the logical $side side in RTL=$isRTL', ({ isRTL, side, left, originX }) => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () => ({
      top: 20,
      left: 100,
      width: 40,
      height: 30,
      right: 140,
      bottom: 50,
      x: 100,
      y: 20,
      toJSON: () => ({}),
    });

    expect(
      getPopoverPosition(isRTL, 40, 20, 'trigger', side, 'start', { top: 0, left: 0, originX: 'left', originY: 'top' }, trigger),
    ).toMatchObject({ left, originX });
  });
});
