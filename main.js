(() => {
  "use strict";
  const status = document.getElementById("status");
  const frameStatus = document.getElementById("frame-status");
  const speedInput = document.getElementById("speed");
  const speedValue = document.getElementById("speed-value");
  const toggleButton = document.getElementById("toggle-motion");
  const resetButton = document.getElementById("reset-scene");
  const views = [
    { id: "view-orbit", name: "Orbit", position: [4.2, 2.7, 5.2], fov: 45 },
    { id: "view-front", name: "Front", position: [0, 0.2, 7], fov: 42 },
    { id: "view-top", name: "Top", position: [0, 7, 0.01], fov: 42 }
  ];
  const state = { running: true, speed: 1, rotationX: 0, rotationY: 0, lastFrame: 0, frames: 0 };
  const renderers = [];
  let animationId = 0;

  function setStatus(message, ready = false) {
    status.textContent = message;
    status.style.color = ready ? "var(--accent)" : "";
  }

  function createView(config) {
    const container = document.getElementById(config.id);
    if (!container || !window.THREE) throw new Error("Missing view container or Three.js runtime");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1019);
    const camera = new THREE.PerspectiveCamera(config.fov, 1, 0.1, 100);
    camera.position.set(...config.position);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x0b1019, 1);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x9eb7d8, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(4, 5, 6);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x83f0d1, 18, 20);
    rimLight.position.set(-3, 1, -3);
    scene.add(rimLight);

    const geometry = new THREE.IcosahedronGeometry(1.15, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x8ef0d2, metalness: 0.52, roughness: 0.25, flatShading: true });
    const object = new THREE.Mesh(geometry, material);
    scene.add(object);

    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.22, 1),
      new THREE.MeshBasicMaterial({ color: 0x9eafff, wireframe: true, transparent: true, opacity: 0.23 })
    );
    scene.add(wire);

    const grid = new THREE.GridHelper(12, 24, 0x2c5260, 0x1b2a3a);
    grid.position.y = -1.65;
    scene.add(grid);

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    return { ...config, container, scene, camera, renderer, object, wire, resize };
  }

  function animate(time) {
    animationId = requestAnimationFrame(animate);
    if (!state.lastFrame) state.lastFrame = time;
    const delta = Math.min((time - state.lastFrame) / 16.667, 3);
    state.lastFrame = time;
    if (state.running) {
      state.rotationX += 0.006 * state.speed * delta;
      state.rotationY += 0.009 * state.speed * delta;
    }
    for (const view of renderers) {
      view.object.rotation.set(state.rotationX, state.rotationY, 0.12 * Math.sin(state.rotationY * 0.7));
      view.wire.rotation.copy(view.object.rotation);
      view.renderer.render(view.scene, view.camera);
    }
    state.frames++;
    if (state.frames % 30 === 0) frameStatus.textContent = "RENDERING · " + renderers.length + " CAMERAS";
  }

  function updateMotionButton() {
    toggleButton.textContent = state.running ? "Pause motion" : "Resume motion";
    toggleButton.setAttribute("aria-pressed", String(!state.running));
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
      resetButton.addEventListener("click", () => {
        state.rotationX = 0;
        state.rotationY = 0;
        state.speed = 1;
        state.running = true;
        speedInput.value = "1";
        speedValue.value = "1.0×";
        speedValue.textContent = "1.0×";
        updateMotionButton();
      });
      const observer = new ResizeObserver(() => renderers.forEach(view => view.resize()));
      renderers.forEach(view => observer.observe(view.container));
      updateMotionButton();
      setStatus("ALL SYSTEMS LIVE", true);
      frameStatus.textContent = "3 CAMERAS READY";
      animationId = requestAnimationFrame(animate);
    } catch (error) {
      setStatus("SCENE FAILED");
      frameStatus.textContent = error.message;
      console.error("Synced 3D Multiview initialization failed:", error);
    }
  }

  window.addEventListener("pagehide", () => cancelAnimationFrame(animationId));
  window.addEventListener("load", init, { once: true });
  window.synced3D = { state, renderers };
})();
