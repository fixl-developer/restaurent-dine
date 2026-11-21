import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as T from "three";
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer.js";
import { Minus, Plus, RotateCcw, RotateCw, Scan } from "lucide-react";
import { TABLE_STATUS_LABELS } from "@/lib/dto/tables";
import { createInterior, statusColors, type RoomObject } from "./roomModels";
import "./serviceRoom.css";

type Props = { objects: RoomObject[]; kitchen?: boolean; selected?: string | null; onSelect: (id: string) => void };
export default function ServiceRoom({ objects, kitchen = false, selected, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string,HTMLButtonElement>());
  const select = useRef(onSelect);
  select.current = onSelect;
  const cameraState = useRef({angle: .48, zoom: 1, x: 0, y: 0});
  const repaint = useRef<() => void>(()=>{});
  const [failed,setFailed] = useState(false);
  // Status, ticket counts and selection change labels without rebuilding geometry.
  const layout = JSON.stringify(objects.map(({id,x,z,kind,capacity})=>({id,x,z,kind,capacity})));

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let renderer: T.WebGLRenderer | SVGRenderer;
    try {
      renderer = new T.WebGLRenderer({antialias:true,alpha:true});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
    } catch {
      try { renderer = new SVGRenderer(); renderer.setQuality("low"); }
      catch { setFailed(true); return; }
    }
    setFailed(false);
    const el = renderer.domElement;
    node.prepend(el);
    el.setAttribute("aria-hidden","true");
    const interior = createInterior(JSON.parse(layout),kitchen);
    const scene = new T.Scene();
    scene.background = new T.Color(kitchen ? "#e1e8e2" : "#efe7da");
    scene.add(interior.room);
    if (renderer instanceof SVGRenderer) scene.add(new T.AmbientLight(0xf5ebd9,.52));
    scene.add(new T.HemisphereLight(0xfff9ed,0xc1af9c,2.1));
    const sun = new T.DirectionalLight(0xfff3d8,renderer instanceof SVGRenderer ? .95 : 2.35);
    const radius = Math.max(interior.width,interior.depth);
    sun.position.copy(interior.center).add(new T.Vector3(-radius,radius*1.8,radius));
    sun.target.position.copy(interior.center);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,far:radius*5});
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.normalBias=.025;
    scene.add(sun,sun.target);
    const camera = new T.OrthographicCamera(-1,1,1,-1,.01,radius*8+40);
    const ray = new T.Raycaster();
    const projected = new T.Vector3();
    function draw() {
      if (!node) return;
      const w = node.clientWidth, h = node.clientHeight;
      if (!w || !h) return;
      const v = cameraState.current;
      const wide = Math.abs(Math.cos(v.angle))*interior.width + Math.abs(Math.sin(v.angle))*interior.depth;
      const deep = Math.abs(Math.sin(v.angle))*interior.width + Math.abs(Math.cos(v.angle))*interior.depth;
      const scale = Math.max((wide+.75)/(w/h),deep*.64+2.2)/v.zoom;
      camera.left = -scale*w/h/2; camera.right = -camera.left;
      camera.top = scale/2; camera.bottom = -camera.top;
      camera.left -= v.x*scale/h; camera.right -= v.x*scale/h;
      camera.top += v.y*scale/h; camera.bottom += v.y*scale/h;
      camera.updateProjectionMatrix();
      camera.position.copy(interior.center).add(new T.Vector3(Math.sin(v.angle),.82,Math.cos(v.angle)).multiplyScalar(radius+6));
      camera.lookAt(interior.center);
      camera.updateMatrixWorld();
      renderer.render(scene,camera);
      for (const {id,point} of interior.anchors) {
        const button = buttons.current.get(id);
        if (!button) continue;
        projected.copy(point).project(camera);
        button.style.left = ((projected.x+1)*50) + "%";
        button.style.top = ((1-projected.y)*50) + "%";
      }
    }
    repaint.current = draw;
    const observer = new ResizeObserver(() => { renderer.setSize(node.clientWidth,node.clientHeight); draw(); });
    observer.observe(node);
    let drag: {id:number;x:number;y:number;ox:number;oy:number;moved:boolean} | null = null;
    function down(e:PointerEvent) {
      if (e.button !== 0 || e.target instanceof HTMLButtonElement || (e.target as Element).closest("button")) return;
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,ox:cameraState.current.x,oy:cameraState.current.y,moved:false};
      node!.setPointerCapture(e.pointerId);
    }
    function move(e:PointerEvent) {
      if (!drag || drag.id!==e.pointerId) return;
      const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      if (!drag.moved && Math.hypot(dx,dy)<5) return;
      drag.moved=true; cameraState.current.x=drag.ox+dx; cameraState.current.y=drag.oy+dy; draw();
    }
    function up(e:PointerEvent) {
      if (!drag || drag.id!==e.pointerId) return;
      if (!drag.moved) {
        const rect=node!.getBoundingClientRect();
        ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
        let hit: T.Object3D | null = ray.intersectObjects(interior.room.children,true)[0]?.object ?? null;
        while (hit && !hit.userData.roomId) hit=hit.parent;
        if (hit) select.current(hit.userData.roomId);
      }
      drag=null;
    }
    function cancel() { drag=null; }
    node.addEventListener("pointerdown",down); node.addEventListener("pointermove",move);
    node.addEventListener("pointerup",up); node.addEventListener("pointercancel",cancel);
    return () => {
      observer.disconnect(); repaint.current=()=>{};
      node.removeEventListener("pointerdown",down); node.removeEventListener("pointermove",move);
      node.removeEventListener("pointerup",up); node.removeEventListener("pointercancel",cancel);
      interior.dispose(); sun.shadow.dispose();
      if (renderer instanceof T.WebGLRenderer) { renderer.dispose(); renderer.forceContextLoss(); }
      el.remove();
    };
  },[layout,kitchen]);

  function adjust(rotation:number,zoom:number) {
    cameraState.current.angle += rotation;
    cameraState.current.zoom = Math.max(.7,Math.min(3,cameraState.current.zoom*zoom));
    repaint.current();
  }

  return <div className="service-room">
    <div className="sr-room-tools" role="group" aria-label="3D camera controls">
      <span>{kitchen ? "Kitchen line" : "Dining room"}</span>
      <button aria-label="Rotate left" onClick={()=>adjust(-Math.PI/8,1)}><RotateCcw size={16}/></button>
      <button aria-label="Rotate right" onClick={()=>adjust(Math.PI/8,1)}><RotateCw size={16}/></button>
      <button aria-label="Zoom out" onClick={()=>adjust(0,1/1.25)}><Minus size={16}/></button>
      <button aria-label="Zoom in" onClick={()=>adjust(0,1.25)}><Plus size={16}/></button>
      <button aria-label="Fit room" onClick={()=>{cameraState.current={angle:.48,zoom:1,x:0,y:0}; repaint.current();}}><Scan size={16}/></button>
    </div>
    <div className="sr-room-stage" ref={host} data-kitchen={kitchen} data-failed={failed}>
      {objects.map(o=><button type="button" key={o.id}
        ref={button=>{if(button) buttons.current.set(o.id,button); else buttons.current.delete(o.id);}}
        aria-pressed={selected===o.id} aria-label={o.label + ", " + o.detail} title={o.label + " · " + o.detail}
        className="sr-room-label" data-target={o.highlighted}
        style={{"--signal":o.status ? statusColors[o.status] : "#527367"} as CSSProperties}
        onClick={()=>onSelect(o.id)}>
        {o.label}<small>{o.status ? TABLE_STATUS_LABELS[o.status] : o.detail}</small>
      </button>)}
    </div>
  </div>;
}
