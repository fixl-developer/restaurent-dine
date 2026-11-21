import * as T from "three";
import type { TableShape, TableStatus } from "@/lib/dto/tables";

export interface RoomObject {
  id: string;
  label: string;
  detail: string;
  x: number;
  z: number;
  kind: TableShape | "intake" | "range" | "pass";
  capacity?: number;
  status?: TableStatus;
  highlighted?: boolean;
}

export const statusColors: Record<TableStatus, string> = {
  vacant: "#287961", seated: "#365eac", ordered: "#a86313",
  awaiting_bill: "#ac3f54", cleaning: "#66686b",
};

function oakGrain() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = "#fff8e9"; ctx.fillRect(0,0,256,128);
  for (let y=0;y<128;y+=1.7) {
    ctx.beginPath(); ctx.strokeStyle = y%5 < 2 ? "#83542c28" : "#b78a5820";
    for (let x=0;x<=256;x+=4) {
      const line=y+Math.sin(x/32+y*.13)*1.1+Math.cos(x/17+y*.21)*.65;
      if (!x) ctx.moveTo(x,line); else ctx.lineTo(x,line);
    }
    ctx.stroke();
  }
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  return texture;
}

export function createInterior(objects: RoomObject[], kitchen: boolean) {
  const room = new T.Group();
  const grain = oakGrain();
  const materials = new Map<string,T.MeshStandardMaterial>();
  const block = new T.BoxGeometry(1,1,1);
  const cylinder = new T.CylinderGeometry(.5,.5,1,24);
  function solid(parent: T.Group, round: boolean, color: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    let material = materials.get(color);
    if (!material) {
      const metal = ["#b0bfbe","#849894","#e1e8e3","#505f5d"].includes(color);
      material = new T.MeshStandardMaterial({
        color, metalness: metal ? .32 : .04, roughness: metal ? .4 : .76,
        map: color==="#ad7950" || (!kitchen && ["#d7bb97","#ddc3a2","#d3b591"].includes(color)) ? grain : null,
      });
      materials.set(color, material);
    }
    const mesh = new T.Mesh(round ? cylinder : block, material);
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const wood = "#ad7950", iron = "#343e38", steel = "#b0bfbe", cream = "#f7ecd2";
  function diningTable(group: T.Group, item: RoomObject) {
    const seats = Math.min(12, Math.max(1,item.capacity ?? 2));
    const round = item.kind === "round";
    const width = item.kind === "rect" ? Math.max(1.6, seats * .3) : round ? Math.max(1.02,seats * .21) : 1.16;
    const depth = round ? width : 1.02;
    solid(group,true,iron,0,.05,0,.56,.09,.56);
    solid(group,true,iron,0,.4,0,.16,.72,.16);
    solid(group,round,wood,0,.79,0,width,.105,depth);
    for (let i=0;i<seats;i++) {
      const a = round ? (2*Math.PI*i/seats) : (i%2 ? 0 : Math.PI);
      const x = round ? Math.sin(a)*(width/2+.2) : ((Math.floor(i/2)+.5)/Math.ceil(seats/2)-.5)*width;
      const z = Math.cos(a)*(depth/2+.21);
      const chair = new T.Group();
      chair.position.set(x,0,z);
      chair.rotation.y = a;
      group.add(chair);
      solid(chair,false,"#31594d",0,.43,0,.41,.09,.4);
      solid(chair,false,"#3d6557",0,.64,.18,.4,.32,.065);
      for (const cx of [-.15,.15]) for (const cz of [-.14,.14])
        solid(chair,false,wood,cx,.21,cz,.045,.42,.045);
      solid(group,true,cream,x*.65,.854,z*.57,.24,.02,.24);
    }
    solid(group,true,"#b77e55",0,.9,0,.13,.14,.13);
    solid(group,true,"#638555",0,1.02,0,.17,.16,.17);
  }
  function kitchenBench(group: T.Group, kind: RoomObject["kind"]) {
    solid(group,false,"#505f5d",0,.12,0,2.32,.17,1.04);
    solid(group,false,steel,0,.57,0,2.48,.79,1.16);
    solid(group,false,"#e1e8e3",0,1,0,2.59,.1,1.26);
    for (const x of [-.61,.61]) {
      solid(group,false,"#849894",x,.58,.59,1.17,.68,.035);
      solid(group,false,iron,x,.81,.63,.33,.035,.04);
    }
    if (kind === "intake") {
      solid(group,false,wood,-.28,1.09,0,1.12,.07,.58);
      solid(group,false,"#496258",.79,1.31,-.22,.53,.47,.11);
      solid(group,false,"#c6dccf",.79,1.32,-.15,.43,.32,.015);
      // A raised docket rail behind the cutting board.
      for (const x of [-.87,.36]) solid(group,false,iron,x,1.36,-.43,.045,.61,.045);
      solid(group,false,steel,-.255,1.66,-.43,1.33,.07,.07);
      for (const x of [-.65,-.27,.09]) solid(group,false,cream,x,1.53,-.40,.23,.22,.022);
      for (const x of [-.55,-.31,-.02]) solid(group,true,"#bc5542",x,1.18,0,.13,.12,.13);
    } else if (kind === "range") {
      solid(group,false,iron,0,1.07,0,2.25,.06,.98);
      solid(group,false,iron,0,.52,.618,1.57,.36,.035);
      solid(group,false,"#667675",0,.53,.645,1.32,.22,.02);
      solid(group,false,steel,0,.75,.68,1.62,.045,.065);
      for (const x of [-.76,-.26,.26,.76]) {
        const dial=solid(group,true,iron,x,.88,.64,.11,.08,.11);
        dial.rotation.x=Math.PI/2;
      }
      for (const x of [-.64,.64]) {
        solid(group,true,"#77623e",x,1.12,0,.71,.05,.71);
        solid(group,true,"#546662",x,1.32,0,.61,.36,.61);
        solid(group,true,steel,x,1.52,0,.65,.05,.65);
        solid(group,true,iron,x,1.57,0,.12,.06,.12);
        for (const s of [-1,1]) solid(group,false,iron,x+s*.34,1.38,0,.14,.08,.08);
      }
    } else {
      for (const x of [-1,1]) solid(group,false,iron,x,1.37,-.35,.06,.66,.06);
      solid(group,false,wood,0,1.75,-.28,2.38,.11,.47);
      for (const x of [-.63,.35]) for (let n=0;n<4;n++)
        solid(group,true,cream,x,1.08+n*.036,.13,.51,.035,.51);
    }
  }
  const anchors = objects.map(item => {
    const group = new T.Group();
    group.position.set(item.x,0,item.z);
    group.userData.roomId = item.id;
    room.add(group);
    if (kitchen) kitchenBench(group,item.kind);
    else diningTable(group,item);
    return {id:item.id, point:new T.Vector3(item.x,kitchen ? 1.96 : 1.26,item.z)};
  });
  const bounds = new T.Box3().setFromObject(room);
  if (bounds.isEmpty()) bounds.set(new T.Vector3(-2,0,-2),new T.Vector3(2,1,2));
  const size = bounds.getSize(new T.Vector3());
  const mid = bounds.getCenter(new T.Vector3());
  const w = Math.max(5,size.x + 1.9), d = Math.max(3.8,size.z + 1.8);
  const rear = mid.z-d/2;
  solid(room,false,kitchen ? "#a7aea9" : "#bba383",mid.x,-.11,mid.z,w,.2,d).renderOrder = -30;
  const boards = Math.min(48,Math.ceil(d/.62));
  for(let i=0;i<boards;i++) {
    const palette = kitchen ? ["#c0c7c1","#c4ccc5"] : ["#d7bb97","#ddc3a2","#d3b591"];
    solid(room,false,palette[i%palette.length],mid.x,-.012,rear+(i+.5)*d/boards,w,.02,d/boards-.014).renderOrder = -29;
  }
  solid(room,false,kitchen ? "#9daba2" : "#617867",mid.x,.64,rear,w,1.3,.12);
  solid(room,false,wood,mid.x,1.32,rear,w+.04,.075,.18);
  if (kitchen) {
    const cols = Math.ceil(w/.58);
    for (let r=0;r<3;r++) for (let c=0;c<cols;c++) {
      solid(room,false,(c+r)%4 ? "#c9d6d0" : "#b8cbc2",mid.x-w/2+(c+.5)*w/cols,.73+r*.21,rear+.075,w/cols-.016,.195,.025);
    }
  }
  if (!kitchen) {
    // A plant at the edge of the room gives the furniture a scale reference.
    const plant = new T.Group();
    plant.position.set(mid.x-w/2+.45,0,rear+.42);
    room.add(plant);
    solid(plant,true,"#a85e43",0,.22,0,.46,.44,.46);
    solid(plant,true,wood,0,.55,0,.075,.48,.075);
    for (let i=0;i<7;i++) {
      const angle=i*2.4;
      const leaf=solid(plant,true,i%2 ? "#587157" : "#3f684f",Math.sin(angle)*.16,.77+i*.045,Math.cos(angle)*.16,.18,.48,.10);
      leaf.rotation.set(Math.cos(angle)*.7,angle,-Math.sin(angle)*.7);
    }
    const panels = Math.min(18,Math.floor(w/1.25));
    for (let i=0;i<panels;i++) {
      const x = mid.x-w/2+(i+.5)*w/panels;
      solid(room,false,"#d4e3d9",x,.88,rear+.07,w/panels-.09,.64,.035);
    }
  }
  return {room, anchors, center:new T.Vector3(mid.x,.42,mid.z), width:w, depth:d,
    dispose() { grain?.dispose(); block.dispose(); cylinder.dispose(); materials.forEach(m=>m.dispose()); } };
}
