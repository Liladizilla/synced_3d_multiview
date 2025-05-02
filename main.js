let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
let renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add object
let geometry = new THREE.BoxGeometry();
let material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
let cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  localStorage.setItem("cubeRotation", JSON.stringify({
    x: cube.rotation.x,
    y: cube.rotation.y
  }));

  renderer.render(scene, camera);
}

animate();

window.addEventListener("storage", (e) => {
  if (e.key === "cubeRotation") {
    let { x, y } = JSON.parse(e.newValue);
    cube.rotation.x = x;
    cube.rotation.y = y;
  }
});