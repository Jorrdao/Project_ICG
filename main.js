import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as CANNON from 'cannon-es';


let scene, camera, renderer, rod, bobber, fish = [], controls;
let world, bobberBody, waterMesh;
let isFishing = false;
let fishCaught = false;
let trembleInterval;
let clickCount = 0;
let clickGoal = 10;
let startMinigameTimeout = null;
let bobberConstraint = null;
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
    document.getElementById('cursor').style.display = 'block';

    init();
    animate();
  });
});

// define terrain globals
let terrainGeometry;
const terrainSize = 300;
const terrainSegments = 100;

const fishTypes = [
  { name: "Golden Carp", image: "/images/golden_carp.png", key: "golden_carp" },
  { name: "Silver Trout", image: "/images/silver_trout.png", key: "silver_trout" },
  { name: "Bluegill", image: "/images/blue_gill.png", key: "bluegill" },
  { name: "Old Boot", image: "/images/boot.png", key: "old_boot" },
];


const inventory = {
  golden_carp: { image: "/images/golden_carp.png", quantity: 0, name: "Golden Carp" },
  silver_trout: { image: "/images/silver_trout.png", quantity: 0 , name: "Silver Trout" },
  bluegill: { image: "/images/blue_gill.png", quantity: 0, name: "Bluegill" },
  old_boot: { image: "/images/boot.png", quantity: 0, name: "Old Boot" }
};


let inventoryPopupVisible = false;

