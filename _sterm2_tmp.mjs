import { generateFloor } from "./src/generator.js";
import { getThemeWallAtlasCoord } from "./src/render.js";
const tally={};
const examples={};
for(let seed=1;seed<=40;seed++) for(const fn of [16,17,18,19]){
  const f=generateFloor(seed,fn,"warrior"); const map=f.map;
  const isFloorT=(x,y)=>map[y]?.[x]?.type==="floor";
  const isWallT=(x,y)=>map[y]?.[x]?.type==="wall";
  const adj=(x,y)=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;if(isFloorT(x+dx,y+dy))return true;}return false;};
  const drawn=(x,y)=>isWallT(x,y)&&adj(x,y);
  const co=(x,y)=>{const c=getThemeWallAtlasCoord(f.theme,map,x,y,{useExploredMask:true});return c?`${c[0]},${c[1]}`:"NUL";};
  for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
    if(!drawn(x,y))continue;
    // bottom of a vertical wall: wall above (drawn), floor directly below
    if(drawn(x,y-1) && isFloorT(x,y+1)){
      const wF=isFloorT(x-1,y), eF=isFloorT(x+1,y), wW=drawn(x-1,y), eW=drawn(x+1,y);
      const wV=!wF&&!wW, eV=!eF&&!eW;
      const side=`W:${wF?'F':wW?'W':'V'} E:${eF?'F':eW?'W':'V'}`;
      const key=`[${co(x,y)}] ${side}`;
      tally[key]=(tally[key]||0)+1;
      if(!examples[key]) examples[key]=`seed${seed} f${fn} (${x},${y})`;
    }
  }
}
for(const k of Object.keys(tally).sort()) console.log(`${String(tally[k]).padStart(4)}  ${k}   e.g. ${examples[k]}`);
