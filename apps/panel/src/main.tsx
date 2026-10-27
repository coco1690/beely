import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { temaBeely } from '@beely/ui'
import type { Tabla } from '@beely/tipos'

type Negocio = Tabla<'negocios'>

function App() {
  const ejemplo: Pick<Negocio, 'nombre'> = { nombre: 'Beely' }
  return (
    <main style={{ fontFamily: 'system-ui', color: temaBeely.colorSecundario }}>
      <h1 style={{ color: temaBeely.colorPrimario }}>{ejemplo.nombre}</h1>
      <p>Panel del negocio (Sprint 0)</p>
    </main>
  )
}

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('No existe #raiz')
createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
