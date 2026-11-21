import * as T from "three";

type Surface = T.MeshStandardMaterial;
const vec = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const surface = (color: string, roughness = 0.65) =>
  new T.MeshStandardMaterial({ color, roughness });

function mesh(
  parent: T.Object3D,
  shape: T.BufferGeometry,
  material: Surface,
  x = 0,
  y = 0,
  z = 0,
) {
  const object = new T.Mesh(shape, material);
  object.position.set(x, y, z);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}

function cylinder(
  parent: T.Object3D,
  top: number,
  bottom: number,
  height: number,
  mat: Surface,
  x: number,
  y: number,
  z: number,
) {
  return mesh(
    parent,
    new T.CylinderGeometry(top, bottom, height, 64),
    mat,
    x,
    y,
    z,
  );
}

function bentwood(
  parent: T.Object3D,
  points: number[][],
  radius: number,
  mat: Surface,
) {
  const path = new T.CatmullRomCurve3(points.map(([x, y, z]) => vec(x, y, z)));
  return mesh(parent, new T.TubeGeometry(path, 36, radius, 8, false), mat);
}

function pottery(
  parent: T.Object3D,
  profile: number[][],
  mat: Surface,
  x: number,
  y: number,
  z: number,
) {
  return mesh(
    parent,
    new T.LatheGeometry(
      profile.map(([r, h]) => new T.Vector2(r, h)),
      72,
    ),
    mat,
    x,
    y,
    z,
  );
}

// The same plated slice is used in the room and the inspection viewer.
export function platedCrepe(onTexture: () => void) {
  const plate = new T.Group();
  const glaze = surface("#f3e4c9", 0.29);
  pottery(
    plate,
    [
      [0, 0],
      [0.3, 0],
      [0.42, 0.025],
      [0.46, 0.045],
      [0.46, 0.056],
      [0.44, 0.061],
      [0.36, 0.043],
      [0.29, 0.021],
      [0, 0.021],
    ],
    glaze,
    0,
    0,
    0,
  );
  const cake = new T.Group();
  cake.position.set(0, 0.023, 0.03);
  plate.add(cake);
  const shape = new T.Shape();
  shape.moveTo(-0.22, -0.14);
  shape.quadraticCurveTo(0, -0.25, 0.22, -0.14);
  shape.lineTo(0.014, 0.3);
  shape.quadraticCurveTo(0.003, 0.32, -0.009, 0.3);
  shape.closePath();
  const level = 0.245;
  const slice = new T.ExtrudeGeometry(shape, {
    depth: level,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.004,
    bevelThickness: 0.003,
    curveSegments: 16,
  });
  const positions = slice.getAttribute("position");
  const uvs = slice.getAttribute("uv");
  for (const group of slice.groups) {
    for (let i = group.start; i < group.start + group.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i);
      if (group.materialIndex === 0)
        uvs.setXY(i, (x + 0.25) * 2, (y + 0.21) * 1.85);
      else uvs.setXY(i, x * 1.1 + y * 1.2 + 0.5, z / level);
    }
  }
  slice.rotateX(-Math.PI / 2);
  const textured = (name: string) => {
    const mat = surface("#ffffff", 0.88);
    mat.map = new T.TextureLoader().load(
      "/window-table/" + name + ".webp",
      onTexture,
    );
    mat.map.colorSpace = T.SRGBColorSpace;
    mat.map.wrapS = T.MirroredRepeatWrapping;
    mat.bumpMap = mat.map;
    mat.bumpScale = 0.003;
    return mat;
  };
  const sliceMesh = new T.Mesh(slice, [textured("powder"), textured("layers")]);
  sliceMesh.castShadow = sliceMesh.receiveShadow = true;
  cake.add(sliceMesh);
  const petal = mesh(
    cake,
    new T.SphereGeometry(1, 20, 10),
    surface("#d77c89"),
    0,
    level + 0.012,
    0.07,
  );
  petal.scale.set(0.03, 0.009, 0.057);
  petal.rotation.z = -0.21;
  // Matcha dust on the upper surface is instanced to keep draw calls low.
  const dust = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 0),
    surface("#536321"),
    520,
  );
  const stamp = new T.Object3D();
  let seed = 27;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < dust.count; i++) {
    const t = Math.sqrt(rand());
    stamp.position.set(
      (rand() - 0.5) * 0.415 * t,
      level + 0.0009,
      -0.291 + t * 0.44,
    );
    stamp.scale.setScalar(0.0007 + rand() * 0.0015);
    stamp.updateMatrix();
    dust.setMatrixAt(i, stamp.matrix);
  }
  cake.add(dust);
  return plate;
}

