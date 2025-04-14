import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as CANNON from 'cannon-es';

let scene, camera, renderer, rod, bobber, fish = [], controls;
let world, bobberBody, waterMesh;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
const clock = new THREE.Clock();

const move = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

let fishingLine;

window.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startButton');
  startBtn.addEventListener('click', () => {
    document.getElementById('homeScreen').style.display = 'none';
    init();
    animate();
  });
});

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 15, 0);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);

  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane()
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  // 🕹️ Controls
  controls = new PointerLockControls(camera, document.body);
  scene.add(controls.getObject());

  document.addEventListener('click', () => {
    controls.lock();
  });

  // 🔐 Limit vertical look
  const pitchObject = controls.getObject().children[0];
  const maxPitch = Math.PI / 2.8;
  const minPitch = -Math.PI / 4;
  renderer.setAnimationLoop(() => {
    if (pitchObject.rotation.x > maxPitch) pitchObject.rotation.x = maxPitch;
    if (pitchObject.rotation.x < minPitch) pitchObject.rotation.x = minPitch;
  });

  // 🌊 Water
  const waterGeometry = new THREE.PlaneGeometry(500, 500);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e90ff,
    roughness: 0.4,
    metalness: 0.3,
    transparent: true,
    opacity: 0.9
  });
  waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.rotation.x = -Math.PI / 2;
  scene.add(waterMesh);

  // 🏝️ Island
  const islandRadius = 100;
  const islandHeight = 10;
  const islandGeometry = new THREE.CylinderGeometry(islandRadius, islandRadius * 1.1, islandHeight, 64);
  const islandMaterial = new THREE.MeshStandardMaterial({ color: 0xdeb887 });
  const island = new THREE.Mesh(islandGeometry, islandMaterial);
  island.position.set(0, islandHeight / 2, 0);
  scene.add(island);

  const islandShape = new CANNON.Box(new CANNON.Vec3(islandRadius, islandHeight / 2, islandRadius));
  const islandBody = new CANNON.Body({
    mass: 0,
    shape: islandShape,
    position: new CANNON.Vec3(0, islandHeight / 2, 0)
  });
  world.addBody(islandBody);

  // ☀️ Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(50, 100, 50);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040, 0.6));

  // 🎣 Rod - right-hand first-person
  const rodGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
  const rodMaterial = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
  rod = new THREE.Mesh(rodGeometry, rodMaterial);
  rod.rotation.z = Math.PI / 6;
  rod.position.set(1.0, -1.4, -2);
  camera.add(rod);
  scene.add(camera);

  // 🎞️ Reel handle
  const reelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
  const reelMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const reel = new THREE.Mesh(reelGeometry, reelMaterial);
  reel.rotation.x = Math.PI / 2;
  reel.position.set(1.2, -1.4, -2);
  camera.add(reel);

  // 🧵 Fishing line (will be updated each frame)
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(), new THREE.Vector3()
  ]);
  fishingLine = new THREE.Line(lineGeometry, lineMaterial);
  scene.add(fishingLine);

  // 🟥 Bobber
  const bobberShape = new CANNON.Sphere(0.3);
  bobberBody = new CANNON.Body({
    mass: 1,
    shape: bobberShape,
    position: new CANNON.Vec3(0, 5, -15)
  });
  world.addBody(bobberBody);

  const bobberMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  bobber = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), bobberMaterial);
  scene.add(bobber);

  // 🐟 Fish
  for (let i = 0; i < 25; i++) {
    let x, z;
    const minDistance = islandRadius + 10;
    do {
      x = Math.random() * 300 - 150;
      z = Math.random() * 300 - 150;
    } while (Math.sqrt(x * x + z * z) < minDistance);

    const fishMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 1),
      new THREE.MeshStandardMaterial({ color: 0xffff00 })
    );
    scene.add(fishMesh);

    const fishBody = new CANNON.Body({
      mass: 0.5,
      shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.15, 0.5)),
      position: new CANNON.Vec3(x, 3, z)
    });
    world.addBody(fishBody);

    fish.push({
      mesh: fishMesh,
      body: fishBody,
      wanderTarget: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
    });
    
  }

  window.addEventListener('click', (event) => {
      if (!controls.isLocked) return;
    
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(waterMesh);
    
      if (intersects.length > 0) {
        const point = intersects[0].point;
        bobberBody.velocity.setZero();
        bobberBody.angularVelocity.setZero();
        bobberBody.position.set(point.x, 5, point.z);
    
        // 💦 Create splash when bobber hits the water
        createSplash(point);
      }
  });
  

  // 🕹️ Movement
  document.addEventListener('keydown', (event) => {
    switch (event.code) {
      case 'KeyW': move.forward = true; break;
      case 'KeyS': move.backward = true; break;
      case 'KeyA': move.left = true; break;
      case 'KeyD': move.right = true; break;
    }
  });

  document.addEventListener('keyup', (event) => {
    switch (event.code) {
      case 'KeyW': move.forward = false; break;
      case 'KeyS': move.backward = false; break;
      case 'KeyA': move.left = false; break;
      case 'KeyD': move.right = false; break;
    }
  });

  // 🔄 Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function createSplash(position) {
  const splashGeometry = new THREE.RingGeometry(0.1, 0.3, 32);
  const splashMaterial = new THREE.MeshBasicMaterial({
    color: 0xadd8e6,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });

  const splash = new THREE.Mesh(splashGeometry, splashMaterial);
  splash.rotation.x = -Math.PI / 2;
  splash.position.set(position.x, 0.01, position.z); // just above the water surface
  splash.renderOrder = 1; // ensure it renders on top

  scene.add(splash);

  // Animate + fade
  let scale = 1;
  const splashInterval = setInterval(() => {
    scale += 0.1;
    splash.scale.set(scale, scale, scale);
    splash.material.opacity -= 0.05;

    if (splash.material.opacity <= 0) {
      clearInterval(splashInterval);
      scene.remove(splash);
      splash.geometry.dispose();
      splash.material.dispose();
    }
  }, 30);
}



