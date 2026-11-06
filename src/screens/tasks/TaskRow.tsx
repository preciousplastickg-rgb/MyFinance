import { Check, Flag } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { describeRepeat, taskWarning } from '../../domain/tasks';
import type { Task } from '../../domain/types';
import { Icon } from '../../ui/icons';

const ACTIONS_WIDTH = 176;

/**
 * Строка задачи: чекбокс 22 px в зоне 44×44, название, «время · сфера · повтор», флажок «Важно»,
 * оранжевое предупреждение. Свайп вправо — выполнить (зелёная плашка «Выполнено»), влево — «Перенести» и «Удалить» (SPEC 7.1).
 * Выполненная: вся строка открывает просмотр, галочка — только отметка (этап 19).
 */
export function TaskRow({
  task,
  onToggle,
  onOpen,
  onPostpone,
  onDelete,
  swipe = true,
  done = task.status === 'done',
}: {
  task: Task;
  onToggle: () => void;
  onOpen: () => void;
  onPostpone: () => void;
  onDelete: () => void;
  swipe?: boolean;
  /** Показать как сделанную: повторяющаяся задача после отметки остаётся open, но за свой день она сделана. */
  done?: boolean;
}) {
  const { areas } = useData();
  const today = useToday();
  const area = task.areaId ? areas.find((a) => a.id === task.areaId) : undefined;
  const warning = taskWarning(task, today);
  const icon = task.icon ?? area?.icon;
  const meta = [task.time, task.repeat ? describeRepeat(task.repeat) : undefined].filter(Boolean);

  const [dx, setDxState] = useState(0);
  // Последнее смещение в ref: pointerup может прийти раньше перерисовки после pointermove.
  const dxRef = useRef(0);
  // Клик, который браузер шлёт после свайпа, не должен открывать запись.
  const swiped = useRef(false);
  const setDx = (v: number) => {
    dxRef.current = v;
    setDxState(v);
  };
  const [open, setOpen] = useState(false);
  const g = useRef<{ x: number; y: number; base: number; mode: 'none' | 'swipe' | 'scroll'; width: number } | null>(null);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!swipe || done) return;
    g.current = { x: e.clientX, y: e.clientY, base: open ? -ACTIONS_WIDTH : 0, mode: 'none', width: e.currentTarget.offsetWidth };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (s.mode === 'none') {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
        s.mode = 'swipe';
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (Math.abs(my) > 8) s.mode = 'scroll';
    }
    if (s.mode === 'swipe') setDx(Math.max(-ACTIONS_WIDTH - 40, s.base + mx));
  };
  const up = () => {
    const s = g.current;
    g.current = null;
    if (!s || s.mode !== 'swipe') return;
    swiped.current = true;
    // На тач-экране click после свайпа обычно не приходит — флаг не должен съесть следующий тап.
    setTimeout(() => (swiped.current = false), 300);
    if (dxRef.current > s.width * 0.3) {
      setDx(0);
      setOpen(false);
      onToggle();
    } else if (dxRef.current < -ACTIONS_WIDTH / 2) {
      setDx(-ACTIONS_WIDTH);
      setOpen(true);
    } else {
      setDx(0);
      setOpen(false);
    }
  };
  const close = () => {
    setDx(0);
    setOpen(false);
  };

  return (
    <div className="relative overflow-hidden bg-surface" data-no-tab-swipe>
      {dx > 0 && (
        <div className="absolute inset-y-0 left-0 flex items-center gap-2 overflow-hidden bg-income pl-5 font-semibold whitespace-nowrap text-white" style={{ width: dx }}>
          <Check size={22} className="shrink-0" aria-hidden />
          {dx > 120 && <span>Выполнено</span>}
        </div>
      )}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTIONS_WIDTH }} aria-hidden={!open}>
        <button type="button" tabIndex={open ? 0 : -1} onClick={() => (close(), onPostpone())} className="flex-1 bg-accent font-semibold text-white">
          Перенести
        </button>
        <button type="button" tabIndex={open ? 0 : -1} onClick={() => (close(), onDelete())} className="flex-1 bg-warn font-semibold text-white">
          Удалить
        </button>
      </div>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          if (swiped.current) {
            swiped.current = false;
            e.stopPropagation();
            e.preventDefault();
            return;
          }
          if (open) {
            e.stopPropagation();
            close();
          }
        }}
        className={`relative flex min-h-14 touch-pan-y items-center bg-surface ${g.current?.mode === 'swipe' ? '' : 'transition-transform duration-150'}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
      >
        {done ? (
          // Выполненная: галочка — просто отметка, тап по строке открывает просмотр.
          <span className="flex size-11 shrink-0 items-center justify-center self-start pt-[3px]" style={{ marginTop: 4 }} aria-hidden>
            <span className="flex size-[22px] items-center justify-center rounded-full bg-income text-white">
              <Check size={14} strokeWidth={3} />
            </span>
          </span>
        ) : (
          <button
            type="button"
            role="checkbox"
            aria-checked={false}
            aria-label={`Выполнить: ${task.title}`}
            onClick={onToggle}
            className="flex size-11 shrink-0 items-center justify-center self-start pt-[3px]"
            style={{ marginTop: 4 }}
          >
            <span className="flex size-[22px] items-center justify-center rounded-full ring-2 ring-muted/60" />
          </button>
        )}
        <button
          type="button"
          onClick={onOpen}
          aria-label={done ? `${task.title}, выполнено. Посмотреть` : undefined}
          className={`min-w-0 flex-1 py-2.5 pr-3 text-left ${done ? '-ml-11 pl-11' : ''}`}
        >
          <span className={`block ${done ? 'text-muted line-through' : ''}`}>{task.title}</span>
          {(meta.length > 0 || area || icon) && (
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-muted">
              {task.time && <span className="tabular">{task.time}</span>}
              {task.time && (area || icon) && <span aria-hidden>·</span>}
              {(area || icon) && (
                <span className="inline-flex items-center gap-1" style={{ color: area?.color }}>
                  {icon && <Icon name={icon} size={14} />}
                  {area && <span>{area.name}</span>}
                </span>
              )}
              {task.repeat && (
                <>
                  {(task.time || area || icon) && <span aria-hidden>·</span>}
                  <span>{describeRepeat(task.repeat)}</span>
                </>
              )}
            </span>
          )}
          {warning && <span className="mt-0.5 block text-caption font-medium text-warn">{warning}</span>}
        </button>
        {task.important && !done && <Flag size={18} className="mr-4 shrink-0 fill-warn text-warn" aria-label="Важно" />}
      </div>
    </div>
  );
}
