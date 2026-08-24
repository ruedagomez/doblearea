/* ═══════════════════════════════════════════════════════════════════════
   DOBLE ÁREA · LA BATALLA DE LOS PETOS
   MOTOR DE PUNTUACIÓN — fichero compartido
   Lo cargan las DOS apps (cuerpo técnico y jugadores). Es la única
   fuente del reglamento: cualquier cambio se toca AQUÍ y solo aquí, y
   las dos tablas siguen coincidiendo por construcción.

   REGLAMENTO
   · La sesión la disputan de 2 a 4 equipos:
        2 equipos ... verde y sin peto
        3 equipos ... azul, verde y sin peto
        4 equipos ... azul, verde, sin peto y amarillo
   · No hay empates. Siempre sale un orden.
        Con 2 equipos ... 1º = 3 pts · 2º = 0
        Con 3 equipos ... 1º = 3 pts · 2º = 1 pt · 3º = 0
        Con 4 equipos ... 1º = 3 pts · 2º = 2 pts · 3º = 1 pt · 4º = 0
   · Solo puntúa quien juega. No jugar no resta.
   · Campeón del mes: trofeo o diploma físico e insignia permanente en
     el histórico. NO da puntos extra.
   · Los 8 últimos de cada mes cerrado pagan 5 €. El cuerpo técnico
     puede eximir a un jugador; entonces paga el inmediatamente
     superior en la tabla del mes, de forma que siempre pagan 8.
   · Un jugador sin equipo en una sesión cuenta como ausente. A partir
     de 2 ausencias en el mes queda marcado como candidato a exención.
   · Temporada desde agosto 2026, sin reinicio.
═══════════════════════════════════════════════════════════════════════ */
const DA = (function () {

  /* ── PARÁMETROS DEL REGLAMENTO ── */
  const PTS_2 = [3];             // con 2 equipos solo puntúa el ganador
  const PTS_3 = [3, 1];          // con 3 equipos: 1º y 2º puntúan
  const PTS_4 = [3, 2, 1];       // con 4 equipos: 1º, 2º y 3º puntúan
  const MULTADOS_MES = 8;        // cuántos pagan cada mes cerrado
  const MULTA_EUROS = 5;
  const UMBRAL_AUSENCIAS = 2;    // a partir de aquí, candidato a exención
  const TEMPORADA_DESDE = '2026-08';

  /* Orden fijo para mostrar. Qué petos se usan depende de cuántos
     equipos haya: con 2 se juega verde contra sin peto, el azul entra
     con el tercero y el amarillo con el cuarto. */
  const TEAMS = ['azul', 'verde', 'peto', 'amarillo'];
  const TEAM_LBL = { azul: 'Azul', verde: 'Verde', peto: 'Sin peto', amarillo: 'Amarillo' };
  const TEAM_ABBR = { azul: 'AZ', verde: 'VE', peto: 'S/P', amarillo: 'AM' };
  const SETS = {
    2: ['verde', 'peto'],
    3: ['azul', 'verde', 'peto'],
    4: ['azul', 'verde', 'peto', 'amarillo']
  };
  const equiposDe = n => (SETS[n] || SETS[3]).slice();

  const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO',
                 'AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const mesDe = d => (d || '').slice(0, 7);
  const mesActual = () => new Date().toISOString().slice(0, 7);
  const nombreMes = m => MESES[+m.slice(5, 7) - 1] || '';
  const fechaCorta = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
  const esCerrado = mes => mes < mesActual();

  function mesSuma(m, n) {
    let y = +m.slice(0, 4), mm = +m.slice(5, 7) + n;
    y += Math.floor((mm - 1) / 12);
    mm = ((mm - 1) % 12 + 12) % 12 + 1;
    return y + '-' + String(mm).padStart(2, '0');
  }

  /* Escala de puntos según cuántos equipos compitieron esa sesión */
  function escalaPts(n) {
    if (n <= 2) return PTS_2;
    if (n === 3) return PTS_3;
    return PTS_4;
  }

  /* Puntos de un jugador en una sesión. null = no jugó.
     s.podio = ['azul','verde'] → 1º y 2º.
     Se mantiene lectura de s.winners por si quedara alguna sesión
     grabada con el formato antiguo. */
  function ptsSesion(s, pid) {
    const t = s.teams ? s.teams[pid] : null;
    if (!t) return null;
    if (s.podio && s.podio.length) {
      const n = s.nEquipos || equiposEnSesion(s).length;
      const esc = escalaPts(n);
      const i = s.podio.indexOf(t);
      return i >= 0 && i < esc.length ? esc[i] : 0;
    }
    if (s.winners && s.winners.length) {          // formato antiguo
      if (s.winners.length === 1) return s.winners[0] === t ? 3 : 0;
      return s.winners.includes(t) ? 1 : 0;
    }
    return 0;
  }

  /* Equipos que participaron en una sesión, en orden fijo */
  const equiposEnSesion = s =>
    TEAMS.filter(t => Object.values(s.teams || {}).indexOf(t) >= 0);

  function acumula(players, sessions) {
    const map = {};
    players.forEach(p => map[p.id] = { ...p, pts: 0, j: 0, v: 0, seg: 0, dd: 0, form: [] });
    sessions.forEach(s => players.forEach(p => {
      const pt = ptsSesion(s, p.id);
      if (pt === null) return;
      const r = map[p.id];
      r.j++; r.pts += pt; r.form.push(pt);
      /* v = 1º puesto · dd = último puesto, 0 pts · seg = cualquier
         puesto intermedio que puntúa (2º con 3 equipos, 2º o 3º con 4).
         Antes esto daba por hecho una escala de solo 3/1/0 y con 4
         equipos etiquetaba el 2º puesto (2 pts) como derrota. No movía
         el total de puntos (pts se suma aparte y siempre fue correcto),
         pero sí el desglose interno v/seg/dd. */
      if (pt === 3) r.v++; else if (pt === 0) r.dd++; else r.seg++;
    }));
    return map;
  }

  /* Orden oficial: puntos → % victorias → sesiones jugadas → nombre.
     Los empatados a puntos comparten número de posición. */
  function ordena(map) {
    const arr = Object.values(map).filter(r => r.j > 0);
    arr.forEach(r => {
      r.pct = r.j ? Math.round(r.v / r.j * 100) : 0;
      r.racha = calcRacha(r.form);
    });
    arr.sort((a, b) => b.pts - a.pts || b.pct - a.pct || b.j - a.j
                    || (a.nick || '').localeCompare(b.nick || ''));
    let pos = 0, prev = null;
    arr.forEach((r, i) => {
      if (prev === null || r.pts !== prev) { pos = i + 1; prev = r.pts; }
      r.pos = pos;
    });
    return arr;
  }

  const enTemporada = sessions => sessions.filter(s => mesDe(s.date) >= TEMPORADA_DESDE);

  /* CLASIFICACIÓN GENERAL — acumulado puro, sin bonus de ningún tipo */
  function general(players, sessions) {
    return ordena(acumula(players, enTemporada(sessions)));
  }

  function tablaMes(players, sessions, mes) {
    return ordena(acumula(players, sessions.filter(s => mesDe(s.date) === mes)));
  }

  /* Sesiones disputadas en un mes */
  const sesionesDeMes = (sessions, mes) => sessions.filter(s => mesDe(s.date) === mes).length;

  /* Ausencias de cada jugador en el mes: sesiones del mes a las que no
     fue asignado a ningún equipo. Solo cuenta para quien jugó al menos
     una: el que no aparece en todo el mes no entra en la tabla. */
  function ausenciasMes(players, sessions, mes) {
    const tot = sesionesDeMes(sessions, mes), a = {};
    tablaMes(players, sessions, mes).forEach(r => a[r.id] = tot - r.j);
    return a;
  }

  /* Candidatos a exención: 2 o más ausencias en el mes */
  function candidatosExencion(players, sessions, mes) {
    const a = ausenciasMes(players, sessions, mes);
    return Object.keys(a).filter(id => a[id] >= UMBRAL_AUSENCIAS);
  }

  const exDe = (ex, mes) => (ex && ex[mes]) ? ex[mes] : [];

  /* Los 8 últimos del mes, saltando a los eximidos. Al saltar uno, el
     hueco lo ocupa el inmediatamente superior en la tabla, de modo que
     el número de multados no cambia. El orden es el oficial (puntos →
     % victorias → sesiones), todo visible en la tabla. */
  function multadosMes(players, sessions, mes, ex) {
    const t = tablaMes(players, sessions, mes);
    const exentos = {}; exDe(ex, mes).forEach(id => exentos[id] = 1);
    const n = Math.min(MULTADOS_MES, t.filter(r => !exentos[r.id]).length);
    const out = [];
    for (let i = t.length - 1; i >= 0 && out.length < n; i--) {
      if (exentos[t[i].id]) continue;
      out.push(t[i]);
    }
    return out.reverse();
  }

  const campeonMes = (players, sessions, mes) => {
    const t = tablaMes(players, sessions, mes);
    return t.length ? t[0] : null;
  };

  function mesesConSesiones(sessions) {
    return [...new Set(enTemporada(sessions).map(s => mesDe(s.date)))].sort();
  }
  const mesesCerrados = sessions => mesesConSesiones(sessions).filter(esCerrado);

  /* Histórico de meses cerrados, del más reciente al más antiguo */
  function palmares(players, sessions, ex) {
    return mesesCerrados(sessions).slice().reverse().map(m => ({
      mes: m,
      nombre: nombreMes(m),
      campeon: campeonMes(players, sessions, m),
      multados: multadosMes(players, sessions, m, ex)
    }));
  }

  /* Insignias: cuántos meses ha ganado cada jugador */
  function titulos(players, sessions) {
    const t = {};
    mesesCerrados(sessions).forEach(m => {
      const c = campeonMes(players, sessions, m);
      if (c) t[c.id] = (t[c.id] || 0) + 1;
    });
    return t;
  }

  /* Euros acumulados por jugador en toda la temporada */
  function multasTemporada(players, sessions, ex) {
    const e = {};
    mesesCerrados(sessions).forEach(m =>
      multadosMes(players, sessions, m, ex).forEach(r => e[r.id] = (e[r.id] || 0) + MULTA_EUROS));
    return e;
  }

  function calcRacha(form) {
    if (!form.length) return '';
    const last = form[form.length - 1];
    let n = 0;
    if (last === 3) {
      for (let i = form.length - 1; i >= 0 && form[i] === 3; i--) n++;
      return n >= 2 ? n + ' victorias' : '';
    }
    if (last === 0) return '';
    for (let i = form.length - 1; i >= 0 && form[i] > 0; i--) n++;
    return n >= 2 ? n + ' puntuando' : '';
  }

  function movimientos(players, sessions) {
    const ss = enTemporada(sessions).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (ss.length < 2) return {};
    const ahora = general(players, ss), antes = general(players, ss.slice(0, -1));
    const pa = {}; antes.forEach(r => pa[r.id] = r.pos);
    const mv = {}; ahora.forEach(r => mv[r.id] = pa[r.id] === undefined ? 0 : pa[r.id] - r.pos);
    return mv;
  }

  function logros(arr, tit) {
    const L = [];
    if (!arr.length) return L;
    L.push({ t: 'Líder', n: arr[0].nick, v: arr[0].pts + ' pts' });
    const ra = arr.filter(r => r.racha.indexOf('victorias') >= 0)
                  .sort((a, b) => parseInt(b.racha) - parseInt(a.racha))[0];
    if (ra) L.push({ t: 'Mejor racha', n: ra.nick, v: ra.racha });
    const pc = arr.filter(r => r.j >= 3).sort((a, b) => b.pct - a.pct)[0];
    if (pc) L.push({ t: 'Más victorias', n: pc.nick, v: pc.pct + '% ganadas' });
    if (tit) {
      const mv = arr.filter(r => tit[r.id]).sort((a, b) => tit[b.id] - tit[a.id])[0];
      if (mv) L.push({ t: 'Más títulos', n: mv.nick, v: tit[mv.id] + (tit[mv.id] > 1 ? ' meses' : ' mes') });
    }
    return L;
  }

  /* Miniatura de Cloudinary: recorta y comprime en origen en vez de
     descargar el retrato completo. Es lo que hacía lenta la carga. */
  function thumb(url, px) {
    if (!url) return null;
    const i = url.indexOf('/upload/');
    if (i < 0) return url;
    return url.slice(0, i + 8) + 'c_fill,g_face,w_' + px + ',h_' + px + ',q_auto,f_auto/' + url.slice(i + 8);
  }

  return { TEAMS, TEAM_LBL, TEAM_ABBR, equiposDe, equiposEnSesion, escalaPts,
           PTS_2, PTS_3, PTS_4, MULTADOS_MES, MULTA_EUROS, UMBRAL_AUSENCIAS,
           TEMPORADA_DESDE, MESES,
           mesDe, mesActual, nombreMes, fechaCorta, mesSuma, esCerrado,
           ptsSesion, acumula, ordena, general, tablaMes,
           sesionesDeMes, ausenciasMes, candidatosExencion,
           multadosMes, campeonMes, mesesConSesiones, mesesCerrados,
           palmares, titulos, multasTemporada,
           calcRacha, movimientos, logros, thumb };
})();

/* ═══════════════════════════════════════════════════════════════════════
   EXENCIONES
   Se guardan en Firestore en da_exentos/{YYYY-MM} con la forma
   { ids: ['jugador1','jugador2'] } y se pasan a las funciones de multa
   como un objeto { '2026-08': [...], '2026-09': [...] }.
   Son SIEMPRE manuales: 2 ausencias marcan al jugador como candidato,
   pero no le eximen solas. La decisión es del cuerpo técnico.
═══════════════════════════════════════════════════════════════════════ */
