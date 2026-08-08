/* ═══════════════════════════════════════════════════════════════════════
   DOBLE ÁREA · LA BATALLA DE LOS PETOS
   MOTOR DE PUNTUACIÓN — fichero compartido
   Lo cargan las DOS apps (cuerpo técnico y jugadores). Es la única
   fuente del reglamento: cualquier cambio de reglas se toca AQUÍ y solo
   aquí, y las dos tablas siguen coincidiendo por construcción.

   REGLAMENTO
   · Ganador único de la sesión ....... 3 pts a todos sus jugadores
   · Sin ganador (empate arriba) ...... 1 pt a los equipos empatados
   · Resto ............................ 0 pts
   · Solo puntúa quien juega. No jugar no resta.
   · Premio del mes: +1 pt a la general para los 7 primeros del mes.
     El mes solo reparte cuando está CERRADO (no el mes en curso).
     El +1 no cuenta para la tabla del mes siguiente.
   · Temporada desde agosto 2026, sin reinicio.
═══════════════════════════════════════════════════════════════════════ */
const DA = (function () {

  /* ── ÚNICO INTERRUPTOR DE REGLAS ──────────────────────────────────
     true  → a igualdad de puntos en el corte del puesto 7 manda el
             % de victorias. Media ≈ 7,2 premiados de 24.
     false → premio para todos los empatados en el puesto 7.
             Media ≈ 8 premiados, con meses de 13 o más.
     Ver nota al final del fichero.                                   */
  const DESEMPATE_POR_PCT = true;

  const TEAMS = ['azul', 'verde', 'peto'];
  const TEAM_LBL = { azul: 'Azul', verde: 'Verde', peto: 'Sin peto' };
  const TEMPORADA_DESDE = '2026-08';
  const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO',
                 'AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

  const mesDe = d => (d || '').slice(0, 7);
  const mesActual = () => new Date().toISOString().slice(0, 7);
  const nombreMes = m => MESES[+m.slice(5, 7) - 1] || '';

  /* Puntos de un jugador en una sesión. null = no jugó. */
  function ptsSesion(s, pid) {
    const t = s.teams ? s.teams[pid] : null;
    if (!t) return null;
    if (!s.winners || !s.winners.length) return 0;
    if (s.winners.length === 1) return s.winners[0] === t ? 3 : 0;
    return s.winners.includes(t) ? 1 : 0;
  }

  /* Acumulado en bruto, sin bonus */
  function acumula(players, sessions) {
    const map = {};
    players.forEach(p => map[p.id] = { ...p, pts: 0, j: 0, v: 0, e: 0, dd: 0, form: [] });
    sessions.forEach(s => players.forEach(p => {
      const pt = ptsSesion(s, p.id);
      if (pt === null) return;
      const r = map[p.id];
      r.j++; r.pts += pt; r.form.push(pt);
      if (pt === 3) r.v++; else if (pt === 1) r.e++; else r.dd++;
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

  function tablaMes(players, sessions, mes) {
    return ordena(acumula(players, sessions.filter(s => mesDe(s.date) === mes)));
  }

  /* Quién entra en el premio de un mes concreto */
  function premiadosMes(players, sessions, mes) {
    const t = tablaMes(players, sessions, mes);
    if (!t.length) return [];
    const c = t[Math.min(6, t.length - 1)];
    if (DESEMPATE_POR_PCT)
      return t.filter(r => r.pts > c.pts || (r.pts === c.pts && r.pct >= c.pct));
    return t.filter(r => r.pts >= c.pts);
  }

  /* Meses ya cerrados que han repartido premio */
  function mesesCerrados(sessions) {
    const hoy = mesActual();
    return [...new Set(sessions.map(s => mesDe(s.date)))]
      .filter(m => m >= TEMPORADA_DESDE && m < hoy).sort();
  }

  /* CLASIFICACIÓN GENERAL — acumulado + bonus de meses cerrados */
  function general(players, sessions) {
    const ss = sessions.filter(s => mesDe(s.date) >= TEMPORADA_DESDE);
    const map = acumula(players, ss);
    mesesCerrados(ss).forEach(m => {
      premiadosMes(players, ss, m).forEach(r => {
        if (map[r.id]) { map[r.id].pts += 1; map[r.id].bonus = (map[r.id].bonus || 0) + 1; }
      });
    });
    return ordena(map);
  }

  /* ── NAVEGACIÓN POR MESES Y PALMARÉS ── */

  /* Desplaza un 'YYYY-MM' n meses adelante o atrás */
  function mesSuma(m, n) {
    let y = +m.slice(0, 4), mm = +m.slice(5, 7) + n;
    y += Math.floor((mm - 1) / 12);
    mm = ((mm - 1) % 12 + 12) % 12 + 1;
    return y + '-' + String(mm).padStart(2, '0');
  }

  /* Meses de la temporada que tienen alguna sesión, de antiguo a reciente */
  function mesesConSesiones(sessions) {
    return [...new Set(sessions.map(s => mesDe(s.date)))]
      .filter(m => m >= TEMPORADA_DESDE).sort();
  }

  const esCerrado = mes => mes < mesActual();

  function campeonMes(players, sessions, mes) {
    const t = tablaMes(players, sessions, mes);
    return t.length ? t[0] : null;
  }

  /* Meses ya cerrados con su campeón y sus premiados, del más reciente
     al más antiguo. Alimenta la sección de Palmarés. */
  function palmares(players, sessions) {
    return mesesCerrados(sessions).slice().reverse().map(m => ({
      mes: m,
      nombre: nombreMes(m),
      campeon: campeonMes(players, sessions, m),
      premiados: premiadosMes(players, sessions, m)
    }));
  }

  /* Racha viva a partir de la última sesión jugada */
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
    return n >= 2 ? n + ' sin perder' : '';
  }

  /* Puestos ganados o perdidos respecto a antes de la última sesión */
  function movimientos(players, sessions) {
    const ss = sessions.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (ss.length < 2) return {};
    const ahora = general(players, ss);
    const antes = general(players, ss.slice(0, -1));
    const pa = {}; antes.forEach(r => pa[r.id] = r.pos);
    const mv = {}; ahora.forEach(r => mv[r.id] = pa[r.id] === undefined ? 0 : pa[r.id] - r.pos);
    return mv;
  }

  /* Tarjetas de logros de la portada */
  function logros(arr) {
    const L = [];
    if (!arr.length) return L;
    L.push({ t: 'Líder', n: arr[0].nick, v: arr[0].pts + ' pts' });
    const ra = arr.filter(r => r.racha.includes('victorias'))
                  .sort((a, b) => parseInt(b.racha) - parseInt(a.racha))[0];
    if (ra) L.push({ t: 'Mejor racha', n: ra.nick, v: ra.racha });
    const inv = arr.filter(r => r.dd === 0 && r.j >= 3).sort((a, b) => b.j - a.j)[0];
    if (inv) L.push({ t: 'Invicto', n: inv.nick, v: inv.j + ' sesiones sin perder' });
    const pc = arr.filter(r => r.j >= 3).sort((a, b) => b.pct - a.pct)[0];
    if (pc) L.push({ t: 'Más victorias', n: pc.nick, v: pc.pct + '% ganadas' });
    const co = arr.slice().sort((a, b) => b.j - a.j)[0];
    if (co) L.push({ t: 'Más presente', n: co.nick, v: co.j + ' sesiones' });
    return L;
  }

  const fechaCorta = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';

  return { TEAMS, TEAM_LBL, TEMPORADA_DESDE, DESEMPATE_POR_PCT, MESES,
           mesDe, mesActual, nombreMes, fechaCorta, mesSuma,
           ptsSesion, acumula, ordena, tablaMes, premiadosMes,
           mesesCerrados, mesesConSesiones, esCerrado, campeonMes, palmares,
           general, calcRacha, movimientos, logros };
})();

/* ═══════════════════════════════════════════════════════════════════════
   NOTA SOBRE DESEMPATE_POR_PCT
   Los puntos van de 3 en 3, así que en un mes hay pocos valores distintos
   repartidos entre 24 jugadores y los empates son masivos. Simulando 40
   meses de 12 sesiones: sin desempate el premio cae de media en 8
   jugadores (con meses de 13 o más); desempatando por % de victorias,
   en 7,2. Por eso está activado. Es el único cambio necesario para
   volver atrás.
═══════════════════════════════════════════════════════════════════════ */