function toggleInventoryPopup() {
  if (inventoryPopupVisible) {
    const popup = document.getElementById("inventoryPopup");
    if (popup) popup.remove();
    inventoryPopupVisible = false;
    return;
  }

  const popup = document.createElement("div");
  popup.id = "inventoryPopup";
  popup.style.position = "absolute";
  popup.style.top = "50%";
  popup.style.left = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.width = "500px";
  popup.style.maxHeight = "400px";
  popup.style.overflowY = "auto";
  popup.style.background = "rgba(0, 100, 200, 0.9)";
  popup.style.border = "4px solid #fff";
  popup.style.borderRadius = "12px";
  popup.style.zIndex = 1001;
  popup.style.display = "flex";
  popup.style.flexDirection = "column";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "flex-start";
  popup.style.padding = "20px";
  popup.style.fontFamily = "Arial, sans-serif";
  popup.style.color = "#fff";

  const title = document.createElement("h2");
  title.innerText = "Inventory";
  title.style.marginBottom = "20px";
  popup.appendChild(title);

  // Lista de itens
  for (const itemName in inventory) {
    const item = inventory[itemName];

    const itemRow = document.createElement("div");
    itemRow.style.display = "flex";
    itemRow.style.alignItems = "center";
    itemRow.style.gap = "15px";
    itemRow.style.marginBottom = "15px";

    const img = document.createElement("img");
    img.src = item.image;
    img.style.width = "50px";
    img.style.height = "50px";
    img.style.borderRadius = "8px";

    const label = document.createElement("div");
    label.innerText = `${item.name} x${item.quantity}`;
    label.style.fontSize = "18px";

    itemRow.appendChild(img);
    itemRow.appendChild(label);
    popup.appendChild(itemRow);
  }

  document.body.appendChild(popup);
  inventoryPopupVisible = true;
}



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

  controls = new PointerLockControls(camera, document.body);
  scene.add(controls.getObject());

  document.addEventListener('click', () => {
    controls.lock();
  });

  const pitchObject = controls.getObject().children[0];
  const maxPitch = Math.PI / 2.8;
  const minPitch = -Math.PI / 4;
  renderer.setAnimationLoop(() => {
    if (pitchObject.rotation.x > maxPitch) pitchObject.rotation.x = maxPitch;
    if (pitchObject.rotation.x < minPitch) pitchObject.rotation.x = minPitch;
  });

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

  terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0xdeb887,
    flatShading: true
  });

  for (let i = 0; i < terrainGeometry.attributes.position.count; i++) {
    const x = terrainGeometry.attributes.position.getX(i);
    const y = terrainGeometry.attributes.position.getY(i);
    const z = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 4 + Math.random() * 1.2;
    terrainGeometry.attributes.position.setZ(i, z);
  }
  terrainGeometry.computeVertexNormals();

  const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrainMesh.rotation.x = -Math.PI / 2;
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  

  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(50, 100, 50);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040, 0.6));

  const rodGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
  const rodMaterial = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
  rod = new THREE.Mesh(rodGeometry, rodMaterial);
  rod.rotation.z = Math.PI / 6;
  rod.position.set(1.0, -1.4, -2);
  camera.add(rod);
  scene.add(camera);

  const reelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
  const reelMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const reel = new THREE.Mesh(reelGeometry, reelMaterial);
  reel.rotation.x = Math.PI / 2;
  reel.position.set(1.2, -1.4, -2);
  camera.add(reel);

  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(), new THREE.Vector3()
  ]);
  fishingLine = new THREE.Line(lineGeometry, lineMaterial);
  scene.add(fishingLine);

  const bobberShape = new CANNON.Sphere(0.3);
  const rodTip = rod.position.clone().applyMatrix4(camera.matrixWorld);
  bobberBody = new CANNON.Body({
    mass: 1,
    shape: bobberShape,
    position: new CANNON.Vec3(rodTip.x, rodTip.y - 0.2, rodTip.z)
  });

  world.addBody(bobberBody);

  const fixedPoint = new CANNON.Body({ mass: 0 });
  fixedPoint.position.copy(rodTip);
  world.addBody(fixedPoint);

  bobberConstraint = new CANNON.PointToPointConstraint(
    bobberBody, new CANNON.Vec3(0, 0, 0),
    fixedPoint, new CANNON.Vec3(0, -0.05, -1)
  );
  world.addConstraint(bobberConstraint);


  bobberBody.linearDamping = 0.9;
  bobberBody.angularDamping = 0.9;



  const bobberMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  bobber = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), bobberMaterial);
  scene.add(bobber);

  for (let i = 0; i < 25; i++) {
    let x, z;
    const minDistance = 60;
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
  
  createInventoryIcon();
  
  window.addEventListener('contextmenu', e => e.preventDefault());


  window.addEventListener('mousedown', (event) => {
    if (event.button === 2) { // Botão direito
      console.log('[DEBUG] mousedown botão direito');
  
      if (isFishing) {
        console.log('[DEBUG] Recolher bóia');
  
        // Cancela tremor e timeout
        if (trembleInterval) {
          clearInterval(trembleInterval);
          trembleInterval = null;
        }
  
        if (startMinigameTimeout) {
          clearTimeout(startMinigameTimeout);
          startMinigameTimeout = null;
        }
  
        cancelMinigame();
  
        // Remove constraint anterior
        if (bobberConstraint) {
          world.removeConstraint(bobberConstraint);
          bobberConstraint = null;
        }
  
        // Reposiciona a bóia na ponta da cana
        const rodTip = rod.position.clone().applyMatrix4(camera.matrixWorld);
        const bobberPos = new THREE.Vector3(rodTip.x, rodTip.y - 0.2, rodTip.z);
  
        bobberBody.velocity.setZero();
        bobberBody.angularVelocity.setZero();
        bobberBody.position.set(bobberPos.x, bobberPos.y, bobberPos.z);
  
        // Cria constraint entre a bóia e um ponto fixo perto da ponta da cana
        const fixedPoint = new CANNON.Body({ mass: 0 });
        fixedPoint.position.copy(rodTip);
        world.addBody(fixedPoint);
  
        bobberConstraint = new CANNON.PointToPointConstraint(
          bobberBody, new CANNON.Vec3(0, 0, 0),
          fixedPoint, new CANNON.Vec3(0, -0.05, -1)
        );
        world.addConstraint(bobberConstraint);
  
        createSplash(bobberPos);
  
        isFishing = false;
        fishCaught = false;
        clickCount = 0;
      }
    }
  
    if (event.button === 0 && controls.isLocked && !isFishing) { // Botão esquerdo
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(waterMesh);
    
      if (intersects.length > 0) {
        const target = intersects[0].point;
    
        // Remove constraint anterior se existir
        if (bobberConstraint) {
          world.removeConstraint(bobberConstraint);
          bobberConstraint = null;
        }
    
        // Define ponto de origem na ponta da cana
        const rodTip = rod.position.clone().applyMatrix4(camera.matrixWorld);
    
        // Reposiciona a bóia e zera sua velocidade
        bobberBody.position.set(rodTip.x, rodTip.y - 0.2, rodTip.z);
        bobberBody.velocity.setZero();
        bobberBody.angularVelocity.setZero();
    
        // Calcula a direção do lançamento
        const direction = new THREE.Vector3().subVectors(target, rodTip).normalize();
    
        // Calcula a distância até o alvo para ajustar a força dinamicamente
        const distance = rodTip.distanceTo(target);
        const horizontalStrength = distance * 2.5; // força horizontal escalável
        const verticalStrength = Math.min(Math.max(distance * 1.5, 4), 10); // vertical entre 4–10
    
        const impulse = new CANNON.Vec3(
          direction.x * horizontalStrength,
          verticalStrength,
          direction.z * horizontalStrength
        );
    
        bobberBody.applyImpulse(impulse, bobberBody.position);
    
        
        isFishing = true;
      }
    }
    
  });
  
  
  
  
  
  
  

  document.addEventListener('keydown', (event) => {
    if (controls.isLocked === false) return;
    switch (event.code) {
      case 'KeyW': move.forward = true; break;
      case 'KeyS': move.backward = true; break;
      case 'KeyA': move.left = true; break;
      case 'KeyD': move.right = true; break;
      case 'KeyE': toggleInventoryPopup(); break;

    }
  });

  document.addEventListener('keyup', (event) => {
    if (controls.isLocked === false) return;
    switch (event.code) {
      case 'KeyW': move.forward = false; break;
      case 'KeyS': move.backward = false; break;
      case 'KeyA': move.left = false; break;
      case 'KeyD': move.right = false; break;
    }
  });

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
  splash.position.set(position.x, 0.01, position.z);
  splash.renderOrder = 1;
  scene.add(splash);

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

function getRodTipPosition() {
  // Base da cana (ligada à câmara)
  const rodBase = new THREE.Vector3();
  rod.getWorldPosition(rodBase);

  // Direção para onde a câmara está virada
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.normalize();

  // 20cm (0.2 unidades) à frente da ponta da cana
  const rodTipOffset = direction.clone().multiplyScalar(0.2);
  return rodBase.add(rodTipOffset);
}


function cancelMinigame() {
  const overlay = document.getElementById('fishMinigame');
  if (overlay) overlay.remove();

  if (trembleInterval) {
    clearInterval(trembleInterval);
    trembleInterval = null;
  }

  if (startMinigameTimeout) {
    clearTimeout(startMinigameTimeout);
    startMinigameTimeout = null;
  }

  isFishing = false;
  fishCaught = false;
  clickCount = 0;

}


function createInventoryIcon() {
  const inventoryBox = document.createElement('div');
  inventoryBox.id = 'inventoryIcon';
  inventoryBox.style.position = 'absolute';
  inventoryBox.style.top = '20px';
  inventoryBox.style.right = '20px';
  inventoryBox.style.width = '120px';
  inventoryBox.style.height = '140px';
  inventoryBox.style.background = 'rgba(0, 100, 200, 0.8)';
  inventoryBox.style.border = '4px solid #fff';
  inventoryBox.style.borderRadius = '12px';
  inventoryBox.style.zIndex = 999;
  inventoryBox.style.display = 'flex';
  inventoryBox.style.flexDirection = 'column';
  inventoryBox.style.alignItems = 'center';
  inventoryBox.style.justifyContent = 'center';
  inventoryBox.style.padding = '10px';
  inventoryBox.style.fontFamily = 'Arial, sans-serif';
  inventoryBox.style.color = '#fff';
  inventoryBox.style.fontWeight = 'bold';
  inventoryBox.style.fontSize = '14px';

  // Imagem do inventário (substituir caminho conforme necessário)
  const img = document.createElement('img');
  img.src = '/images/book.png'; // Coloca o ícone que quiseres
  img.style.width = '160px';
  img.style.height = '160px';
  img.style.objectFit = 'contain';
  inventoryBox.appendChild(img);

  // Texto "Inventory [E]"
  const label = document.createElement('div');
  label.innerText = 'Inventory [E]';
  label.style.marginTop = '5px';
  inventoryBox.appendChild(label);

  document.body.appendChild(inventoryBox);
}


function startFishingAnimation() {
  console.log('[DEBUG] Fishing animation started');
  isFishing = true;
  const maxTime = Math.random() * 5 + 5; // 5–10 seconds

  // Tremor da bóia
  trembleInterval = setInterval(() => {
    const offset = (Math.random() - 0.5) * 0.2;
    bobberBody.position.x += offset;
    bobberBody.position.z += offset;
  }, 100);

  // Após tempo aleatório, inicia minijogo
  startMinigameTimeout = setTimeout(() => {
    clearInterval(trembleInterval);
    trembleInterval = null;
    startMinigameTimeout = null;
    openFishingMinigamePopup();
  }, maxTime * 1000);
}

function spawnFishShadow(position) {
  const geometry = new THREE.CircleGeometry(0.5, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    opacity: 0.3,
    transparent: true
  });

  const shadow = new THREE.Mesh(geometry, material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(position.x, 0.01, position.z); // ligeiramente acima do plano da água

  scene.add(shadow);

  let angle = 0;

  const animateShadow = () => {
    if (!scene.getObjectById(shadow.id)) return; // shadow removido

    angle += 0.05;
    const radius = 0.3;
    shadow.position.x = position.x + Math.cos(angle) * radius;
    shadow.position.z = position.z + Math.sin(angle) * radius;

    requestAnimationFrame(animateShadow);
  };

  animateShadow();

  // Remove após X segundos (ex: 8s)
  setTimeout(() => {
    scene.remove(shadow);
    shadow.geometry.dispose();
    shadow.material.dispose();
  }, 8000);
}


function showFishPopup(fishName, fishImageUrl) {
  const popup = document.createElement('div');
  popup.id = 'fishCapturePopup';
  popup.style.position = 'absolute';
  popup.style.top = '20px';
  popup.style.left = '20px';
  popup.style.width = '240px';
  popup.style.background = 'rgba(0, 100, 200, 0.8)';
  popup.style.border = '4px solid #fff';
  popup.style.borderRadius = '12px';
  popup.style.zIndex = 1000;
  popup.style.display = 'flex';
  popup.style.flexDirection = 'row';
  popup.style.alignItems = 'center';
  popup.style.justifyContent = 'flex-start';
  popup.style.padding = '10px';
  popup.style.gap = '10px';
  popup.style.color = 'white';
  popup.style.fontSize = '1.1em';

  const img = document.createElement('img');
  img.src = fishImageUrl;
  img.alt = fishName;
  img.style.width = '50px';
  img.style.height = '50px';
  img.style.objectFit = 'contain';
  img.style.borderRadius = '6px';

  const name = document.createElement('div');
  name.innerText = `Caught a ${fishName}!`;

  popup.appendChild(img);
  popup.appendChild(name);
  document.body.appendChild(popup);

  // Auto-remove after 3s
  setTimeout(() => {
    popup.remove();
  }, 3000);
}



function openFishingMinigamePopup() {
  if (document.getElementById('fishingPopup')) return;

  // Desativa controles do jogo
  controls.unlock();
  document.removeEventListener('mousedown', onMouseDownGame, true);
  document.removeEventListener('keydown', onKeyDownGame, true);

  // Cria overlay
  const overlay = document.createElement('div');
  overlay.id = 'fishingPopup';
  overlay.style.position = 'absolute';
  overlay.style.top = '50%';
  overlay.style.left = '50%';
  overlay.style.transform = 'translate(-50%, -50%)';
  overlay.style.width = '300px';
  overlay.style.height = '300px';
  overlay.style.background = 'rgba(0, 100, 200, 0.8)';
  overlay.style.border = '4px solid #fff';
  overlay.style.borderRadius = '12px';
  overlay.style.zIndex = 1000;
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '10px';
  document.body.appendChild(overlay);

  // Canvas para renderização do minijogo
  const canvas = document.createElement('canvas');
  canvas.width = 280;
  canvas.height = 220;
  overlay.appendChild(canvas);

  // Botão de acerto
  const btn = document.createElement('button');
  btn.innerText = 'PESCA!';
  btn.style.marginTop = '10px';
  btn.style.padding = '10px 20px';
  btn.style.fontSize = '1.2em';
  btn.style.cursor = 'pointer';
  btn.style.border = 'none';
  btn.style.backgroundColor = '#28a745';
  btn.style.color = '#fff';
  btn.style.borderRadius = '5px';
  overlay.appendChild(btn);

  // Setup Three.js minigame interno
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 10);
  camera.position.z = 5;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(canvas.width, canvas.height);

  // Círculo externo
  const circleGeom = new THREE.RingGeometry(0.9, 1, 64);
  const circleMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb });
  const circle = new THREE.Mesh(circleGeom, circleMat);
  scene.add(circle);

  // Zona de acerto vermelha
  const innerRadius = 0.7;
  const outerRadius = 1;
  const startAngle = Math.PI / 6;
  const endAngle = Math.PI / 3;

  const arcShape = new THREE.Shape();
  arcShape.absarc(0, 0, outerRadius, startAngle, endAngle, false);

  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, endAngle, startAngle, true);
  arcShape.holes.push(hole);

  const arcGeom = new THREE.ShapeGeometry(arcShape);
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, opacity: 1 });
  const arc = new THREE.Mesh(arcGeom, arcMat);
  scene.add(arc);

  // Linha giratória
  const lineGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0)
  ]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const rotatingLine = new THREE.Line(lineGeom, lineMat);
  scene.add(rotatingLine);

  let angle = 0;
  let success = false;

  function animateMinigame() {
    angle += 0.05;
    const x = Math.sin(angle);
    const y = Math.cos(angle);
    rotatingLine.geometry.setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(x, y, 0)
    ]);
    renderer.render(scene, camera);
    if (!success) requestAnimationFrame(animateMinigame);
  }

  animateMinigame();

  btn.onclick = () => {
    const currentAngle = angle % (2 * Math.PI);
    const inTarget = currentAngle >= Math.PI / 6 && currentAngle <= Math.PI / 3;
  
    success = true;
  
    // Fecha popup
    document.body.removeChild(overlay);
  
    // Recolhe a bóia primeiro
    recallBobber();
  
    // Mostra popup e adiciona ao inventário, se necessário
    if (inTarget) {
      fishCaught = true;
      const caught = fishTypes[Math.floor(Math.random() * fishTypes.length)];
      showSuccessStar(bobberBody.position.clone());
      showFishPopup(caught.name, caught.image);
      inventory[caught.key].quantity++;
    }
  
    // Reativa controlos
    unblockGameControls();
    setTimeout(() => {
      controls.lock();
    }, 100);
  };
  
  
  
  
}

