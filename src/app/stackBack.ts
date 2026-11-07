import { createContext } from 'react';

/** «‹ Назад» экрана из стека — с той же анимацией, что и свайп вправо (этап 29). Вне стека — обычный pop. */
export const StackBackContext = createContext<(() => void) | null>(null);
