/**
 * Página "Órganos de gobierno" (migrada desde Organos_Gobierno.asp).
 * Requiere assets/js/comun.js (cabecera, menú, pie y utilidades en window.FEP).
 *
 *   Contenido → GET /api/v1/federacion/organos-gobierno
 *               (respaldo: mock/federacion-organos-gobierno.json y mocks.js)
 *
 * Cada órgano se pinta como una sección con ancla (#junta-directiva, #asamblea,
 * #comision-delegada, #ctap). Los grupos con presentación "tarjetas" se muestran como fichas de
 * persona; los de presentación "lista", como tablas. Todo texto de la API va por textContent.
 */
(function () {
'use strict';

const { $, $$, el, get, urlSegura, aFecha } = window.FEP;

const fmtFecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const ACTAS_VISIBLES = 5;             // el resto, plegadas en "Ver actas anteriores"
const LISTA_ANCHA = 8;                // grupos de más miembros ocupan todo el ancho
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'i']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------------------------------------------------------------------------
   Utilidades
   --------------------------------------------------------------------------- */
/** Iniciales para el avatar: "Javier Rodriguez Piris" → "JR"; "APELLIDOS, NOMBRE" → nombre + apellido. */
function iniciales(nombre) {
  let texto = String(nombre ?? '').trim();
  if (texto.includes(',')) {
    const [apellidos, nombrePila] = texto.split(',');
    texto = `${nombrePila} ${apellidos}`;
  }
  const palabras = texto.split(/\s+/).filter((p) => p && !PARTICULAS.has(p.toLowerCase()) && /\p{L}/u.test(p));
  return palabras.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '·';
}

/** "http://www.fap.es/" → "fap.es" */
function dominio(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/** Enlace de contacto (email o web) de un miembro, o null. */
function contacto(m) {
  if (m.email && EMAIL.test(m.email)) {
    const [usuario, dominioEmail] = m.email.split('@');
    return el('a', { class: 'org-contact', href: `mailto:${m.email}` },
      el('span', { class: 'org-contact__icon', 'aria-hidden': 'true', text: '✉' }),
      // <wbr> tras la "@": si no cabe en una línea, se parte ahí y no a mitad de palabra
      el('span', { class: 'org-contact__text' }, `${usuario}@`, el('wbr'), dominioEmail));
  }
  const web = urlSegura(m.web);
  if (web) {
    return el('a', { class: 'org-contact', href: web, target: '_blank', rel: 'noopener' },
      dominio(web), el('span', { 'aria-hidden': 'true', text: ' ↗' }),
      el('span', { class: 'sr-only', text: ' (se abre en una pestaña nueva)' }));
  }
  return null;
}

/**
 * URL de una imagen: las absolutas (API real) se validan con urlSegura; las relativas (mocks,
 * p. ej. "assets/img/fep/organos/…") se usan tal cual, relativas a esta página.
 * (urlSegura resuelve las relativas contra la web antigua, que no tiene estas imágenes.)
 */
function urlImagen(ruta) {
  if (!ruta || typeof ruta !== 'string') return null;
  const limpia = ruta.trim();
  if (/^https?:\/\//i.test(limpia)) return urlSegura(limpia);
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(limpia)) return null; // javascript:, data:, //host… no
  return limpia;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const totalMiembros = (o) => o.grupos.reduce((s, g) => s + (g.miembros?.length ?? 0), 0);

/* ---------------------------------------------------------------------------
   Grupos
   --------------------------------------------------------------------------- */
/** Fichas de persona (Junta Directiva, CTAP). */
function grupoTarjetas(g, idOrgano) {
  const id = `${idOrgano}-${g.clave}`;
  return el('section', { class: 'org-group', 'aria-labelledby': id },
    el('h3', { class: 'org-group__title', id }, g.titulo,
      el('span', { class: 'org-count', text: String(g.miembros.length) })),
    el('ul', { class: 'person-grid' }, g.miembros.map((m) => el('li', { class: 'person-card' },
      el('span', { class: 'person-card__avatar', 'aria-hidden': 'true', text: iniciales(m.nombre) }),
      el('div', { class: 'person-card__body' },
        m.cargo ? el('p', { class: 'person-card__role', text: m.cargo }) : null,
        el('p', { class: 'person-card__name', text: m.nombre }),
        m.detalle ? el('p', { class: 'person-card__detail', text: m.detalle }) : null,
        contacto(m))))));
}

/** Tabla (Asamblea, Comisión Delegada). La 2.ª columna solo aparece si algún miembro la usa. */
function grupoLista(g) {
  const conContacto = g.miembros.some((m) => m.email || m.web);
  const conDetalle = g.miembros.some((m) => m.detalle);
  const segunda = conContacto || conDetalle;
  return el('div', { class: `org-group org-group--lista${g.miembros.length > LISTA_ANCHA ? ' org-group--ancho' : ''}` },
    el('table', { class: 'org-table' },
      el('caption', {}, g.titulo, el('span', { class: 'org-count', text: String(g.miembros.length) })),
      el('thead', {}, el('tr', {},
        el('th', { scope: 'col', text: g.etiquetaNombre || 'Miembro' }),
        segunda ? el('th', { scope: 'col', text: g.etiquetaDetalle || '' }) : null)),
      el('tbody', {}, g.miembros.map((m) => el('tr', {},
        el('td', { class: 'org-table__name', text: m.nombre }),
        segunda ? el('td', { class: 'org-table__detail' },
          conDetalle && m.detalle ? el('span', { class: 'org-tag', text: m.detalle }) : null,
          conContacto ? (contacto(m) ?? (conDetalle ? null : el('span', { class: 'org-muted', text: '—' }))) : null) : null)))));
}

/* ---------------------------------------------------------------------------
   Actas
   --------------------------------------------------------------------------- */
function itemActa(a) {
  const url = urlSegura(a.url);
  const f = aFecha(a.fecha);
  return el('li', { class: 'doc' },
    el('span', { class: 'doc__icon', 'aria-hidden': 'true', text: 'PDF' }),
    el('div', { class: 'doc__body' },
      url ? el('a', { class: 'doc__title', href: url, target: '_blank', rel: 'noopener' }, a.titulo)
        : el('span', { class: 'doc__title', text: a.titulo }),
      el('p', { class: 'doc__meta' },
        f ? el('time', { datetime: String(a.fecha), text: fmtFecha.format(f) }) : null,
        a.tipo ? el('span', { class: `org-tag${a.tipo === 'Extraordinaria' ? ' org-tag--red' : ''}`, text: a.tipo }) : null)),
    url ? el('a', { class: 'doc__download', href: url, target: '_blank', rel: 'noopener', 'aria-label': `Descargar en PDF: ${a.titulo}` },
      'Descargar ', el('span', { 'aria-hidden': 'true', text: '↓' })) : null);
}

function bloqueActas(o) {
  if (!o.actas?.length) return null;
  const id = `${o.clave}-actas`;
  const visibles = o.actas.slice(0, ACTAS_VISIBLES);
  const resto = o.actas.slice(ACTAS_VISIBLES);
  return el('section', { class: 'org-actas', 'aria-labelledby': id },
    el('h3', { class: 'org-group__title', id }, `Actas de la ${o.titulo}`,
      el('span', { class: 'org-count', text: String(o.actas.length) })),
    el('ul', { class: 'doc-list' }, visibles.map(itemActa)),
    resto.length ? el('details', { class: 'org-more' },
      el('summary', { text: `Ver ${plural(resto.length, 'acta anterior', 'actas anteriores')}` }),
      el('ul', { class: 'doc-list' }, resto.map(itemActa))) : null);
}

/* ---------------------------------------------------------------------------
   Órganos
   --------------------------------------------------------------------------- */
function seccionOrgano(o, i) {
  const idTitulo = `${o.clave}-titulo`;
  const imagen = urlImagen(o.imagenUrl);
  const tarjetas = o.grupos.filter((g) => g.presentacion === 'tarjetas' && g.miembros?.length);
  const listas = o.grupos.filter((g) => g.presentacion !== 'tarjetas' && g.miembros?.length);

  return el('section', { class: 'organo', id: o.clave, 'aria-labelledby': idTitulo },
    el('header', { class: 'organo__head' },
      el('p', { class: 'organo__num', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0') }),
      el('div', {},
        el('h2', { class: 'h2 organo__title', id: idTitulo, text: o.titulo }),
        o.descripcion ? el('p', { class: 'organo__lead', text: o.descripcion }) : null,
        el('p', { class: 'organo__meta', text: [
          plural(totalMiembros(o), 'miembro', 'miembros'),
          o.actas?.length ? plural(o.actas.length, 'acta', 'actas') : null,
        ].filter(Boolean).join(' · ') }))),
    // Organigrama publicado por la FEP: siempre visible, debajo del título del órgano.
    imagen ? el('figure', { class: 'org-figure' },
      el('a', { class: 'org-figure__link', href: imagen, target: '_blank', rel: 'noopener' },
        el('img', { src: imagen, alt: o.imagenAlt || `Organigrama: ${o.titulo}`, loading: 'lazy', decoding: 'async', width: 1920, height: 1080 }),
        el('span', { class: 'sr-only', text: ' (abrir la imagen a tamaño completo en una pestaña nueva)' })),
      el('figcaption', {},
        el('span', { text: o.imagenAlt || `Organigrama: ${o.titulo}` }),
        el('a', { href: imagen, target: '_blank', rel: 'noopener', 'aria-hidden': 'true', tabindex: '-1' }, 'Ver a tamaño completo ↗'))) : null,
    tarjetas.map((g) => grupoTarjetas(g, o.clave)),
    listas.length ? el('div', { class: 'org-groups' }, listas.map(grupoLista)) : null,
    bloqueActas(o));
}

/* ---------------------------------------------------------------------------
   Índice lateral y resumen
   --------------------------------------------------------------------------- */
function pintarIndice(organos) {
  $('#organos-indice').replaceChildren(...organos.map((o) => el('li', {},
    el('a', { href: `#${o.clave}`, dataset: { clave: o.clave } },
      el('span', { text: o.titulo }), el('span', { class: 'page-toc__count', text: String(totalMiembros(o)) })))));

  // Marca en el índice la sección visible.
  if (!('IntersectionObserver' in window)) return;
  const enlaces = new Map($$('#organos-indice a').map((a) => [a.dataset.clave, a]));
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
  organos.forEach((o) => { const s = document.getElementById(o.clave); if (s) obs.observe(s); });
}

function pintarResumen(organos) {
  const actas = organos.reduce((s, o) => s + (o.actas?.length ?? 0), 0);
  const junta = organos.find((o) => o.clave === 'junta-directiva');
  const datos = [
    [String(organos.length), 'órganos'],
    junta ? [String(totalMiembros(junta)), 'en la Junta Directiva'] : null,
    actas ? [String(actas), 'actas publicadas'] : null,
  ].filter(Boolean);
  $('#organos-resumen').replaceChildren(...datos.map(([n, t]) => el('li', {}, el('strong', { text: n }), ` ${t}`)));
}

/* ---------------------------------------------------------------------------
   Arranque
   --------------------------------------------------------------------------- */
async function init() {
  const cont = $('#organos-contenido');
  try {
    const datos = await get('/api/v1/federacion/organos-gobierno');
    const organos = (datos?.organos ?? []).filter((o) => o && o.clave && o.titulo);
    if (!organos.length) throw new Error('Respuesta sin órganos');

    $('.org-skeleton', cont)?.remove();
    cont.prepend(...organos.map(seccionOrgano));
    if (datos.actualizado && aFecha(datos.actualizado)) {
      cont.append(el('p', { class: 'org-updated' }, 'Información actualizada el ',
        el('time', { datetime: datos.actualizado, text: fmtFecha.format(aFecha(datos.actualizado)) }), '.'));
    }
    pintarIndice(organos);
    pintarResumen(organos);

    // Si se llega con un ancla (#asamblea…), desplazarse ahora que la sección existe.
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  } catch (e) {
    console.warn('[FEP] órganos de gobierno:', e.message);
    $('.org-skeleton', cont)?.remove();
    $('#organos-error').hidden = false;
  } finally {
    cont.setAttribute('aria-busy', 'false');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