// Recolhe a boia para a cana
function recallBobber() {
  if (bobberConstraint) {
    world.removeConstraint(bobberConstraint);
    bobberConstraint = null;
  }

  if (trembleInterval) {
    clearInterval(trembleInterval);
    trembleInterval = null;
  }

  if (startMinigameTimeout) {
    clearTimeout(startMinigameTimeout);
    startMinigameTimeout = null;
  }

  // Reposiciona a bóia
  const rodTip = getRodTipPosition();
  bobberBody.velocity.setZero();
  bobberBody.angularVelocity.setZero();
  bobberBody.position.set(rodTip.x, rodTip.y, rodTip.z);

  // Cria o novo ponto fixo
  const fixedPoint = new CANNON.Body({ mass: 0 });
  fixedPoint.position.copy(rodTip);

  world.addBody(fixedPoint);

  bobberConstraint = new CANNON.PointToPointConstraint(
    bobberBody, new CANNON.Vec3(0, 0, 0),
    fixedPoint, new CANNON.Vec3(0, -0.05, -1)
  );
  world.addConstraint(bobberConstraint);

  // Flags
  isFishing = false;
  fishCaught = false;
  clickCount = 0;

  console.log("[DEBUG] recallBobber done");
}

// Estas funções devem existir no teu código principal
function onMouseDownGame(e) {
  e.stopPropagation();
  e.preventDefault();
}
function onKeyDownGame(e) {
  e.stopPropagation();
  e.preventDefault();
}