function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);

  const delta = clock.getDelta();

  // 🧭 First-person movement (camera-relative)
  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;

  direction.z = Number(move.forward) - Number(move.backward);
  direction.x = Number(move.right) - Number(move.left);
  direction.normalize();

  const front = new THREE.Vector3();
  controls.getDirection(front); // Camera forward

  const side = new THREE.Vector3().crossVectors(camera.up, front).normalize();

  if (move.forward || move.backward) {
    velocity.addScaledVector(front, direction.z * 400.0 * delta);
  }
  if (move.left || move.right) {
    velocity.addScaledVector(side, direction.x * 400.0 * delta);
  }

  const player = controls.getObject();
  player.position.addScaledVector(velocity, delta);
  player.position.y = 15; // 👈 Your camera "eye level"


  // ⛔ Clamp player to island radius
  const maxRadius = 95;
  const dist = Math.sqrt(player.position.x ** 2 + player.position.z ** 2);
  if (dist > maxRadius) {
    const angle = Math.atan2(player.position.z, player.position.x);
    player.position.x = Math.cos(angle) * maxRadius;
    player.position.z = Math.sin(angle) * maxRadius;
    velocity.set(0, 0, 0); // stop movement when clamped
  }

  // 🧵 Update fishing line
  // Get rod tip in world coordinates
  const rodTip = rod.position.clone();
  rodTip.applyMatrix4(camera.matrixWorld); // transforms from local to world space

  fishingLine.geometry.setFromPoints([rodTip, bobber.position]);


  // Bobber sync
  bobber.position.copy(bobberBody.position);
  bobber.quaternion.copy(bobberBody.quaternion);

  // 🐟 Fish movement
  fish.forEach(f => {
    // Gradually swim toward their current target direction
    const force = f.wanderTarget.clone().multiplyScalar(0.1);
    f.body.velocity.x += force.x;
    f.body.velocity.z += force.z;
  
    // Clamp speed
    f.body.velocity.x = THREE.MathUtils.clamp(f.body.velocity.x, -1, 1);
    f.body.velocity.z = THREE.MathUtils.clamp(f.body.velocity.z, -1, 1);
  
    // Occasionally pick a new random direction
    if (Math.random() < 0.01) {
      f.wanderTarget.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    }
  
    // Keep fish inside bounds
    const maxFishDist = 230;
    const pos = f.body.position;
    const distFromCenter = Math.sqrt(pos.x ** 2 + pos.z ** 2);
    if (distFromCenter > maxFishDist) {
      const angle = Math.atan2(pos.z, pos.x);
      f.body.velocity.x = -Math.cos(angle) * 0.8;
      f.body.velocity.z = -Math.sin(angle) * 0.8;
    }
  
    f.mesh.position.copy(pos);
    f.mesh.quaternion.copy(f.body.quaternion);
  });
  

  renderer.render(scene, camera);
}


