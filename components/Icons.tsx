import type { CSSProperties } from 'react';

type Props = { n: string; sm?: boolean; xs?: boolean; className?: string; style?: CSSProperties };

/** أيقونة واحدة من الـ sprite */
export function Ic({ n, sm, xs, className, style }: Props) {
  const cls = ['icon', sm ? 'icon-sm' : '', xs ? 'icon-xs' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg className={cls} style={style} aria-hidden="true">
      <use href={`#${n}`} />
    </svg>
  );
}

export function Sprite() {
  return null;
}