function showSuccessStar(position) {
  const starShape = new THREE.Shape();
  const spikes = 5, outerRadius = 0.3, innerRadius = 0.15;
  for (let i = 0; i < 2 * spikes; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i / spikes) * Math.PI;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();

  const geometry = new THREE.ShapeGeometry(starShape);
  const material = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true });
  const star = new THREE.Mesh(geometry, material);
  star.position.set(position.x, position.y + 0.5, position.z);
  star.rotation.x = -Math.PI / 2;
  scene.add(star);

  let opacity = 1;
  let rise = 0;

  const interval = setInterval(() => {
    opacity -= 0.05;
    rise += 0.01;
    star.material.opacity = opacity;
    star.position.y += 0.01;
    if (opacity <= 0) {
      clearInterval(interval);
      scene.remove(star);
      geometry.dispose();
      material.dispose();
    }
  }, 30);function showSuccessStar(position) {
    const starShape = new THREE.Shape();
    const spikes = 5, outerRadius = 0.3, innerRadius = 0.15;
    for (let i = 0; i < 2 * spikes; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / spikes) * Math.PI;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();
  
    const geometry = new THREE.ShapeGeometry(starShape);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true });
    const star = new THREE.Mesh(geometry, material);
    star.position.set(position.x, position.y + 0.5, position.z);
    star.rotation.x = -Math.PI / 2;
    scene.add(star);
  
    let opacity = 1;
    let rise = 0;
  
    const interval = setInterval(() => {
      opacity -= 0.05;
      rise += 0.01;
      star.material.opacity = opacity;
      star.position.y += 0.01;
      if (opacity <= 0) {
        clearInterval(interval);
        scene.remove(star);
        geometry.dispose();
        material.dispose();
      }
    }, 30);
  }
}




