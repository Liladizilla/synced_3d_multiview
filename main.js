(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const status = byId("status");
  const frameStatus = byId("frame-status");
  const sceneState = byId("scene-state");
  const fpsValue = byId("fps-value");
  const speedInput = byId("speed");
  const speedValue = byId("speed-value");
  const toggleButton = byId("toggle-motion");
  const resetButton = byId("reset-scene");
  const shapeInput = byId("shape-mode");
  const wireButton = byId("toggle-wireframe");
  const gridButton = byId("toggle-grid");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const views = [
    { id: "view-orbit", name: "Orbit", position: [4.3, 2.65, 5.25], fov: 43, interactive: true },
    { id: "view-front", name: "Front", position: [0, 0.12, 7.1], fov: 40 },
    { id: "view-top", name: "Top", position: [0, 7.3, 0.01], fov: 40, up: [0, 0, -1] }
  ];
  const state = {
    running: !reduceMotion, speed: 1, rotationX: 0, rotationY: 0, rotationZ: 0,
    lastFrame: 0, frames: 0, fpsFrames: 0, fpsStarted: 0, cameraYaw: 0,
    cameraPitch: 0, dragging: false, pointerX: 0, pointerY: 0,
    shapeMode: "polyhedron", wireframe: false, showGrid: true
  };
  const renderers = [];
  let animationId = 0;
  let resizeObserver;

  function setStatus(message, ready = false) {
    status.textContent = message;
    status.style.color = ready ? "var(--mint)" : "";
    sceneState.textContent = ready ? "All systems live" : "Warming up";
  }

  function createStars(scene) {
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 3.7 + Math.random() * 5.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x8fa9c8, size: 0.018, transparent: true, opacity: 0.62, sizeAttenuation: true });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
    return stars;
  }

  function createView(config) {
    const container = byId(config.id);
    if (!container || !window.THREE) throw new Error("Missing camera container or Three.js runtime");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1019);
    scene.fog = new THREE.FogExp2(0x0b1019, 0.025);
    const camera = new THREE.PerspectiveCamera(config.fov, 1, 0.1, 100);
    camera.position.set(...config.position);
    if (config.up) camera.up.set(...config.up);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x0b1019, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xc8ddff, 0x101521, 1.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
    keyLight.position.set(4, 5, 6);
    scene.add(keyLight);
    const mintLight = new THREE.PointLight(0x73f2cf, 24, 16);
    mintLight.position.set(-3.2, 1.5, -2.8);
    scene.add(mintLight);
    const blueLight = new THREE.PointLight(0x748bff, 19, 15);
    blueLight.position.set(3, -1.2, 3);
    scene.add(blueLight);

    const object = new THREE.Group();
    const sculpture = buildSculpture(object, state.shapeMode);
    scene.add(object);

    const floor = new THREE.GridHelper(16, 32, 0x28494d, 0x1b2b3b);
    floor.position.y = -1.8;
    if (floor.material) { floor.material.transparent = true; floor.material.opacity = 0.43; }
    scene.add(floor);
    const stars = createStars(scene);
    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const view = { ...config, container, scene, camera, renderer, object, stars, floor, resize };
    if (config.interactive) attachOrbitControls(view);
    return view;
  }

  function buildSculpture(object, mode) {
    disposeSculpture(object);
    const wires = [];
    const rings = [];
    const satellites = [];
    const mint = new THREE.MeshPhysicalMaterial({ color: 0x9cebd8, metalness: 0.62, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12 });
    const blue = new THREE.MeshPhysicalMaterial({ color: 0x8299ff, metalness: 0.58, roughness: 0.24, clearcoat: 1 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xc3d5e8, metalness: 0.82, roughness: 0.28 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0xb3c2ff, wireframe: true, transparent: true, opacity: 0.25 });
    const addMesh = (geometry, material, position = [0,0,0], scale = 1, wire = false) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.scale.setScalar(scale);
      object.add(mesh);
      if (wire) {
        const overlay = new THREE.Mesh(geometry, wireMat.clone());
        overlay.position.copy(mesh.position);
        overlay.scale.setScalar(scale * 1.008);
        overlay.visible = state.wireframe;
        object.add(overlay);
        wires.push(overlay);
      }
      return mesh;
    };
    const addRing = (radius, tube, color, rotation, speed = 1) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 144), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62 }));
      ring.rotation.set(...rotation);
      ring.userData.spin = speed;
      object.add(ring);
      rings.push(ring);
      return ring;
    };
    if (mode === "polyhedron") {
      addMesh(new THREE.DodecahedronGeometry(0.9, 0), mint, [0,0,0], 1, true);
      addMesh(new THREE.IcosahedronGeometry(0.37, 1), blue, [0,0,0], 1, true);
      addRing(1.28, 0.012, 0x91f1d5, [1.05,0.2,0.3], 0.7);
      addRing(1.5, 0.006, 0x8ca7ff, [0.25,1.1,-0.4], -0.5);
      [[1.45,0.18,0.2],[-1.18,0.55,-0.75],[0.2,-1.38,0.8]].forEach((p,i)=>{
        const s=addMesh(new THREE.OctahedronGeometry(0.17,0),i===1?blue:silver,p);
        s.userData.satellite=i+1; satellites.push(s);
      });
    } else if (mode === "torus") {
      addMesh(new THREE.TorusKnotGeometry(0.73,0.22,180,18,2,3), mint, [0,0,0], 1, true);
      addMesh(new THREE.OctahedronGeometry(0.31,1), blue);
      addRing(1.38,0.009,0x91f1d5,[1.05,0.25,0.2],0.9);
      addRing(1.62,0.005,0x8ca7ff,[0.2,1.15,-0.45],-0.6);
      [[1.45,0.4,0],[-1.1,-0.7,0.7]].forEach((p,i)=>{const s=addMesh(new THREE.IcosahedronGeometry(0.13,1),i?blue:silver,p);s.userData.satellite=i+1;satellites.push(s);});
    } else if (mode === "crystal") {
      addMesh(new THREE.OctahedronGeometry(0.9,1), mint, [0,0,0], 1, true);
      addMesh(new THREE.OctahedronGeometry(0.48,0), blue, [0.12,-0.04,0.05], 1, true);
      [[1.1,0.2,0.2],[-1.05,0.5,-0.55],[0.25,-1.12,0.65],[0.1,0.8,-1.05]].forEach((p,i)=>{const s=addMesh(new THREE.OctahedronGeometry(0.22,0),i%2?blue:silver,p);s.userData.satellite=i+1;satellites.push(s);});
      addRing(1.5,0.008,0x91f1d5,[1.0,0.2,0.35],0.65);
      addRing(1.72,0.005,0x8ca7ff,[0.3,1.1,-0.4],-0.45);
    } else {
      addMesh(new THREE.TorusKnotGeometry(0.58,0.075,220,10,2,5), mint, [0,0,0], 1, true);
      addRing(1.22,0.008,0x8ca7ff,[0.3,0.7,0.2],0.55);
      for(let i=0;i<16;i++){
        const t=i/16*Math.PI*2;
        const y=(i/15-0.5)*1.9;
        const s=addMesh(new THREE.SphereGeometry(0.075+(i%3)*0.018,12,10),i%3===0?blue:(i%3===1?mint:silver),[Math.cos(t)*0.86,y,Math.sin(t)*0.86]);
        s.userData.satellite=i+1; satellites.push(s);
      }
    }
    object.userData = { mode, wires, rings, satellites };
    return object.userData;
  }

  function disposeSculpture(object) {
    object.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => material.dispose());
      }
    });
    object.clear();
  }

  function setSculptureMode(mode) {
    state.shapeMode = mode;
    for (const view of renderers) buildSculpture(view.object, mode);
    const labels = { polyhedron: "Polyhedral core", torus: "Torus knot", crystal: "Crystal cluster", helix: "Helix array" };
    byId("scene-state").textContent = labels[mode] + " active";
  }

  function attachOrbitControls(view) {
    const el = view.container;
    el.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      state.dragging = true;
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
      el.setPointerCapture?.(event.pointerId);
    });
    el.addEventListener("pointermove", event => {
      if (!state.dragging) return;
      const dx = event.clientX - state.pointerX;
      const dy = event.clientY - state.pointerY;
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
      state.cameraYaw -= dx * 0.006;
      state.cameraPitch = Math.max(-0.72, Math.min(0.72, state.cameraPitch + dy * 0.004));
      updateOrbitCamera(view);
    });
    const stop = () => { state.dragging = false; };
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
    el.addEventListener("lostpointercapture", stop);
  }

  function updateOrbitCamera(view) {
    const radius = 6.85;
    const yaw = (Math.atan2(4.3, 5.25)) + state.cameraYaw;
    const pitch = 0.4 + state.cameraPitch;
    view.camera.position.set(
      radius * Math.sin(yaw) * Math.cos(pitch),
      radius * Math.sin(pitch),
      radius * Math.cos(yaw) * Math.cos(pitch)
    );
    view.camera.lookAt(0, 0, 0);
  }

  function updateMotionButton() {
    const label = state.running ? "Pause motion" : "Resume motion";
    toggleButton.querySelector("span:last-child").textContent = label;
    toggleButton.querySelector(".button-icon").textContent = state.running ? "Ⅱ" : "▶";
    toggleButton.setAttribute("aria-pressed", String(!state.running));
    sceneState.textContent = state.running ? "All systems live" : "Motion paused";
  }

  function resetScene() {
    state.rotationX = 0;
    state.rotationY = 0;
    state.rotationZ = 0;
    state.speed = 1;
    state.wireframe = false;
    state.showGrid = true;
    state.shapeMode = "polyhedron";
    shapeInput.value = "polyhedron";
    wireButton.setAttribute("aria-pressed", "false");
    wireButton.textContent = "Wireframe";
    gridButton.setAttribute("aria-pressed", "true");
    gridButton.textContent = "Grid on";
    renderers.forEach(view => { buildSculpture(view.object, state.shapeMode); view.floor.visible = true; });
    state.cameraYaw = 0;
    state.cameraPitch = 0;
    state.running = !reduceMotion;
    speedInput.value = "1";
    speedValue.value = "1.0×";
    speedValue.textContent = "1.0×";
    const orbit = renderers.find(view => view.interactive);
    if (orbit) updateOrbitCamera(orbit);
    updateMotionButton();
  }

  function animate(time) {
    animationId = requestAnimationFrame(animate);
    if (!state.lastFrame) state.lastFrame = time;
    const delta = Math.min((time - state.lastFrame) / 16.667, 3);
    state.lastFrame = time;
    if (state.running) {
      state.rotationX += 0.0038 * state.speed * delta;
      state.rotationY += 0.0063 * state.speed * delta;
      state.rotationZ += 0.0017 * state.speed * delta;
    }
    for (const view of renderers) {
      view.object.rotation.set(state.rotationX, state.rotationY, state.rotationZ);
      if (state.running) {
        view.object.userData.rings?.forEach(ring => { ring.rotation.z += 0.0018 * state.speed * (ring.userData.spin || 1) * delta; });
        view.object.userData.satellites?.forEach((part, i) => { if (part.userData.satellite) { part.rotation.x += 0.0015 * delta; part.rotation.y += 0.002 * delta; } });
      }
      view.stars.rotation.y = state.rotationY * 0.04;
      view.renderer.render(view.scene, view.camera);
    }
    state.frames++;
    state.fpsFrames++;
    if (!state.fpsStarted) state.fpsStarted = time;
    if (time - state.fpsStarted >= 1000) {
      fpsValue.textContent = String(Math.round(state.fpsFrames * 1000 / (time - state.fpsStarted)));
      state.fpsFrames = 0;
      state.fpsStarted = time;
      frameStatus.textContent = state.running ? "RENDER LOOP ACTIVE" : "RENDER LOOP IDLE";
    }
  }

  function init() {
    try {
      if (!window.THREE) throw new Error("Three.js did not load. Check your connection and refresh.");
      for (const config of views) renderers.push(createView(config));
      speedInput.addEventListener("input", () => {
        state.speed = Number(speedInput.value);
        speedValue.value = state.speed.toFixed(1) + "×";
        speedValue.textContent = speedValue.value;
      });
      toggleButton.addEventListener("click", () => {
        state.running = !state.running;
        updateMotionButton();
      });
      resetButton.addEventListener("click", resetScene);
      shapeInput.addEventListener("change", () => setSculptureMode(shapeInput.value));
      wireButton.addEventListener("click", () => {
        state.wireframe = !state.wireframe;
        renderers.forEach(view => view.object.userData.wires?.forEach(wire => { wire.visible = state.wireframe; }));
        wireButton.setAttribute("aria-pressed", String(state.wireframe));
        wireButton.textContent = state.wireframe ? "Wireframe on" : "Wireframe";
      });
      gridButton.addEventListener("click", () => {
        state.showGrid = !state.showGrid;
        renderers.forEach(view => { view.floor.visible = state.showGrid; });
        gridButton.setAttribute("aria-pressed", String(state.showGrid));
        gridButton.textContent = state.showGrid ? "Grid on" : "Grid off";
      });
      window.addEventListener("keydown", event => {
        if (event.code === "Space" && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || "")) {
          event.preventDefault();
          state.running = !state.running;
          updateMotionButton();
        }
        if (event.key.toLowerCase() === "r" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) resetScene();
      });
      resizeObserver = new ResizeObserver(() => renderers.forEach(view => view.resize()));
      renderers.forEach(view => resizeObserver.observe(view.container));
      window.addEventListener("pagehide", () => {
        cancelAnimationFrame(animationId);
        resizeObserver?.disconnect();
        renderers.forEach(view => view.renderer.dispose());
      }, { once: true });
      updateMotionButton();
      setStatus("ALL SYSTEMS LIVE", true);
      byId("camera-count").textContent = String(renderers.length).padStart(2, "0");
      frameStatus.textContent = "3 CAMERAS READY";
      if (reduceMotion) sceneState.textContent = "Ready · reduced motion";
      animationId = requestAnimationFrame(animate);
    } catch (error) {
      setStatus("SCENE FAILED");
      frameStatus.textContent = "CHECK CONNECTION";
      sceneState.textContent = error.message;
      console.error("Synced 3D Studio initialization failed:", error);
    }
  }

  window.addEventListener("load", init, { once: true });
  window.synced3D = { state, renderers, resetScene };
})();