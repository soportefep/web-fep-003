/**
 * Página "Equipo FEP" (migrada desde Equipo_FEP.asp).
 * Requiere assets/js/comun.js (cabecera, menú, pie y utilidades en window.FEP).
 *
 *   Contenido → GET /api/v1/federacion/equipo
 *               (respaldo: mock/federacion-equipo.json y mocks.js)
 *
 * Cada área se pinta como una sección con ancla (#organigrama, #menores): título, imagen original
 * publicada por la FEP y, debajo, las personas transcritas de esa imagen como fichas.
 * Todo texto de la API va por textContent.
 */
(function () {
'use strict';

const { $, $$, el, get, urlSegura, aFecha } = window.FEP;

const fmtFecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'i', 'san']);

/* ---------------------------------------------------------------------------
   Utilidades
   --------------------------------------------------------------------------- */
/** Iniciales para el avatar: "José Luis Gutiérrez del Álamo" → "JL". */
function iniciales(nombre) {
  const palabras = String(nombre ?? '').trim().split(/[\s-]+/)
    .filter((p) => p && !PARTICULAS.has(p.toLowerCase()) && /\p{L}/u.test(p));
  return palabras.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '·';
}

/**
 * URL de una imagen: las absolutas (API real) se validan con urlSegura; las relativas (mocks,
 * p. ej. "assets/img/fep/equipo/…") se usan tal cual, relativas a esta página.
 */
function urlImagen(ruta) {
  if (!ruta || typeof ruta !== 'string') return null;
  const limpia = ruta.trim();
  if (/^https?:\/\//i.test(limpia)) return urlSegura(limpia);
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(limpia)) return null; // javascript:, data:, //host… no
  return limpia;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const totalPersonas = (a) => a.grupos.reduce((s, g) => s + (g.miembros?.length ?? 0), 0);

/* ---------------------------------------------------------------------------
   Grupos y áreas
   --------------------------------------------------------------------------- */
function grupo(g, idArea) {
  const id = `${idArea}-${g.clave}`;
  return el('section', { class: 'org-group', 'aria-labelledby': id },
    el('h3', { class: 'org-group__title', id }, g.titulo,
      el('span', { class: 'org-count', text: String(g.miembros.length) })),
    el('ul', { class: 'person-grid' }, g.miembros.map((m) => el('li', { class: 'person-card' },
      el('span', { class: 'person-card__avatar', 'aria-hidden': 'true', text: iniciales(m.nombre) }),
      el('div', { class: 'person-card__body' },
        m.cargo ? el('p', { class: 'person-card__role', text: m.cargo }) : null,
        el('p', { class: 'person-card__name', text: m.nombre }))))));
}

function seccionArea(a, i) {
  const idTitulo = `${a.clave}-titulo`;
  const imagen = urlImagen(a.imagenUrl);
  const alt = a.imagenAlt || a.titulo;
  const grupos = (a.grupos ?? []).filter((g) => g && g.titulo && g.miembros?.length);

  return el('section', { class: 'organo', id: a.clave, 'aria-labelledby': idTitulo },
    el('header', { class: 'organo__head' },
      el('p', { class: 'organo__num', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0') }),
      el('div', {},
        el('h2', { class: 'h2 organo__title', id: idTitulo, text: a.titulo }),
        a.descripcion ? el('p', { class: 'organo__lead', text: a.descripcion }) : null,
        el('p', { class: 'organo__meta', text: plural(totalPersonas(a), 'persona', 'personas') }))),
    // Imagen original publicada por la FEP (lo único que mostraba la página antigua).
    imagen ? el('figure', { class: 'org-figure' },
      el('a', { class: 'org-figure__link', href: imagen, target: '_blank', rel: 'noopener' },
        el('img', { src: imagen, alt, loading: i === 0 ? 'eager' : 'lazy', decoding: 'async', width: 1920, height: 1080 }),
        el('span', { class: 'sr-only', text: ' (abrir la imagen a tamaño completo en una pestaña nueva)' })),
      el('figcaption', {},
        el('span', { text: alt }),
        el('a', { href: imagen, target: '_blank', rel: 'noopener', 'aria-hidden': 'true', tabindex: '-1' }, 'Ver a tamaño completo ↗'))) : null,
    grupos.map((g) => grupo(g, a.clave)));
}

/* ---------------------------------------------------------------------------
   Índice lateral y resumen
   --------------------------------------------------------------------------- */
function pintarIndice(areas) {
  $('#equipo-indice').replaceChildren(...areas.map((a) => el('li', {},
    el('a', { href: `#${a.clave}`, dataset: { clave: a.clave } },
      el('span', { text: a.titulo }), el('span', { class: 'page-toc__count', text: String(totalPersonas(a)) })))));

  // Marca en el índice la sección visible.
  if (!('IntersectionObserver' in window)) return;
  const enlaces = new Map($$('#equipo-indice a').map((a) => [a.dataset.clave, a]));
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      enlaces.forEach((a, clave) => {
        const activo = clave === e.target.id;
        a.classList.toggle('is-active', activo);
        if (activo) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-35% 0px -55% 0px' });
  areas.forEach((a) => { const s = document.getElementById(a.clave); if (s) obs.observe(s); });
}

function pintarResumen(areas) {
  const personas = areas.reduce((s, a) => s + totalPersonas(a), 0);
  const grupos = areas.reduce((s, a) => s + a.grupos.filter((g) => g.miembros?.length).length, 0);
  const datos = [[String(personas), 'personas'], [String(grupos), 'equipos y áreas']];
  $('#equipo-resumen').replaceChildren(...datos.map(([n, t]) => el('li', {}, el('strong', { text: n }), ` ${t}`)));
}

/* ---------------------------------------------------------------------------
   Arranque
   --------------------------------------------------------------------------- */
async function init() {
  const cont = $('#equipo-contenido');
  try {
    const datos = await get('/api/v1/federacion/equipo');
    const areas = (datos?.areas ?? [])
      .filter((a) => a && a.clave && a.titulo)
      .map((a) => ({ ...a, grupos: Array.isArray(a.grupos) ? a.grupos : [] }));
    if (!areas.length) throw new Error('Respuesta sin áreas');

    $('.org-skeleton', cont)?.remove();
    cont.prepend(...areas.map(seccionArea));
    if (datos.actualizado && aFecha(datos.actualizado)) {
      $('.page-note', cont).before(el('p', { class: 'org-updated' }, 'Información actualizada el ',
        el('time', { datetime: datos.actualizado, text: fmtFecha.format(aFecha(datos.actualizado)) }), '.'));
    }
    pintarIndice(areas);
    pintarResumen(areas);

    // Si se llega con un ancla (#menores…), desplazarse ahora que la sección existe.
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  } catch (e) {
    console.warn('[FEP] equipo FEP:', e.message);
    $('.org-skeleton', cont)?.remove();
    $('#equipo-error').hidden = false;
  } finally {
    cont.setAttribute('aria-busy', 'false');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
