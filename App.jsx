import { useState, useEffect, useRef, useCallback } from "react";

// ── Symbols ──────────────────────────────────────────────────────────────────
const SYM = [
  { id:"cherry",  e:"\uD83C\uDF52", base:3,   w:28 },
  { id:"lemon",   e:"\uD83C\uDF4B", base:5,   w:24 },
  { id:"grape",   e:"\uD83C\uDF47", base:8,   w:18 },
  { id:"bell",    e:"\uD83D\uDD14", base:14,  w:13 },
  { id:"star",    e:"\u2B50",       base:25,  w:8  },
  { id:"diamond", e:"\uD83D\uDC8E", base:60,  w:5  },
  { id:"seven",   e:"7\uFE0F\u20E3",base:150, w:3  },
  { id:"mega",    e:"\uD83C\uDF1F", base:500, w:1  },
];

function wpick(luckLv) {
  const ws = SYM.map((s,i) => Math.max(0.3, s.w - i * luckLv * 0.35));
  const tot = ws.reduce((a,b)=>a+b,0);
  let r = Math.random()*tot;
  for(let i=0;i<SYM.length;i++){r-=ws[i];if(r<=0)return i;}
  return 0;
}

// ── Win-line definitions (every consecutive step is grid-adjacent) ────────────
// Each line is an ordered list of cell indices where |rowDiff|<=1 and |colDiff|<=1
// between every consecutive pair — so a "run" on the line is always touching.
function getWinLines(sz) {
  const lines = [];
  const cell = (r,c) => r*sz+c;

  // Rows
  for(let r=0;r<sz;r++)
    lines.push({name:"Row "+(r+1), zigzag:false, cells:Array.from({length:sz},(_,c)=>cell(r,c))});

  // Columns
  for(let c=0;c<sz;c++)
    lines.push({name:"Col "+(c+1), zigzag:false, cells:Array.from({length:sz},(_,r)=>cell(r,c))});

  // All down-right diagonals (top-left to bottom-right) of length >= 3
  for(let startR=0;startR<=sz-3;startR++){
    for(let startC=0;startC<=sz-3;startC++){
      if(startR>0 && startC>0) continue; // only start from top edge or left edge to avoid duplicates
      const len = Math.min(sz-startR, sz-startC);
      if(len < 3) continue;
      lines.push({
        name:"Diag\u2198 r"+(startR+1)+"c"+(startC+1),
        zigzag:false,
        cells:Array.from({length:len},(_,i)=>cell(startR+i, startC+i))
      });
    }
  }

  // All down-left diagonals (top-right to bottom-left) of length >= 3
  for(let startR=0;startR<=sz-3;startR++){
    for(let startC=sz-1;startC>=2;startC--){
      if(startR>0 && startC<sz-1) continue; // only start from top edge or right edge
      const len = Math.min(sz-startR, startC+1);
      if(len < 3) continue;
      lines.push({
        name:"Diag\u2199 r"+(startR+1)+"c"+(startC+1),
        zigzag:false,
        cells:Array.from({length:len},(_,i)=>cell(startR+i, startC-i))
      });
    }
  }

  // Zigzag lines: alternate between two adjacent rows, moving one column at a time.
  for(let topR=0;topR<sz-1;topR++){
    const rA=topR, rB=topR+1;
    lines.push({
      name:"Zig row"+(rA+1)+"-"+(rB+1)+"A",
      zigzag:true,
      cells:Array.from({length:sz},(_,c)=>cell(c%2===0?rA:rB, c))
    });
    lines.push({
      name:"Zig row"+(rA+1)+"-"+(rB+1)+"B",
      zigzag:true,
      cells:Array.from({length:sz},(_,c)=>cell(c%2===0?rB:rA, c))
    });
  }

  return lines;
}

// Verify every line is valid (each step ≤1 row and ≤1 col apart).
// Used only in dev; kept here as documentation.
// function validateLines(lines, sz) { ... }

// ── Win detection ─────────────────────────────────────────────────────────────
// On a line, find every maximal consecutive run of 3+ identical symbols.
// "Consecutive" means adjacent positions in the line definition — which we
// guarantee are always grid-adjacent by construction above.
function runsOnLine(lineCells, grid, isZigzag) {
  const minLen = isZigzag ? 5 : 3;
  const runs = [];
  let i = 0;
  while(i < lineCells.length) {
    const symId = grid[lineCells[i]];
    let j = i+1;
    while(j < lineCells.length && grid[lineCells[j]] === symId) j++;
    const len = j - i;
    if(len >= minLen) {
      runs.push({ symId, cells: lineCells.slice(i, j) });
    }
    i = j;
  }
  return runs;
}

