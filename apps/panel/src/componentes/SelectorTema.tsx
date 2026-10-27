import { cn } from '@beely/ui'
import { Check, Moon, Sun } from 'lucide-react'
import { temas, useTemaStore } from '../stores/useTemaStore'

// Interruptor claro/oscuro (fila del menú de cuenta y botón suelto en la pantalla de acceso).
export function BotonModo({ className }: { className?: string }) {
  const modo = useTemaStore((e) => e.modo)
  const alternarModo = useTemaStore((e) => e.alternarModo)
  const oscuro = modo === 'oscuro'
  return (
    <button
      type="button"
      onClick={alternarModo}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
      className={cn(
        'flex size-8 items-center justify-center rounded-control text-texto-3 transition-colors hover:bg-texto/6 hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco pointer-coarse:size-11',
        className,
      )}
    >
      {oscuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}

// Muestras de color para elegir el tema de acento. El área táctil es mayor que el círculo.
export function SelectorTema({ className }: { className?: string }) {
  const tema = useTemaStore((e) => e.tema)
  const elegirTema = useTemaStore((e) => e.elegirTema)
  return (
    <div role="radiogroup" aria-label="Tema de color" className={cn('flex items-center', className)}>
      {temas.map((t) => {
        const activo = t.id === tema
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={t.nombre}
            title={t.nombre}
            onClick={() => elegirTema(t.id)}
            className="group flex size-7 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-foco pointer-coarse:size-11"
          >
            <span
              className={cn(
                'flex size-[18px] items-center justify-center rounded-full ring-offset-2 ring-offset-superficie transition-shadow',
                activo ? 'ring-2 ring-texto/70' : 'group-hover:ring-2 group-hover:ring-borde-fuerte',
              )}
              style={{ backgroundColor: t.color }}
            >
              {activo ? <Check className={cn('size-3', t.id === 'miel' ? 'text-texto' : 'text-white')} strokeWidth={3} /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
