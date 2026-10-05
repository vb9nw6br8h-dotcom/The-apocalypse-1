const WebSocket=require('ws'),http=require('http'),fs=require('fs'),path=require('path');
const PORT=process.env.PORT||3000, SAVE=path.join(__dirname,'save.json');
const rooms=new Map();
const guns={pistol:{damage:2,fireRate:350,mag:12,range:45},smg:{damage:1,fireRate:110,mag:30,range:42},shotgun:{damage:7,fireRate:700,mag:6,range:28},rifle:{damage:5,fireRate:500,mag:20,range:65}};
const skins=['survivor','soldier','ranger','medic','scavenger','hunter'];
const pets=['dog','wolf','robot'];
const achievementDefs={
 first_blood:{name:'First Blood',goal:1,reward:1},
 zombie_hunter:{name:'Zombie Hunter',goal:25,reward:2},
 horde_slayer:{name:'Horde Slayer',goal:100,reward:4},
 wave_survivor:{name:'Wave Survivor',goal:5,reward:3},
 scavenger:{name:'Scavenger',goal:5,reward:2},
 builder:{name:'Builder',goal:10,reward:3},
 night_owl:{name:'Night Owl',goal:3,reward:2}
};
let saved={players:{},rooms:{}};try{saved=JSON.parse(fs.readFileSync(SAVE,'utf8'));if(!saved.players)saved={players:saved,rooms:{}}}catch{}
function save(){try{fs.writeFileSync(SAVE,JSON.stringify(saved,null,2))}catch{}}
function persistRoom(R){saved.rooms[R.code]={bases:R.bases,chests:R.chests,vehicles:R.vehicles,wave:R.wave};save()}
function restoreRoom(code){const x=saved.rooms[code];if(!x)return null;const R=newRoom(code);R.bases=x.bases||[];R.chests=x.chests||[];R.vehicles=x.vehicles||[];R.wave=x.wave||1;ensureWorld(R);return R}
function newRoom(code){return {code,players:new Map(),zombies:[],bases:[],chests:[],vehicles:[],wave:1,night:false,nextWave:0,worldSeed:Math.random()};}
function defaultPlayer(){return {x:0,z:10,hp:100,skin:'survivor',wood:30,stone:20,metal:10,food:5,medkits:2,kills:0,gun:'pistol',ammo:12,inventory:{wood:30,stone:20,metal:10,food:5,medkit:2},pet:null,vehicle:null,lastShot:0,tokens:0,achievements:{},stats:{chests:0,built:0,nights:0,waves:0}};}
function loadPlayer(id){let p={...defaultPlayer(),...(saved.players[id]||{})};p.inventory={...defaultPlayer().inventory,...(saved.players[id]?.inventory||{})};p.achievements={...(saved.players[id]?.achievements||{})};p.stats={...defaultPlayer().stats,...(saved.players[id]?.stats||{})};return p}
function persist(id,p){const q={...p,ws:undefined,lastShot:0};saved.players[id]=q;save()}
function spawnWave(R){const count=Math.min(6+R.wave*3,45);for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,d=55+Math.random()*35;R.zombies.push({id:Math.random().toString(36).slice(2),x:Math.cos(a)*d,z:Math.sin(a)*d,hp:2+Math.floor(R.wave/3)+(R.night?2:0),speed:.045+Math.min(R.wave*.003,.11)+(R.night?.025:0),damage:R.night?.18:.11});}R.nextWave=Date.now()+12000;}
function ensureWorld(R){if(!R.chests.length)for(let i=0;i<22;i++)R.chests.push({id:Math.random().toString(36).slice(2),x:(Math.random()-.5)*150,z:(Math.random()-.5)*150,opened:false});if(!R.vehicles.length)R.vehicles=[{id:'car',type:'buggy',x:12,z:14,owner:null,fuel:100}];}
function updateAchievements(p,R){
 const progress={first_blood:p.kills,zombie_hunter:p.kills,horde_slayer:p.kills,wave_survivor:R.wave,scavenger:p.stats.chests,builder:p.stats.built,night_owl:p.stats.nights};
 for(const [k,a] of Object.entries(achievementDefs)){if(!p.achievements[k] && (progress[k]||0)>=a.goal){p.achievements[k]=true;p.tokens+=a.reward;}}
}
function state(R){return {players:Object.fromEntries([...R.players].map(([id,p])=>[id,{x:p.x,z:p.z,hp:p.hp,skin:p.skin,wood:p.wood,stone:p.stone,metal:p.metal,food:p.food,medkits:p.medkits,kills:p.kills,gun:p.gun,ammo:p.ammo,inventory:p.inventory,pet:p.pet,vehicle:p.vehicle,tokens:p.tokens,achievements:p.achievements}])),zombies:R.zombies,bases:R.bases,chests:R.chests,vehicles:R.vehicles,wave:R.wave,night:R.night,achievementDefs};}
function broadcast(R){const m=JSON.stringify(state(R));R.players.forEach(p=>{if(p.ws.readyState===1)p.ws.send(m)})}
const server=http.createServer((req,res)=>{let f=req.url==='/'?'index.html':req.url.slice(1);if(!['index.html','manifest.json','sw.js'].includes(f))f='index.html';try{const d=fs.readFileSync(path.join(__dirname,f));res.writeHead(200,{'Content-Type':f.endsWith('.json')?'application/json':f.endsWith('.js')?'application/javascript':'text/html'});res.end(d)}catch{res.writeHead(404);res.end('Not found')}});
const wss=new WebSocket.Server({server});
wss.on('connection',ws=>{let id=Math.random().toString(36).slice(2,10);let R=null;
ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}if(m.type==='join'){const code=(m.room||'ROOM').toUpperCase().slice(0,6);if(m.pid&&/^[a-z0-9_-]{6,40}$/i.test(m.pid))id=m.pid;if(!rooms.has(code)){R=restoreRoom(code)||newRoom(code);ensureWorld(R);if(!R.zombies.length)spawnWave(R);rooms.set(code,R)}else R=rooms.get(code);const p=loadPlayer(id);p.ws=ws;R.players.set(id,p);ws.send(JSON.stringify({type:'welcome',id,room:code}));broadcast(R);return}if(!R)return;const p=R.players.get(id);if(!p)return;
if(m.type==='move'){p.x=Math.max(-78,Math.min(78,Number(m.x)||0));p.z=Math.max(-78,Math.min(78,Number(m.z)||0))}
if(m.type==='shoot'){const g=guns[p.gun]||guns.pistol;if(Date.now()-p.lastShot<g.fireRate)return;if(p.ammo<=0)return;p.lastShot=Date.now();p.ammo--;const i=Number(m.zombie),z=R.zombies[i];if(z&&Math.hypot(z.x-p.x,z.z-p.z)<=g.range){z.hp-=g.damage;if(z.hp<=0){R.zombies.splice(i,1);p.kills++;p.wood+=2+Math.floor(Math.random()*3);p.inventory.wood=p.wood;if(Math.random()<.18)p.inventory.metal=(p.metal=(p.metal||0)+1);}}}
if(m.type==='reload')p.ammo=(guns[p.gun]||guns.pistol).mag;
if(m.type==='equip'&&guns[m.gun]){p.gun=m.gun;p.ammo=guns[m.gun].mag}
if(m.type==='craft'){const recipes={medkit:{wood:5,metal:2},ammo:{metal:3},smg:{wood:8,metal:18},shotgun:{wood:10,metal:25},rifle:{wood:15,metal:35}};const q=recipes[m.item];if(q&&(p.wood||0)>=(q.wood||0)&&(p.metal||0)>=(q.metal||0)){p.wood-=(q.wood||0);p.metal-=(q.metal||0);if(m.item==='medkit'){p.medkits++;p.inventory.medkit=p.medkits}else if(m.item==='ammo'){p.ammo+=(guns[p.gun]||guns.pistol).mag}else p.gun=m.item;p.inventory.wood=p.wood;p.inventory.metal=p.metal;}}
if(m.type==='build'){const costs={wall:{wood:10,stone:3},floor:{wood:8},turret:{wood:20,metal:10},campfire:{wood:12},workbench:{wood:25,metal:8}};const q=costs[m.kind];if(q&&(p.wood||0)>=(q.wood||0)&&(p.stone||0)>=(q.stone||0)&&(p.metal||0)>=(q.metal||0)){p.wood-=(q.wood||0);p.stone-=(q.stone||0);p.metal-=(q.metal||0);R.bases.push({kind:m.kind,x:Number(m.x)||0,z:Number(m.z)||0,owner:id,hp:m.kind==='wall'?160:100});p.stats.built++;}}
if(m.type==='openChest'){const ch=R.chests.find(c=>c.id===m.id);if(ch&&!ch.opened&&Math.hypot(ch.x-p.x,ch.z-p.z)<4){ch.opened=true;const loot=Math.floor(Math.random()*3)+1;p.wood+=loot*5;p.metal+=(Math.random()<.7?loot:0);p.food+=loot;p.inventory.wood=p.wood;p.inventory.metal=p.metal;p.inventory.food=p.food;if(Math.random()<.25)p.medkits++;p.stats.chests++;}}
if(m.type==='buyReward'){const costs={ammo:1,medkit:1,skin_gold:3,pet_dog:3,vehicle_buggy:5,weapon_smg:6};const c=costs[m.item];if(c&&p.tokens>=c){p.tokens-=c;if(m.item==='ammo')p.ammo+=(guns[p.gun]||guns.pistol).mag;if(m.item==='medkit')p.medkits++;if(m.item==='skin_gold')p.skin='gold';if(m.item==='pet_dog')p.pet='dog';if(m.item==='vehicle_buggy'){p.vehicle='buggy';const v=R.vehicles.find(v=>v.id==='car');if(v){v.owner=id;v.type='buggy'}}if(m.item==='weapon_smg'){p.gun='smg';p.ammo=guns.smg.mag;}toast=undefined;}}
if(m.type==='customize'&&skins.includes(m.skin))p.skin=m.skin;if(m.type==='pet'&&pets.includes(m.pet))p.pet=m.pet;if(m.type==='vehicle'&&['buggy','truck'].includes(m.vehicle)){p.vehicle=m.vehicle;const v=R.vehicles.find(v=>v.id==='car');if(v){v.owner=id;v.type=m.vehicle}}
if(m.type==='heal'&&p.medkits>0&&p.hp<100){p.medkits--;p.hp=Math.min(100,p.hp+40)}
if(m.type==='respawn'&&p.hp<=0){p.hp=100;p.x=0;p.z=10;p.ammo=(guns[p.gun]||guns.pistol).mag;}
p.inventory={...p.inventory,wood:p.wood,stone:p.stone,metal:p.metal,food:p.food,medkit:p.medkits};updateAchievements(p,R);persist(id,p);broadcast(R);});
ws.on('close',()=>{if(R){const p=R.players.get(id);if(p)persist(id,p);R.players.delete(id);persistRoom(R);if(!R.players.size)rooms.delete(R.code)}})});
setInterval(()=>{for(const R of rooms.values()){const wasNight=R.night;R.night=(Math.floor(Date.now()/60000)%2)===1;if(R.night&&!wasNight)R.players.forEach(p=>p.stats.nights++);R.players.forEach(p=>{if(p.hp<=0)return;R.zombies.forEach(z=>{let dx=p.x-z.x,dz=p.z-z.z,d=Math.hypot(dx,dz)||1;if(d>1.6){z.x+=dx/d*z.speed;z.z+=dz/d*z.speed}else if(Math.hypot(p.x,p.z-10)>12){p.hp=Math.max(0,p.hp-z.damage)}});});R.bases=R.bases.filter(b=>b.hp>0);R.zombies.forEach(z=>R.bases.forEach(b=>{if(Math.hypot(z.x-b.x,z.z-b.z)<2)b.hp-=.04}));if(Date.now()>R.nextWave){
 const shouldAdvance=!R.zombies.length;
 if(shouldAdvance){R.wave++;R.players.forEach(p=>p.stats.waves=R.wave);}
 spawnWave(R);
 // Endless mode: even while a horde is alive, fresh groups keep arriving.
 R.nextWave=Date.now()+(shouldAdvance?12000:18000);
}R.players.forEach(p=>updateAchievements(p,R));broadcast(R)}},100);
server.listen(PORT,()=>console.log('Zombie Survival server '+PORT));
