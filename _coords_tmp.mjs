import { generateFloor } from "./src/generator.js";
import { getThemeWallAtlasCoord, getThemeFloorAtlasCoord } from "./src/render.js";
const SEED=+process.argv[2]||1, FN=+process.argv[3]||16;
const f = generateFloor(SEED, FN, "warrior");
const map=f.map;
const isFloorT=(x,y)=>map[y]?.[x]?.type==="floor";
function wallAdjFloor(x,y){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(dx==0&&dy==0)continue;if(isFloorT(x+dx,y+dy))return true;}return false;}
for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){const t=map[y][x];t.explored=t.type==="floor"||(t.type==="wall"&&wallAdjFloor(x,y));t.visible=t.explored;}
const out={width:f.width,height:f.height,theme:f.theme,tiles:[]};
for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
  const t=map[y][x];
  if(!t.explored){ out.tiles.push({x,y,k:"void"}); continue; }
  if(t.type==="wall"){ out.tiles.push({x,y,k:"wall",c:getThemeWallAtlasCoord(f.theme,map,x,y,{useExploredMask:true})}); }
  else if(t.type==="floor"){ out.tiles.push({x,y,k:"floor",c:getThemeFloorAtlasCoord(f.theme,x,y)}); }
  else out.tiles.push({x,y,k:"void"});
}
process.stdout.write(JSON.stringify(out));
