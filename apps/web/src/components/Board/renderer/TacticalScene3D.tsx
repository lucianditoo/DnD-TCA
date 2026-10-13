import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Combatant, Position } from "@dnd-tactical/shared";
import knightUrl from "../../../assets/sprites/knight.png";
import mageUrl from "../../../assets/sprites/mage.png";
import rangerUrl from "../../../assets/sprites/ranger.png";
import orcUrl from "../../../assets/sprites/orc.png";
import rogueUrl from "../../../assets/sprites/rogue.png";
import type { CameraAngle, TacticalBoardPresentation, UnitPose } from "../presentationModel";

const CELL_SIZE = 1;
const CAMERA_POLAR_MIN = THREE.MathUtils.degToRad(24);
const CAMERA_POLAR_MAX = THREE.MathUtils.degToRad(68);
const CAMERA_DISTANCE = 18;

const CAMERA_AZIMUTH: Readonly<Record<CameraAngle, number>> = {
  nw: THREE.MathUtils.degToRad(-45),
  ne: THREE.MathUtils.degToRad(45),
  se: THREE.MathUtils.degToRad(135),
  sw: THREE.MathUtils.degToRad(-135)
};

const SPRITE_URLS: Readonly<Record<"knight" | "mage" | "ranger" | "orc" | "rogue", string>> = {
  knight: knightUrl,
  mage: mageUrl,
  ranger: rangerUrl,
  orc: orcUrl,
  rogue: rogueUrl
};

function spriteFamily(archetypeId: string, combatant: Combatant): keyof typeof SPRITE_URLS {
  const id = archetypeId.toLowerCase();
  if (id.includes("bane") || id.includes("rogue")) return "rogue";
  if (id.includes("mage") || id.includes("wizard") || id.includes("cleric") || id.includes("alaric")) return "mage";
  if (id.includes("archer") || id.includes("ranger") || id.includes("scout") || id.includes("elaen") || id.includes("explorer")) return "ranger";
  if (combatant.type === "enemy" || id.includes("orc") || id.includes("goblin")) return "orc";
  return "knight";
}

function spriteFamilyScale(family: keyof typeof SPRITE_URLS): number {
  // El PNG del caballero conserva más margen transparente y su silueta opaca
  // ocupa ~25% menos altura que las demás familias compactas.
  return family === "knight" ? 1.25 : 1;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();
  });
}

