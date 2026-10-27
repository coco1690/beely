import { Boton, cn } from '@beely/ui'
import { Check, Moon, Sun } from 'lucide-react'
import { temas, useTemaStore } from '../stores/useTemaStore'

// Botón de modo claro/oscuro.
export function BotonModo({ className }: { className?: string }) {
  const modo = useTemaStore((e) => e.modo)
  const alternarModo = useTemaStore((e) => e.alternarModo)
  const oscuro = modo === 'oscuro'
  return (
    <Boton
      variante="fantasma"
      tamano="icono"
      className={className}
      onClick={alternarModo}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
    >
      {oscuro ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </Boton>
  )
}

// Muestras de color para elegir el tema de acento.
export function SelectorTema({ className }: { className?: string }) {
  const tema = useTemaStore((e) => e.tema)
  const elegirTema = useTemaStore((e) => e.elegirTema)
  return (
    <div role="radiogroup" aria-label="Tema de color" className={cn('flex items-center gap-1.5', className)}>
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
            className={cn(
              'flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-superficie transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-texto-3',
              activo && 'ring-2 ring-texto',
            )}
            style={{ backgroundColor: t.color }}
          >
            {activo ? <Check className="size-3.5 text-white drop-shadow" strokeWidth={3} /> : null}
          </button>
        )
      })}
    </div>
  )
}