function chair(wood: Surface) {
  const group = new T.Group();
  cylinder(group, 0.33, 0.32, 0.065, wood, 0, 0.7, 0);
  cylinder(group, 0.295, 0.29, 0.016, surface("#b68b55"), 0, 0.74, 0);
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      bentwood(
        group,
        [
          [x * 0.27, 0.015, z * 0.28],
          [x * 0.22, 0.4, z * 0.22],
          [x * 0.21, 0.7, z * 0.2],
        ],
        0.026,
        wood,
      );
    }
  bentwood(
    group,
    [
      [-0.25, 0.65, -0.19],
      [-0.28, 1.08, -0.28],
      [-0.22, 1.34, -0.34],
      [0, 1.42, -0.36],
      [0.22, 1.34, -0.34],
      [0.28, 1.08, -0.28],
      [0.25, 0.65, -0.19],
    ],
    0.031,
    wood,
  );
  bentwood(
    group,
    [
      [-0.18, 0.75, -0.23],
      [-0.14, 1.11, -0.3],
      [0, 1.21, -0.32],
      [0.14, 1.11, -0.3],
      [0.18, 0.75, -0.23],
    ],
    0.018,
    wood,
  );
  return group;
}

export function furnishedTable(onTexture: () => void) {
  const group = new T.Group();
  const brass = surface("#886341", 0.37);
  brass.metalness = 0.44;
  const stone = surface("#efcfac");
  const tile = document.createElement("canvas");
  tile.width = tile.height = 512;
  const ctx = tile.getContext("2d")!;
  ctx.fillStyle = "#f2dcc7";
  ctx.fillRect(0, 0, 512, 512);
  let seed = 41;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const chips = ["#d3ad90", "#ab8074", "#f9e9cf", "#ceb5a6", "#ca9e89"];
  for (let i = 0; i < 12500; i++) {
    const x = rand() * 512,
      y = rand() * 512,
      r = 0.3 + Math.pow(rand(), 5) * 6;
    ctx.fillStyle = chips[i % chips.length];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + r, y - r * 0.6);
    ctx.lineTo(x + r * 1.4, y + r * 0.45);
    ctx.lineTo(x + r * 0.25, y + r);
    ctx.fill();
  }
  stone.map = new T.CanvasTexture(tile);
  stone.map.colorSpace = T.SRGBColorSpace;
  cylinder(group, 1, 1, 0.073, stone, 0, 1.09, 0);
  cylinder(group, 0.99, 0.98, 0.015, brass, 0, 1.046, 0);
  pottery(
    group,
    [
      [0, 0.006],
      [0.4, 0.006],
      [0.42, 0.025],
      [0.4, 0.06],
      [0.19, 0.1],
      [0.075, 0.16],
      [0.055, 0.9],
      [0.2, 1.04],
    ],
    brass,
    0,
    0,
    0,
  );
  const wood = surface("#714326", 0.42);
  for (const [x, z, angle] of [
    [1.05, 0.12, -Math.PI / 2],
    [-0.82, -0.53, 0.95],
  ]) {
    const seat = chair(wood);
    seat.position.set(x, 0, z);
    seat.rotation.y = angle;
    group.add(seat);
  }
  const cup = surface("#96a17a", 0.28),
    tea = surface("#899646", 0.35);
  pottery(
    group,
    [
      [0, 0],
      [0.19, 0],
      [0.28, 0.018],
      [0.28, 0.025],
      [0.17, 0.021],
      [0, 0.018],
    ],
    cup,
    -0.4,
    1.128,
    -0.3,
  );
  pottery(
    group,
    [
      [0, 0],
      [0.1, 0],
      [0.17, 0.06],
      [0.193, 0.18],
      [0.19, 0.214],
      [0.179, 0.214],
      [0.175, 0.19],
      [0.12, 0.045],
      [0, 0.035],
    ],
    cup,
    -0.4,
    1.15,
    -0.3,
  );
  cylinder(group, 0.178, 0.17, 0.006, tea, -0.4, 1.349, -0.3);
  bentwood(
    group,
    [
      [-0.57, 1.32, -0.3],
      [-0.67, 1.335, -0.3],
      [-0.68, 1.25, -0.3],
      [-0.55, 1.22, -0.3],
    ],
    0.022,
    cup,
  );
  const cloth = surface("#ffffff");
  const gingham = document.createElement("canvas");
  gingham.width = gingham.height = 64;
  const c = gingham.getContext("2d")!;
  c.fillStyle = "#f4dec6";
  c.fillRect(0, 0, 64, 64);
  c.fillStyle = "rgba(137,40,60,.55)";
  c.fillRect(0, 0, 32, 64);
  c.fillRect(0, 0, 64, 32);
  cloth.map = new T.CanvasTexture(gingham);
  cloth.map.colorSpace = T.SRGBColorSpace;
  cloth.map.wrapS = cloth.map.wrapT = T.RepeatWrapping;
  cloth.map.repeat.set(8, 5);
  mesh(
    group,
    new T.BoxGeometry(0.46, 0.013, 0.32),
    cloth,
    -0.45,
    1.137,
    0.37,
  ).rotation.y = 0.24;
  const plate = platedCrepe(onTexture);
  plate.position.set(0.25, 1.129, 0.09);
  plate.rotation.y = -0.83;
  group.add(plate);
  return group;
}