function calcWins(grid, sz, multLv, jackLv) {
  const mult = 1 + multLv * 0.6;
  const wins = [];
  const seen = new Set(); // deduplicate: same physical cells on multiple lines = one win

  for(const line of getWinLines(sz)) {
    for(const run of runsOnLine(line.cells, grid, line.zigzag)) {
      const key = run.cells.slice().sort((a,b)=>a-b).join(",") + ":" + run.symId;
      if(seen.has(key)) continue;
      seen.add(key);

      const sym = SYM.find(s=>s.id===run.symId);
      const count = run.cells.length;
      const isJack = count >= sz;
      const isMega = count === sz*sz;
      let pay = sym.base * count * mult * sz;
      if(isJack && !isMega) pay *= 10 + jackLv*5;
      if(isMega) pay *= 50 + jackLv*20;
      wins.push({lineName:line.name, symId:run.symId, count, isJack, isMega, pay:Math.floor(pay), cells:run.cells});
    }
  }

  // Full-board jackpot (all cells same symbol)
  if(grid.length === sz*sz && grid.every(id=>id===grid[0])) {
    const key = "MEGA:"+grid[0];
    if(!seen.has(key)) {
      seen.add(key);
      const sym = SYM.find(s=>s.id===grid[0]);
      const pay = Math.floor(sym.base * sz*sz * mult * (50+jackLv*20));
      wins.push({lineName:"MEGA JACKPOT", symId:grid[0], count:sz*sz, isJack:true, isMega:true, pay, cells:[...Array(sz*sz).keys()]});
    }
  }

  wins.sort((a,b)=>a.pay-b.pay);
  const hitCells = new Set(wins.flatMap(w=>w.cells));
  return {wins, hitCells};
}

// ── Upgrades ─────────────────────────────────────────────────────────────────
const UPGRADES = [
  {id:"luck",       name:"Lucky Charm",   desc:"Rare symbols more likely",                emoji:"\uD83C\uDF40", baseCost:30,      costMult:2.2,  maxLevel:20, color:"#4ade80"},
  {id:"multiplier", name:"Golden Touch",  desc:"Multiply all payouts",                    emoji:"\u2728",       baseCost:80,      costMult:2.5,  maxLevel:15, color:"#facc15"},
  {id:"speed",      name:"Turbo Spin",    desc:"Faster scrolling reels",                  emoji:"\u26A1",       baseCost:150,     costMult:2.8,  maxLevel:10, color:"#38bdf8"},
  {id:"jackpot",    name:"Jackpot Boost", desc:"Jackpot pays massively more",             emoji:"\uD83D\uDCB0", baseCost:300,     costMult:3,    maxLevel:10, color:"#fb923c"},
  {id:"passive",    name:"Lucky Trickle", desc:"Earn % of best win passively per second", emoji:"\uD83D\uDCB8", baseCost:200,     costMult:2.5,  maxLevel:15, color:"#34d399"},
  {id:"grid6",      name:"6x6 Grid",      desc:"36 cells, more lines",                   emoji:"\uD83D\uDD32", baseCost:5000,    costMult:1,    maxLevel:1,  color:"#f472b6"},
  {id:"grid7",      name:"7x7 Grid",      desc:"49 cells",                               emoji:"\uD83D\uDD33", baseCost:50000,   costMult:1,    maxLevel:1,  color:"#e879f9"},
  {id:"grid8",      name:"8x8 Grid",      desc:"64 cells",                               emoji:"\uD83D\uDFEA", baseCost:500000,  costMult:1,    maxLevel:1,  color:"#c026d3"},
  {id:"grid9",      name:"9x9 Grid",      desc:"81 cells",                               emoji:"\uD83D\uDFEB", baseCost:5000000, costMult:1,    maxLevel:1,  color:"#9333ea"},
  {id:"grid10",     name:"10x10 Grid",    desc:"100 cells - ultimate",                   emoji:"\uD83C\uDFC6", baseCost:50000000,costMult:1,    maxLevel:1,  color:"#fbbf24"},
];

function upgCost(upg, lv) { return Math.floor(upg.baseCost * Math.pow(upg.costMult, lv)); }

