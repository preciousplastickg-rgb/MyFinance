import { createContext } from 'react';

/** false на соседних страницах ленты: они смонтированы заранее, но не «открыты» — не объявляют «+» и т. п. */
export const PaneActiveContext = createContext(true);

/**
 * Кадр движения ленты для меню (этап 31): progress — сколько страницы пройдено к соседу (+1 — следующая целиком, −1 — предыдущая).
 * ms > 0 — доезд: меню едет к этому положению за ms по кривой curve вместе со страницей.
 */
export interface LaneMotion {
  progress: number;
  ms: number;
  curve: string;
}

/**
 * Шина движения ленты: лента пишет кадр, меню (пилюля, панель разделов) двигает себя прямо через style — без React,
 * без перерисовки на каждое движение пальца.
 */
export interface LaneBus {
  get: () => LaneMotion;
  set: (m: LaneMotion) => void;
  subscribe: (listener: (m: LaneMotion) => void) => () => void;
}

export const REST: LaneMotion = { progress: 0, ms: 0, curve: '' };

export function createLaneBus(): LaneBus {
  let motion = REST;
  const listeners = new Set<(m: LaneMotion) => void>();
  return {
    get: () => motion,
    set: (m) => {
      motion = m;
      listeners.forEach((l) => l(m));
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
}

export const LaneBusContext = createContext<LaneBus>(createLaneBus());
