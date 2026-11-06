import { describe, expect, it } from 'vitest';
import { migrateColor, migrateColors } from './colorMigration';

describe('цвета → токены (v7)', () => {
  it('старая палитра переводится в имена токенов, регистр hex не важен', () => {
    expect(migrateColor('#2448D6')).toBe('blue');
    expect(migrateColor('#0b7a4b')).toBe('green');
    expect(migrateColor('#5B6170')).toBe('slate');
  });
  it('имя токена и незнакомый hex остаются как есть', () => {
    expect(migrateColor('rose')).toBe('rose');
    expect(migrateColor('#123456')).toBe('#123456');
  });
  it('migrateColors отдаёт только изменившиеся записи', () => {
    const rows = [
      { id: 'a', color: '#BE185D' },
      { id: 'b', color: 'teal' },
    ];
    expect(migrateColors(rows)).toEqual([{ id: 'a', color: 'rose' }]);
  });
});
