import { useState } from 'react';

/** Свёрнуто / раскрыто, с памятью между запусками (как «Счета» на «Сегодня»). */
export function useRememberedOpen(key: string, initial = false): [boolean, (v: boolean) => void] {
  const [open, setOpenState] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : v === '1';
    } catch {
      return initial;
    }
  });
  const setOpen = (v: boolean) => {
    setOpenState(v);
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      // приватный режим — просто не запоминаем
    }
  };
  return [open, setOpen];
}
