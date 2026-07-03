import { generateFloor } from "./src/generator.js";
import { getThemeWallAtlasCoord } from "./src/render.js";
for(const [seed,fn] of [[20250703,16],[20250703,17],[42,16],[1,18]]){
  const f=generateFloor(seed,fn,"warrior"); const map=f.map;
  const isFloorT=(x,y)=>map[y]?.[x]?.type==="floor";
  const isWallT=(x,y)=>map[y]?.[x]?.type==="wall";
  const adj=(x,y)=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;if(isFloorT(x+dx,y+dy))return true;}return false;};
  const drawn=(x,y)=>isWallT(x,y)&&adj(x,y);
  const co=(x,y)=>{const c=getThemeWallAtlasCoord(f.theme,map,x,y,{useExploredMask:true});return c?`${c[0]},${c[1]}`:"NUL";};
  // south-terminating vertical: wall above (drawn), floor below, and it's vertical (not part of horizontal run: no drawn wall E or W)
  const rows=[];
  for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
    if(!drawn(x,y))continue;
    const nW=drawn(x,y-1), sF=isFloorT(x,y+1);
    const wW=drawn(x-1,y), eW=drawn(x+1,y);
    if(nW&&sF&&!wW&&!eW){
      const wF=isFloorT(x-1,y), eF=isFloorT(x+1,y);
      const side = wF&&eF?"BOTH": wF?"W-floor": eF?"E-floor":"neither(void)";
      rows.push(`  s${seed} f${fn} (${x},${y}) -> [${co(x,y)}]  sides=${side}`);
    }
  }
  if(rows.length){console.log(`seed ${seed} floor ${fn}:`); console.log(rows.join("\n"));}
}