function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);
  const delta = clock.getDelta();

  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;

  direction.z = Number(move.forward) - Number(move.backward);
  direction.x = Number(move.right) - Number(move.left);
  direction.normalize();

  const front = new THREE.Vector3();
  controls.getDirection(front);
  const side = new THREE.Vector3().crossVectors(front, camera.up).normalize();


  if (move.forward || move.backward) velocity.addScaledVector(front, direction.z * 400.0 * delta);
  if (move.left || move.right) velocity.addScaledVector(side, direction.x * 400.0 * delta);

  const player = controls.getObject();
  player.position.addScaledVector(velocity, delta);
  player.position.y = 15;

  const maxRadius = 140;
  const dist = Math.sqrt(player.position.x ** 2 + player.position.z ** 2);
  if (dist > maxRadius) {
    const angle = Math.atan2(player.position.z, player.position.x);
    player.position.x = Math.cos(angle) * maxRadius;
    player.position.z = Math.sin(angle) * maxRadius;
    velocity.set(0, 0, 0);
  }

  const rodTip = rod.position.clone();
  rodTip.applyMatrix4(camera.matrixWorld);

  fishingLine.geometry.setFromPoints([rodTip, bobber.position]);



  bobber.position.copy(bobberBody.position);
  bobber.quaternion.copy(bobberBody.quaternion);

  // Verifica se a bóia atingiu a superfície da água e ainda não iniciou a pesca
  if (isFishing && !trembleInterval && !startMinigameTimeout) {
    const waterLevel = 0.5;
    const bobberRadius = 0.3;
    if (bobber.position.y <= waterLevel + bobberRadius * 0.5) {
      createSplash(bobber.position);
      spawnFishShadow(bobber.position);
      startFishingAnimation();
    }
  }
  


  // Fish movement restricted to water
  fish.forEach(f => {
    const pos = f.body.position;
    const xIndex = Math.floor((pos.x + terrainSize / 2) / (terrainSize / terrainSegments));
    const zIndex = Math.floor((pos.z + terrainSize / 2) / (terrainSize / terrainSegments));
    const index = zIndex * (terrainSegments + 1) + xIndex;
    const yTerrain = terrainGeometry.attributes.position.getZ(index);

    if (yTerrain <= 0.5) {
      const force = f.wanderTarget.clone().multiplyScalar(0.1);
      f.body.velocity.x += force.x;
      f.body.velocity.z += force.z;

      f.body.velocity.x = THREE.MathUtils.clamp(f.body.velocity.x, -1, 1);
      f.body.velocity.z = THREE.MathUtils.clamp(f.body.velocity.z, -1, 1);

      if (Math.random() < 0.01) {
        f.wanderTarget.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      }
    } else {
      const angle = Math.atan2(pos.z, pos.x);
      f.body.velocity.x = -Math.cos(angle) * 0.5;
      f.body.velocity.z = -Math.sin(angle) * 0.5;
    }

    f.mesh.position.copy(pos);
    f.mesh.quaternion.copy(f.body.quaternion);
  });

  if (bobberConstraint && bobberConstraint.bodyB) {
    const rodTip = rod.position.clone();
    rodTip.applyMatrix4(camera.matrixWorld);
    bobberConstraint.bodyB.position.set(rodTip.x, rodTip.y, rodTip.z);
  }
  
  

  renderer.render(scene, camera);
}