function getSize(um) {
  if(um.grid10>=1) return 10;
  if(um.grid9>=1)  return 9;
  if(um.grid8>=1)  return 8;
  if(um.grid7>=1)  return 7;
  if(um.grid6>=1)  return 6;
  return 5;
}

function fmt(n) {
  if(n>=1e12) return (n/1e12).toFixed(2)+"T";
  if(n>=1e9)  return (n/1e9).toFixed(2)+"B";
  if(n>=1e6)  return (n/1e6).toFixed(2)+"M";
  if(n>=1e3)  return (n/1e3).toFixed(1)+"K";
  return Math.floor(n).toString();
}

// ── Reel: strip of random emojis ending in the winner, CSS-transition scroll ─
const STRIP_LEN = 22; // number of random symbols before the winner

function ReelStrip({ strip, finalIdx, spinning, highlight, cellSz, spinKey }) {
  const fSize = Math.max(11, Math.floor(cellSz * 0.5));
  // When spinning=true: show top of strip. When done: transition to final position.
  const targetTop = spinning ? 0 : -(finalIdx * cellSz);
  const duration = spinning ? 0 : 0; // transition applied via CSS on the inner div
  // We use a CSS class trick: on spinKey change we snap to top=0, then on !spinning we transition
  const innerRef = useRef(null);
  useEffect(() => {
    if(!innerRef.current) return;
    if(spinning) {
      // snap to top instantly
      innerRef.current.style.transition = "none";
      innerRef.current.style.top = "0px";
    } else {
      // animate to final
      innerRef.current.style.transition = "top 0.55s cubic-bezier(0.25,0.8,0.35,1)";
      innerRef.current.style.top = -(finalIdx * cellSz) + "px";
    }
  }, [spinning, finalIdx, cellSz]);

  return (
    <div style={{
      width: cellSz,
      height: cellSz,
      borderRadius: Math.max(4, Math.floor(cellSz*0.13)),
      background: highlight
        ? "linear-gradient(135deg,rgba(251,191,36,0.28),rgba(245,158,11,0.15))"
        : "linear-gradient(160deg,#13132b,#0d0d1f)",
      border: highlight ? "2px solid #fbbf24" : "2px solid #1e1e3a",
      boxShadow: highlight ? "0 0 16px rgba(251,191,36,0.45),inset 0 0 8px rgba(251,191,36,0.1)" : "inset 0 2px 6px rgba(0,0,0,0.6)",
      overflow: "hidden",
      position: "relative",
      flexShrink: 0,
    }}>
      <div ref={innerRef} style={{position:"absolute", top:0, width:"100%"}}>
        {strip.map((e,i) => (
          <div key={i} style={{
            height: cellSz,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize: fSize, lineHeight:1,
            opacity: spinning ? (i < 3 ? 0.4 : 1) : 1,
          }}>{e}</div>
        ))}
      </div>
    </div>
  );
}

