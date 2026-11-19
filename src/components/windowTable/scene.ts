import * as T from "three";
import { furnishedTable, platedCrepe } from "./models";

export function createScene(
  canvas: HTMLCanvasElement,
  mode: "room" | "dish",
  onAnchor?: (x: number, y: number) => void,
) {
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(38, 1, 0.025, 30);
  let disposed = false;
  const repaint = () => {
    if (!disposed) draw();
  };
  const content =
    mode === "room" ? furnishedTable(repaint) : platedCrepe(repaint);
  scene.add(content);
  scene.add(new T.HemisphereLight(0xfff3dc, 0xa17f6b, 1.75));
  const sun = new T.DirectionalLight(0xffebce, 2.15);
  sun.position.set(-3, 5, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -2,
    right: 2,
    top: 2,
    bottom: -2,
    near: 0.1,
    far: 12,
  });
  sun.shadow.normalBias = 0.002;
  scene.add(sun);
  const floor = new T.Mesh(
    new T.PlaneGeometry(18, 18),
    new T.ShadowMaterial({ opacity: 0.26 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.position.y = -0.005;
  scene.add(floor);
  // At steep angles the camera sees the floor beneath the table.
  const roomFloor = new T.Mesh(
    new T.PlaneGeometry(20, 20),
    new T.MeshStandardMaterial({
      color: 0xc19874,
      roughness: 0.92,
      transparent: true,
      depthWrite: false,
    }),
  );
  roomFloor.rotation.x = -Math.PI / 2;
  roomFloor.position.y = -0.01;
  roomFloor.visible = mode === "room";
  scene.add(roomFloor);
  let progress = 0,
    yaw = -0.8,
    pitch = 0.27;
  const points = (values: number[][]) =>
    new T.CatmullRomCurve3(
      values.map(([x, y, z]) => new T.Vector3(x, y, z)),
      false,
      "centripetal",
    );
  const path = points([
    [1.05, 2.08, 4.1],
    [0.8, 1.72, 2.62],
    [0.28, 3.36, 0.89],
    [0.55, 1.7, 1.21],
  ]);
  const desktopAim = points([
    [-1.3, 1.42, 0],
    [-0.63, 1.26, 0],
    [-0.42, 1.15, 0],
    [-0.06, 1.38, 0.1],
  ]);
  const mobileAim = points([
    [0, 1.29, 0],
    [0, 1.18, 0],
    [0, 1.23, 0],
    [0.21, 1.33, 0.07],
  ]);
  const aim = new T.Vector3();
  const anchor = new T.Vector3();
  function draw() {
    if (mode === "room") {
      path.getPoint(progress, camera.position);
      (camera.aspect < 0.85 ? mobileAim : desktopAim).getPoint(progress, aim);
      camera.lookAt(aim);
      roomFloor.material.opacity = T.MathUtils.smoothstep(
        camera.position.y - aim.y,
        0.65,
        1.6,
      );
    } else {
      const distance = camera.aspect < 1 ? 1.76 : 1.43;
      camera.position.set(
        distance * Math.sin(yaw) * Math.cos(pitch),
        0.13 + distance * Math.sin(pitch),
        distance * Math.cos(yaw) * Math.cos(pitch),
      );
      camera.lookAt(0, 0.13, 0);
    }
    renderer.render(scene, camera);
    if (onAnchor) {
      if (progress < 0.53) anchor.set(0.67, 1.14, 0.13);
      else anchor.set(0.25, 1.43, 0.09);
      anchor.project(camera);
      onAnchor(50 * (anchor.x + 1), 50 * (1 - anchor.y));
    }
  }
  function resize() {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  return {
    move(value: number) {
      progress = value;
      draw();
    },
    orbit(angle: number, elevation: number) {
      yaw = angle;
      pitch = T.MathUtils.clamp(elevation, 0.1, 1.53);
      draw();
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      const materials = new Set<T.Material>();
      scene.traverse((node) => {
        if (node instanceof T.Mesh) {
          node.geometry.dispose();
          for (const m of Array.isArray(node.material)
            ? node.material
            : [node.material])
            materials.add(m);
          if (node instanceof T.InstancedMesh) node.dispose();
        }
      });
      for (const material of materials) {
        for (const value of Object.values(material))
          if (value instanceof T.Texture) value.dispose();
        material.dispose();
      }
      sun.shadow.dispose();
      renderer.dispose();
    },
  };
}
