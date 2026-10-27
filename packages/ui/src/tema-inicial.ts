// Sin dependencias del navegador: lo importa también el plugin de Vite (Node).
export const LLAVE_TEMA = 'beely-tema'
// Llave anterior del panel: se sigue leyendo para no perder la elección ya guardada.
export const LLAVE_ANTERIOR = 'beely-panel-tema'

// Script en línea para <head>: aplica lo guardado antes de pintar (sin destello claro
// en modo oscuro). Debe coincidir con `leer()` de tema.ts.
export const scriptTemaInicial = `try{var t=JSON.parse(localStorage.getItem('${LLAVE_TEMA}')||localStorage.getItem('${LLAVE_ANTERIOR}')||'{}'),r=document.documentElement;if(t.tema||t.porDefecto)r.dataset.tema=t.tema||t.porDefecto;r.dataset.modo=t.modo||(matchMedia('(prefers-color-scheme: dark)').matches?'oscuro':'claro')}catch(e){}`
