// Sin dependencias del navegador: lo importa también el plugin de Vite (Node).
export const LLAVE_TEMA = 'beely-tema'
// Llave anterior del panel: se sigue leyendo para no perder la elección ya guardada.
export const LLAVE_ANTERIOR = 'beely-panel-tema'

// Modo cuando la persona no ha elegido: el del teléfono (panel) o siempre claro (club).
export type ModoPorDefecto = 'sistema' | 'claro'

// Script en línea para <head>: aplica lo guardado antes de pintar (sin destello claro
// en modo oscuro). Debe coincidir con `leer()` y `modoPorDefecto()` de tema.ts.
export const scriptTemaInicial = (modo: ModoPorDefecto = 'sistema') =>
  `document.documentElement.dataset.modoPorDefecto='${modo}';try{var t=JSON.parse(localStorage.getItem('${LLAVE_TEMA}')||localStorage.getItem('${LLAVE_ANTERIOR}')||'{}'),r=document.documentElement;if(t.tema||t.porDefecto)r.dataset.tema=t.tema||t.porDefecto;r.dataset.modo=t.modo||(r.dataset.modoPorDefecto==='claro'?'claro':matchMedia('(prefers-color-scheme: dark)').matches?'oscuro':'claro');var c=t.colores;if(c){r.style.setProperty('--b-acento',c.acento);r.style.setProperty('--b-acento-2',c.acento2);r.style.setProperty('--b-sobre-acento',c.sobre)}}catch(e){}`