// ── Win line SVG overlay ──────────────────────────────────────────────────────
function WinLineOverlay({ wins, visibleCount, size, cellSz, gap, fmtFn, lineDrawMs, lineStaggerMs }) {
  const colors = ["#f472b6","#fb923c","#facc15","#4ade80","#38bdf8","#a78bfa","#f87171","#34d399"];
  const totalW = size * cellSz + (size-1) * gap;
  const totalH = size * cellSz + (size-1) * gap;
  const drawS = (lineDrawMs / 1000).toFixed(3);
  const staggerS = (lineStaggerMs / 1000).toFixed(3);

  function cc(idx) {
    const row = Math.floor(idx / size);
    const col = idx % size;
    return { x: col*(cellSz+gap)+cellSz/2, y: row*(cellSz+gap)+cellSz/2 };
  }

  return (
    <svg
      style={{position:"absolute",top:0,left:0,width:totalW,height:totalH,pointerEvents:"none",overflow:"visible",zIndex:10}}
      viewBox={"0 0 "+totalW+" "+totalH}
    >
      {wins.slice(0, visibleCount).map((win, wi) => {
        const color = colors[wi % colors.length];
        const pts = win.cells.map(idx => cc(idx));
        const ptStr = pts.map(p=>p.x+","+p.y).join(" ");
        const delay = (wi * lineStaggerMs / 1000).toFixed(3);
        const mid = pts[Math.floor(pts.length/2)];
        const label = "+" + fmtFn(win.pay);
        const lblW = Math.max(40, label.length * 7.5);
        return (
          <g key={wi}>
            <polyline points={ptStr} fill="none" stroke={color} strokeWidth="7"
              strokeLinecap="round" strokeLinejoin="round" opacity="0.15"
              style={{strokeDasharray:3000,strokeDashoffset:3000,
                animation:"drawLine "+drawS+"s ease-out "+delay+"s forwards"}}
            />
            <polyline points={ptStr} fill="none" stroke={color} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" opacity="0.92"
              style={{strokeDasharray:3000,strokeDashoffset:3000,
                animation:"drawLine "+drawS+"s ease-out "+delay+"s forwards"}}
            />
            {pts.map((p,pi) => (
              <circle key={pi} cx={p.x} cy={p.y} r={cellSz*0.13} fill={color} opacity="0.95"
                style={{transform:"scale(0)",transformOrigin:p.x+"px "+p.y+"px",
                  animation:"popDot "+drawS+"s ease-out "+(parseFloat(delay)+parseFloat(drawS)*0.6).toFixed(3)+"s forwards"}}
              />
            ))}
            <g style={{opacity:0,animation:"fadeInLabel "+drawS+"s ease-out "+(parseFloat(delay)+parseFloat(drawS)*0.8).toFixed(3)+"s forwards"}}>
              <rect x={mid.x-lblW/2} y={mid.y-11} width={lblW} height={19}
                rx={5} fill="#050510" fillOpacity="0.88" stroke={color} strokeWidth="1.2"/>
              <text x={mid.x} y={mid.y+4.5} textAnchor="middle"
                fontSize={Math.max(9,Math.min(12,cellSz*0.24))}
                fontWeight="800" fontFamily="'Courier New',monospace" fill={color}
              >{label}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LuckyReels() {
  const [coins, setCoins]           = useState(50);
  const [totalEarned, setTotal]     = useState(50);
  const [spins, setSpins]           = useState(0);
  const [upgMap, setUpgMap] = useState({luck:0,multiplier:0,speed:0,jackpot:0,passive:0,grid6:0,grid7:0,grid8:0,grid9:0,grid10:0});
  const [tab, setTab]               = useState("upgrades");

  const size  = getSize(upgMap);
  const cells = size * size;
  const cellSz = Math.max(32, Math.min(58, Math.floor(290/size)));
  const gap = 3;

  // Each reel has a pre-generated strip and a finalIdx within it
  const [strips,    setStrips]    = useState(() => genStrips(size*size, 0));
  const [finalIdxs, setFinalIdxs] = useState(() => Array(size*size).fill(STRIP_LEN));
  const [grid,      setGrid]      = useState(() => Array(size*size).fill(SYM[0].id));
  const [spinKey,   setSpinKey]   = useState(0);
  const [spinning,  setSpinning]  = useState(false);

  const [wins,        setWins]        = useState([]);
  const [hitCells,    setHitCells]    = useState(new Set());
  const [visibleWins, setVisibleWins] = useState(0);
  const [message,     setMessage]     = useState("Spin to play!");
  const [particles,   setParticles]   = useState([]);
  const [history,     setHistory]     = useState([]);
  const [highestWin,  setHighestWin]  = useState(0);
  const [passiveTick, setPassiveTick] = useState(0); // coins earned last tick, for display

  const pidRef      = useRef(0);
  const passiveRef  = useRef(null);
  const spinningRef = useRef(false);
  const coinsRef    = useRef(50);
  const highestWinRef = useRef(0);
  coinsRef.current  = coins;
  spinningRef.current = spinning;

  const speedLv      = upgMap.speed;
  const spinDuration = Math.max(500, 1400 - speedLv*130);
  const spinCost     = Math.max(1, cells - 24);
  // Passive income: base 1% of highestWin per tick, upgraded % and tick rate
  const passiveLv    = upgMap.passive;
  const passivePct   = passiveLv * 0.01;           // 1% per level
  const passiveMs    = Math.max(500, 2000 - speedLv*150); // tick interval, faster with speed upgrades
  const passivePerSec = highestWin > 0 && passiveLv > 0
    ? Math.floor(highestWin * passivePct * (1000/passiveMs))
    : 0;
  // Win line animation budget — fixed now that there's no autospin
  const lineDrawMs    = 180;
  const lineStaggerMs = 120;

  function genStrips(n, luckLv) {
    return Array.from({length:n}, () => {
      const strip = Array.from({length: STRIP_LEN}, () => SYM[Math.floor(Math.random()*SYM.length)].e);
      return strip;
    });
  }

  // Reveal wins one by one after spinning stops
  useEffect(() => {
    if(wins.length === 0) { setVisibleWins(0); return; }
    setVisibleWins(0);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setVisibleWins(i);
      if(i >= wins.length) clearInterval(iv);
    }, lineStaggerMs);
    return () => clearInterval(iv);
  }, [wins, lineStaggerMs]);

  const doSpin = useCallback(() => {
    if(spinningRef.current) return;
    const cost = Math.max(1, getSize(upgMap) * getSize(upgMap) - 24);
    if(coinsRef.current < cost) { setMessage("Not enough coins!"); return; }

    setCoins(c => c - cost);
    setSpinning(true);
    setWins([]);
    setHitCells(new Set());
    setVisibleWins(0);
    setMessage("Spinning...");

    // Generate final grid
    const newIdxs = Array.from({length: cells}, () => wpick(upgMap.luck));
    const newGrid = newIdxs.map(i => SYM[i].id);

    // Build strips: random emojis then the winner at position STRIP_LEN
    const newStrips = Array.from({length: cells}, (_, ci) => {
      return Array.from({length: STRIP_LEN + 1}, (__, si) => {
        if(si === STRIP_LEN) return SYM[newIdxs[ci]].e;
        return SYM[Math.floor(Math.random()*SYM.length)].e;
      });
    });

    // Set strips and snap to top=0, then in next frame trigger the scroll transition
    setStrips(newStrips);
    setFinalIdxs(Array(cells).fill(0));
    setSpinKey(k => k+1);
    // Use rAF to let the snap-to-0 render first, then trigger transition to final
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFinalIdxs(Array(cells).fill(STRIP_LEN));
      });
    });

    setTimeout(() => {
      setGrid(newGrid);
      setSpinning(false);

      const {wins:w, hitCells:hc} = calcWins(newGrid, size, upgMap.multiplier, upgMap.jackpot);
      setHitCells(hc);
      setWins(w);

      const totalPay = w.reduce((a,b)=>a+b.pay, 0);
      if(totalPay > 0) {
        setCoins(c => c+totalPay);
        setTotal(t => t+totalPay);
        setHighestWin(h => {
          const next = Math.max(h, totalPay);
          highestWinRef.current = next;
          return next;
        });
        const hasMega = w.some(x=>x.isMega);
        const hasJack = w.some(x=>x.isJack);
        if(hasMega)      setMessage("MEGA JACKPOT! +" + fmt(totalPay));
        else if(hasJack) setMessage("JACKPOT! +" + fmt(totalPay));
        else             setMessage(w.length+" win"+(w.length>1?"s":"")+"! +" + fmt(totalPay));

        const n = hasMega?28:hasJack?16:6;
        const ps = Array.from({length:n},()=>({
          id:pidRef.current++,
          x:15+Math.random()*70, y:5+Math.random()*50,
          dx:(Math.random()-.5)*280, dy:-(80+Math.random()*200),
          e:hasMega?["\uD83C\uDF1F","\uD83D\uDCB0","\u2728","\uD83C\uDF89"][Math.floor(Math.random()*4)]:
                    ["\uD83D\uDCB0","\u2728"][Math.floor(Math.random()*2)],
        }));
        setParticles(p=>[...p,...ps]);
        setTimeout(()=>setParticles(p=>p.filter(x=>!ps.find(n=>n.id===x.id))), 1600);
      } else {
        setMessage("No match - try again!");
      }
      setSpins(s=>s+1);
      setHistory(h=>[{
        preview: newGrid.slice(0,6).map(id=>SYM.find(s=>s.id===id)?.e||"?").join(""),
        pay: totalPay, wins: w, id: Date.now()
      },...h.slice(0,9)]);
    }, spinDuration);
  }, [cells, size, upgMap, spinDuration]);

  // Passive income tick
  useEffect(() => {
    clearInterval(passiveRef.current);
    if(passiveLv <= 0) return;
    passiveRef.current = setInterval(() => {
      const hw = highestWinRef.current;
      if(hw <= 0) return;
      const gain = Math.max(1, Math.floor(hw * passiveLv * 0.01));
      setCoins(c => c + gain);
      setTotal(t => t + gain);
      setPassiveTick(gain);
    }, passiveMs);
    return () => clearInterval(passiveRef.current);
  }, [passiveLv, passiveMs]);

  // Resize grid
  useEffect(() => {
    const newGrid = Array.from({length:cells}, () => SYM[wpick(0)].id);
    const newStrips = Array.from({length:cells}, (_,ci) => {
      const idx = SYM.findIndex(s=>s.id===newGrid[ci]);
      const strip = Array.from({length:STRIP_LEN+1},(__, si)=>si===STRIP_LEN?SYM[idx].e:SYM[Math.floor(Math.random()*SYM.length)].e);
      return strip;
    });
    setGrid(newGrid);
    setStrips(newStrips);
    setFinalIdxs(Array(cells).fill(STRIP_LEN));
    setWins([]); setHitCells(new Set()); setVisibleWins(0);
  }, [size, cells]);

  const buyUpgrade = (id) => {
    const upg = UPGRADES.find(u=>u.id===id);
    const lv = upgMap[id];
    if(lv>=upg.maxLevel) return;
    const cost = upgCost(upg,lv);
    if(coins<cost) return;
    setCoins(c=>c-cost);
    setUpgMap(m=>({...m,[id]:m[id]+1}));
  };

  const PREREQS = {grid7:"grid6",grid8:"grid7",grid9:"grid8",grid10:"grid9"};
  const hasMega = wins.some(w=>w.isMega);
  const hasJack = wins.some(w=>w.isJack);
  const gridW = size*cellSz+(size-1)*gap;

  return (
    <div style={{
      minHeight:"100vh", background:"#05050e",
      fontFamily:"'Courier New',monospace", color:"#dde4f0",
      display:"flex", flexDirection:"column", alignItems:"center",
      padding:"14px 10px 52px", position:"relative", overflow:"hidden",
    }}>
      <style>{`
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes floatUp{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--pdx),var(--pdy))}}
        @keyframes jackGlow{0%,100%{text-shadow:0 0 12px #fbbf24,0 0 40px #fbbf24}50%{text-shadow:0 0 28px #fbbf24,0 0 80px #f59e0b}}
        @keyframes megaGlow{0%,100%{text-shadow:0 0 20px #fff,0 0 60px #fbbf24}50%{text-shadow:0 0 40px #fff,0 0 100px #fbbf24}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes drawLine{to{stroke-dashoffset:0}}
        @keyframes popDot{to{transform:scale(1)}}
        @keyframes fadeInLabel{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
        @keyframes winSlide{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
        .upg-btn{transition:transform .15s,box-shadow .15s;}
        .upg-btn:hover:not([disabled]){transform:translateY(-2px);}
        .spin-btn{transition:transform .1s;}
        .spin-btn:hover:not([disabled]){transform:scale(1.03);}
        .spin-btn:active:not([disabled]){transform:scale(.97);}
      `}</style>

      {/* Ambient glow */}
      <div style={{position:"fixed",top:"3%",left:"-8%",width:340,height:340,borderRadius:"50%",background:"rgba(109,40,217,0.1)",filter:"blur(100px)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"8%",right:"-5%",width:300,height:300,borderRadius:"50%",background:"rgba(14,116,144,0.15)",filter:"blur(90px)",pointerEvents:"none"}}/>

      {/* Particles */}
      {particles.map(p=>(
        <div key={p.id} style={{
          position:"fixed",left:p.x+"%",top:p.y+"%",
          "--pdx":p.dx+"px","--pdy":p.dy+"px",
          fontSize:22,animation:"floatUp 1.5s ease-out forwards",
          pointerEvents:"none",zIndex:999,
        }}>{p.e}</div>
      ))}

      {/* Title */}
      <h1 style={{
        fontSize:"clamp(20px,5vw,38px)",fontWeight:900,letterSpacing:".12em",margin:"0 0 2px",
        background:"linear-gradient(90deg,#fbbf24,#f59e0b,#fde68a,#f59e0b,#fbbf24)",
        backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
        animation:"shimmer 3s linear infinite",
      }}>LUCKY REELS</h1>
      <p style={{color:"#6366f1",fontSize:9,letterSpacing:".3em",margin:"0 0 12px",textTransform:"uppercase"}}>
        {size}x{size} GRID &middot; MATCH TOUCHING SYMBOLS
      </p>

      {/* Stats */}
      <div style={{
        display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",
        background:"#0d0d1f",border:"1px solid #1e1e3a",borderRadius:13,
        padding:"8px 16px",marginBottom:12,
      }}>
        {[
          {label:"COINS",   val:fmt(coins),       color:"#fbbf24"},
          {label:"SPINS",   val:fmt(spins),        color:"#c7d2fe"},
          {label:"BEST WIN",val:fmt(highestWin),   color:"#fb923c"},
          {label:"PASSIVE", val:passivePerSec>0?"+"+fmt(passivePerSec)+"/s":"--", color:"#34d399"},
          {label:"COST",    val:fmt(spinCost),     color:"#f87171"},
        ].map(({label,val,color})=>(
          <div key={label} style={{textAlign:"center",minWidth:52}}>
            <div style={{fontSize:8,color:"#4b5563",letterSpacing:".18em"}}>{label}</div>
            <div style={{fontSize:16,fontWeight:700,color,fontVariantNumeric:"tabular-nums"}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Grid container */}
      <div style={{
        background:"linear-gradient(160deg,#0d0d22,#08081a)",
        border:"2px solid #2a1a6e",borderRadius:20,
        padding:12,marginBottom:10,
        boxShadow:"0 8px 40px rgba(76,29,149,0.25)",
      }}>
        {/* The grid + SVG overlay */}
        <div style={{position:"relative", width:gridW, marginBottom:8}}>
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat("+size+", "+cellSz+"px)",
            gap:gap,
          }}>
            {Array.from({length:cells},(_,i)=>(
              <ReelStrip
                key={i}
                strip={strips[i] || [SYM[0].e]}
                finalIdx={finalIdxs[i] != null ? finalIdxs[i] : STRIP_LEN}
                spinning={spinning}
                highlight={hitCells.has(i)}
                cellSz={cellSz}
                spinKey={spinKey}
              />
            ))}
          </div>
          {/* Win line SVG */}
          {wins.length > 0 && !spinning && (
            <div style={{position:"absolute",top:0,left:0,pointerEvents:"none"}}>
              <WinLineOverlay
                wins={wins}
                visibleCount={visibleWins}
                size={size}
                cellSz={cellSz}
                gap={gap}
                fmtFn={fmt}
                lineDrawMs={lineDrawMs}
                lineStaggerMs={lineStaggerMs}
              />
            </div>
          )}
        </div>

        {/* Message */}
        <div style={{
          minHeight:20,textAlign:"center",fontSize:12,fontWeight:700,
          letterSpacing:".05em",padding:"1px 0",marginBottom:6,
          color: hasMega?"#fbbf24":hasJack?"#fb923c":wins.length?"#4ade80":"#64748b",
          animation: hasMega?"megaGlow 1s infinite":hasJack?"jackGlow 1s infinite":"none",
        }}>{message}</div>

        {/* Spin button */}
        <button className="spin-btn" onClick={doSpin} disabled={spinning||coins<spinCost}
          style={{
            width:"100%",padding:"11px 0",borderRadius:11,border:"none",
            cursor:spinning||coins<spinCost?"not-allowed":"pointer",
            background:spinning||coins<spinCost
              ?"linear-gradient(135deg,#374151,#1f2937)"
              :"linear-gradient(135deg,#7c3aed,#4f46e5)",
            color:spinning||coins<spinCost?"#6b7280":"#fff",
            fontSize:13,fontWeight:800,letterSpacing:".18em",textTransform:"uppercase",
            fontFamily:"'Courier New',monospace",
            boxShadow:spinning||coins<spinCost?"none":"0 4px 18px rgba(124,58,237,0.35)",
          }}>
          {spinning?"SPINNING...":"SPIN - "+fmt(spinCost)+" coins"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:10,width:"min(92vw,480px)"}}>
        {["upgrades","paytable","history"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            flex:1,padding:"7px 0",borderRadius:9,border:"none",cursor:"pointer",
            background:tab===t?"linear-gradient(135deg,#3730a3,#4f46e5)":"#0d0d1f",
            color:tab===t?"#fff":"#64748b",
            fontSize:10,fontWeight:700,letterSpacing:".15em",textTransform:"uppercase",
            fontFamily:"'Courier New',monospace",
            outline:tab===t?"1px solid #6366f1":"1px solid #1e1e3a",
          }}>{t}{t==="history"&&history.length>0?" ("+history.length+")":""}</button>
        ))}
      </div>

      {/* Upgrades */}
      {tab==="upgrades"&&(
        <div style={{width:"min(92vw,480px)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {UPGRADES.map(upg=>{
              const lv=upgMap[upg.id];
              const maxed=lv>=upg.maxLevel;
              const cost=upgCost(upg,lv);
              const can=!maxed&&coins>=cost;
              const req=PREREQS[upg.id];
              if(req&&upgMap[req]<1) return null;
              return(
                <button key={upg.id} className="upg-btn"
                  onClick={()=>buyUpgrade(upg.id)} disabled={!can}
                  style={{
                    background:maxed?"rgba(20,83,45,0.25)":can?"linear-gradient(135deg,#0f0f2a,#191930)":"#07070f",
                    border:maxed?"1.5px solid #4ade80":can?"1.5px solid "+upg.color:"1.5px solid #161626",
                    borderRadius:12,padding:"10px",
                    cursor:can?"pointer":"not-allowed",
                    textAlign:"left",color:"#e2e8f0",
                    fontFamily:"'Courier New',monospace",
                    boxShadow:can?"0 0 10px "+upg.color+"33":"none",
                    opacity:!can&&!maxed?0.45:1,
                  }}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:17}}>{upg.emoji}</span>
                    <span style={{fontSize:8,fontWeight:700,color:maxed?"#4ade80":upg.color}}>
                      {maxed?"MAX":"LV "+lv+"/"+upg.maxLevel}
                    </span>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:"#f1f5f9",marginBottom:1}}>{upg.name}</div>
                  <div style={{fontSize:9,color:"#475569",lineHeight:1.4,marginBottom:4}}>{upg.desc}</div>
                  {!maxed&&<div style={{fontSize:11,fontWeight:700,color:can?"#fbbf24":"#2a2a3a"}}>{"\uD83D\uDCB0"} {fmt(cost)}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Paytable */}
      {tab==="paytable"&&(
        <div style={{width:"min(92vw,480px)",animation:"fadeIn .3s"}}>
          <div style={{background:"#0a0a1a",border:"1px solid #1e1e3a",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
            <div style={{fontSize:8,color:"#475569",letterSpacing:".2em",marginBottom:8}}>SYMBOLS (base value)</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
              {SYM.map(s=>(
                <div key={s.id} style={{textAlign:"center",background:"#12122a",borderRadius:8,padding:"5px 2px"}}>
                  <div style={{fontSize:19}}>{s.e}</div>
                  <div style={{fontSize:10,color:"#fbbf24",fontWeight:700}}>{s.base}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:"#0a0a1a",border:"1px solid #1e1e3a",borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:8,color:"#475569",letterSpacing:".2em",marginBottom:8}}>HOW WINS WORK</div>
            {[
              "Match 3+ of the same symbol",
              "Every symbol must touch the next",
              "Touching = horizontal, vertical, or diagonal",
              "No skipping over other symbols",
              "Bigger connected groups = bigger pay",
              "Fill the whole grid = MEGA JACKPOT",
            ].map((rule,i)=>(
              <div key={i} style={{fontSize:10,color:"#64748b",marginBottom:4,display:"flex",gap:6}}>
                <span style={{color:"#4f46e5",flexShrink:0}}>{i+1}.</span>{rule}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {tab==="history"&&(
        <div style={{width:"min(92vw,480px)",animation:"fadeIn .3s"}}>
          {history.length===0&&<div style={{textAlign:"center",color:"#374151",fontSize:12,padding:"20px"}}>No spins yet!</div>}
          {history.map(h=>(
            <div key={h.id} style={{
              background:"#0a0a1a",border:"1px solid #1e1e3a",borderRadius:10,
              padding:"8px 12px",marginBottom:6,
              borderLeft:h.pay>0?"3px solid #4ade80":"3px solid #1e1e3a",
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:h.wins.length?4:0}}>
                <div style={{fontSize:13,letterSpacing:1}}>{h.preview}</div>
                <div style={{fontWeight:700,fontSize:12,color:h.pay>0?"#4ade80":"#475569"}}>
                  {h.pay>0?"+"+fmt(h.pay):"no win"}
                </div>
              </div>
              {h.wins.map((w,i)=>(
                <div key={i} style={{fontSize:9,color:"#475569",display:"flex",justifyContent:"space-between"}}>
                  <span>{SYM.find(s=>s.id===w.symId)?.e} {w.lineName} x{w.count}</span>
                  <span style={{color:w.isMega?"#fbbf24":w.isJack?"#fb923c":"#4ade80"}}>+{fmt(w.pay)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