function makeCellMaterial(className: string): THREE.MeshBasicMaterial {
  let color = 0x000000;
  let opacity = 0;
  if (className.includes("route-cell")) { color = 0xffd54f; opacity = 0.42; }
  else if (className.includes("move-highlight")) { color = 0x39d9c4; opacity = 0.38; }
  else if (className.includes("attack-highlight")) { color = 0xff6148; opacity = 0.4; }
  else if (className.includes("ranged-highlight")) { color = 0xffb74d; opacity = 0.38; }
  else if (className.includes("ability-highlight")) { color = 0xffe082; opacity = 0.38; }
  else if (className.includes("hazard-cell")) { color = 0xff5722; opacity = 0.4; }
  else if (className.includes("cell-difficult")) { color = 0x75644d; opacity = 0.25; }
  else if (className.includes("cell-narrow")) { color = 0x607080; opacity = 0.24; }
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

function makeLabelTexture(text: string, border: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(10, 13, 16, 0.9)";
  context.strokeStyle = border;
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(4, 4, 248, 54, 10);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff6df";
  context.font = "bold 23px system-ui";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 128, 31, 230);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

function makeStatusTexture(symbol: string, fill: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, 64, 64);
  context.fillStyle = "rgba(9, 12, 15, 0.94)";
  context.strokeStyle = fill;
  context.lineWidth = 5;
  context.beginPath();
  context.arc(32, 32, 25, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = fill;
  context.font = "bold 34px system-ui";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(symbol, 32, 33);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

function statusIndicator(pose: UnitPose): { symbol: string; code: string; fill: string } | null {
  if (pose === "paralyzed") return { symbol: "⚡", code: "paralyzed", fill: "#d8a6ff" };
  if (pose === "prone") return { symbol: "▼", code: "prone", fill: "#ffd45c" };
  if (pose === "fallen") return { symbol: "†", code: "fallen", fill: "#d6d9dc" };
  return null;
}

function makeBoardGrid(width: number, height: number): THREE.LineSegments {
  const vertices: number[] = [];
  const minX = -width / 2;
  const maxX = width / 2;
  const minZ = -height / 2;
  const maxZ = height / 2;

  for (let x = 0; x <= width; x += 1) {
    const worldX = minX + x;
    vertices.push(worldX, 0.005, minZ, worldX, 0.005, maxZ);
  }
  for (let y = 0; y <= height; y += 1) {
    const worldZ = minZ + y;
    vertices.push(minX, 0.005, worldZ, maxX, 0.005, worldZ);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x9fa9ac,
    transparent: true,
    opacity: 0.38,
    depthWrite: false
  });
  return new THREE.LineSegments(geometry, material);
}

function applyPreset(camera: THREE.OrthographicCamera, controls: OrbitControls, angle: CameraAngle) {
  const azimuth = CAMERA_AZIMUTH[angle];
  const polar = THREE.MathUtils.degToRad(48);
  const sinPolar = Math.sin(polar);
  camera.position.set(
    Math.sin(azimuth) * sinPolar * CAMERA_DISTANCE,
    Math.cos(polar) * CAMERA_DISTANCE,
    Math.cos(azimuth) * sinPolar * CAMERA_DISTANCE
  ).add(controls.target);
  camera.lookAt(controls.target);
  controls.update();
}

export function TacticalScene3D({
  presentation,
  cameraAngle,
  cameraZoom,
  resetRevision,
  onCellClick,
  onCameraZoomChange,
  onRendererUnavailable
}: {
  readonly presentation: TacticalBoardPresentation;
  readonly cameraAngle: CameraAngle;
  readonly cameraZoom: number;
  readonly resetRevision: number;
  readonly onCellClick: (position: Position, token: Combatant | undefined) => void;
  readonly onCameraZoomChange: (zoom: number) => void;
  readonly onRendererUnavailable: (message: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    controls: OrbitControls;
    renderer: THREE.WebGLRenderer;
    content: THREE.Group;
    ground: THREE.Mesh;
    resize: ResizeObserver;
  } | null>(null);
  const propsRef = useRef({ presentation, onCellClick, cameraZoom, onCameraZoomChange });
  const [cameraTelemetry, setCameraTelemetry] = useState({ azimuth: -45, elevation: 42 });
  const [initializationError, setInitializationError] = useState<string | null>(null);

  propsRef.current = { presentation, onCellClick, cameraZoom, onCameraZoomChange };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    } catch {
      const message = "No se pudo iniciar WebGL. Se activó la vista 2D compatible.";
      setInitializationError(message);
      onRendererUnavailable(message);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "tactical-scene-canvas";
    renderer.domElement.dataset.testid = "tactical-scene-canvas";
    renderer.domElement.setAttribute("aria-label", "Tablero táctico 2.5D interactivo");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101418);
    scene.fog = new THREE.Fog(0x101418, 23, 38);

    const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minPolarAngle = CAMERA_POLAR_MIN;
    controls.maxPolarAngle = CAMERA_POLAR_MAX;
    controls.minZoom = 0.75;
    controls.maxZoom = 2.0;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    controls.target.set(0, 0.35, 0);
    camera.zoom = cameraZoom;
    camera.updateProjectionMatrix();
    applyPreset(camera, controls, cameraAngle);

    scene.add(new THREE.HemisphereLight(0xbfd7ff, 0x24201a, 2.15));
    const key = new THREE.DirectionalLight(0xffe5b5, 2.8);
    key.position.set(-7, 13, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    const content = new THREE.Group();
    scene.add(content);
    const ground = new THREE.Mesh();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart: { x: number; y: number } | null = null;

    const render = () => renderer.render(scene, camera);
    const updateTelemetry = () => {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      setCameraTelemetry({
        azimuth: Math.round(THREE.MathUtils.radToDeg(spherical.theta)),
        elevation: Math.round(90 - THREE.MathUtils.radToDeg(spherical.phi))
      });
      render();
    };
    controls.addEventListener("change", updateTelemetry);

    const onPointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const latest = propsRef.current;
      const step = event.deltaY < 0 ? 0.125 : -0.125;
      latest.onCameraZoomChange(Math.min(2.0, Math.max(0.75, latest.cameraZoom + step)));
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointerStart) return;
      const travel = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      pointerStart = null;
      if (travel > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const hit = raycaster.intersectObject(runtime.ground, false)[0];
      if (!hit) return;
      const { presentation: latest, onCellClick: click } = propsRef.current;
      const x = Math.floor(hit.point.x + latest.width / 2);
      const y = Math.floor(hit.point.z + latest.height / 2);
      const cell = latest.cells.find((entry) => entry.x === x && entry.y === y);
      if (cell) click(cell.position, cell.occupant);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resize = new ResizeObserver(() => {
      const width = Math.max(320, mount.clientWidth);
      const height = Math.max(300, mount.clientHeight);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const halfHeight = Math.max(4.5, presentation.height * 0.58);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      render();
    });
    resize.observe(mount);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (controls.update()) render();
    };
    animate();

    runtimeRef.current = { scene, camera, controls, renderer, content, ground, resize };
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.removeEventListener("change", updateTelemetry);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      disposeObject(content);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, [onRendererUnavailable]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    applyPreset(runtime.camera, runtime.controls, cameraAngle);
  }, [cameraAngle, resetRevision]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.camera.zoom = cameraZoom;
    runtime.camera.updateProjectionMatrix();
    runtime.controls.update();
  }, [cameraZoom]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const { scene, content } = runtime;
    disposeObject(content);
    content.clear();

    const boardX = -presentation.width / 2;
    const boardZ = -presentation.height / 2;

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(presentation.width + 0.35, 0.35, presentation.height + 0.35),
      new THREE.MeshStandardMaterial({ color: 0x252c31, roughness: 0.88, metalness: 0.04 })
    );
    slab.position.y = -0.22;
    slab.receiveShadow = true;
    content.add(slab);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(presentation.width, presentation.height),
      new THREE.MeshStandardMaterial({ color: 0x384247, roughness: 0.96, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    ground.name = "picking-ground";
    content.add(ground);
    runtime.ground = ground;

    content.add(makeBoardGrid(presentation.width, presentation.height));

    for (const cell of presentation.cells) {
      const material = makeCellMaterial(cell.className);
      if (material.opacity <= 0) { material.dispose(); continue; }
      const overlay = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), material);
      overlay.rotation.x = -Math.PI / 2;
      overlay.position.set(boardX + cell.x + 0.5, 0.025, boardZ + cell.y + 0.5);
      content.add(overlay);
    }

    for (const volume of presentation.volumes) {
      const height = volume.kind === "pillar" ? 2.4 : volume.kind === "wall" ? 1.55 : volume.kind === "rubble-stone" ? 0.38 : 0.16;
      const width = volume.kind === "pillar" ? 0.54 : volume.kind === "rubble-stone" ? 0.62 : 0.94;
      const geometry = volume.kind === "pillar"
        ? new THREE.CylinderGeometry(width / 2, width / 2, height, 10)
        : new THREE.BoxGeometry(width, height, width);
      const color = volume.kind === "pillar" ? 0x71808a : volume.kind === "rubble-stone" ? 0x776b58 : volume.kind === "ledge" ? 0x4e5961 : 0x596772;
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.82 }));
      mesh.position.set(boardX + volume.cellX + 0.5, height / 2, boardZ + volume.cellY + 0.5);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      content.add(mesh);
    }

    const textureLoader = new THREE.TextureLoader();
    const textures = new Map<string, THREE.Texture>();
    for (const [family, url] of Object.entries(SPRITE_URLS)) {
      const texture = textureLoader.load(url, () => runtime.renderer.render(scene, runtime.camera));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      textures.set(family, texture);
    }

    for (const token of presentation.tokens) {
      const centerX = token.occupiedCells.reduce((sum, cell) => sum + cell.x + 0.5, 0) / token.occupiedCells.length;
      const centerY = token.occupiedCells.reduce((sum, cell) => sum + cell.y + 0.5, 0) / token.occupiedCells.length;
      const group = new THREE.Group();
      group.position.set(boardX + centerX, 0.035, boardZ + centerY);

      const factionColor = token.type === "player" ? 0x58e5d2 : 0xff765c;
      for (const occupiedCell of token.occupiedCells) {
        const footprint = new THREE.Mesh(
          new THREE.PlaneGeometry(0.82, 0.82),
          new THREE.MeshBasicMaterial({
            color: token.isSelected ? 0xffd54f : factionColor,
            transparent: true,
            opacity: token.isSelected ? 0.34 : 0.18,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        footprint.rotation.x = -Math.PI / 2;
        footprint.position.set(
          boardX + occupiedCell.x + 0.5 - group.position.x,
          -0.008,
          boardZ + occupiedCell.y + 0.5 - group.position.z
        );
        group.add(footprint);
      }

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(token.isSelected ? 0.27 : 0.23, token.isSelected ? 0.36 : 0.31, 32),
        new THREE.MeshBasicMaterial({
          color: token.isSelected ? 0xffd54f : factionColor,
          transparent: true,
          opacity: token.isSelected ? 0.95 : 0.65,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      group.add(ring);

      const family = spriteFamily(token.sprite.archetypeId, token.combatant);
      const familyScale = spriteFamilyScale(family);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: textures.get(family),
        transparent: true,
        alphaTest: 0.08,
        depthTest: true,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.renderOrder = 40;
      const largeScale = token.sprite.isLarge ? 1.65 : 1;
      const widthScale = token.isSqueezing ? 0.72 : 1;
      sprite.scale.set(1.22 * largeScale * widthScale * familyScale, 1.74 * largeScale * familyScale, 1);
      sprite.position.y = 0.87 * largeScale;
      if (token.pose === "prone") {
        sprite.center.set(0.5, 0.5);
        sprite.material.rotation = -0.18;
        sprite.scale.set(1.26 * largeScale, 0.9 * largeScale, 1);
        sprite.position.y = 0.45 * largeScale;
      }
      if (token.pose === "paralyzed") sprite.material.color.set(0xe2ccff);
      if (token.pose === "fallen") {
        sprite.material.rotation = -Math.PI / 2;
        sprite.material.color.set(0x9aa0a4);
        sprite.scale.set(1.3 * largeScale, 0.72 * largeScale, 1);
        sprite.position.y = 0.3 * largeScale;
      }
      sprite.userData.combatantId = token.id;
      group.add(sprite);

      const stateIcon = statusIndicator(token.pose);
      if (stateIcon) {
        const texture = makeStatusTexture(stateIcon.symbol, stateIcon.fill);
        const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
        icon.scale.set(0.48, 0.48, 1);
        icon.position.set(0, token.pose === "prone" || token.pose === "fallen" ? 1.05 : 1.94 * largeScale, 0);
        icon.renderOrder = 60;
        group.add(icon);
      }

      if (token.isSelected || token.isActiveTurn || token.isTarget) {
        const texture = makeLabelTexture(token.name, token.type === "player" ? "#64ffda" : "#ff8a65");
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
        label.scale.set(1.9, 0.48, 1);
        label.position.y = 2.1 * largeScale;
        label.renderOrder = 50;
        group.add(label);
      }

      content.add(group);
    }

    scene.add(content);
    runtime.renderer.render(scene, runtime.camera);
    return () => textures.forEach((texture) => texture.dispose());
  }, [presentation]);

  return (
    <div
      ref={mountRef}
      className="tactical-scene-3d"
      data-testid="board-stage"
      data-view-mode="2.5d"
      data-camera-angle={cameraAngle}
      data-camera-zoom={String(cameraZoom)}
      data-camera-azimuth={String(cameraTelemetry.azimuth)}
      data-camera-elevation={String(cameraTelemetry.elevation)}
    >
      {initializationError ? <p className="renderer-warning">{initializationError}</p> : null}
      <span className="sr-only">Arrastrá para orbitar e inclinar el tablero. La rueda controla el zoom.</span>
      <div className="sr-only" data-testid="scene-entities" aria-live="polite">
        {presentation.tokens.map((token) => (
          <span
            key={token.id}
            data-testid={`scene-token-${token.id}`}
            data-scene-combatant={token.name}
            data-sprite-archetype={token.sprite.archetypeId}
            data-sprite-family={spriteFamily(token.sprite.archetypeId, token.combatant)}
            data-sprite-visual-scale={String(spriteFamilyScale(spriteFamily(token.sprite.archetypeId, token.combatant)))}
            data-sprite-depth-policy="foreground"
            data-footprint-columns={token.projectedFootprint.columns}
            data-footprint-rows={token.projectedFootprint.rows}
            data-pose={token.pose}
            data-state-icon={statusIndicator(token.pose)?.code ?? "none"}
            data-selected={String(token.isSelected)}
            data-badges={token.badges.map((badge) => `${badge.code}${badge.text ? ` ${badge.text}` : ""}`).join("|")}
          >
            {token.name}
          </span>
        ))}
      </div>
    </div>
  );
}
