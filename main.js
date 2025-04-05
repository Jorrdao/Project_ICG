// Autor: José Jordão

import './style.css';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'; // ✅ FIXED IMPORT
import * as THREE from 'three';
import * as CANNON from 'cannon-es';




// Cena, câmara e renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 11000);
camera.position.z = 70;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.display = 'block';
renderer.domElement.style.width = '100vw';
renderer.domElement.style.height = '100vh';
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

// Luzes
const ambient_light = new THREE.AmbientLight(0xFFFFFF, 1);
scene.add(ambient_light);

// Grid Helper
const grid_helper = new THREE.GridHelper(200, 50);
scene.add(grid_helper);

// Controlo de câmara
const controls = new OrbitControls(camera, renderer.domElement);

// Sol (esfera com textura)
const suntexture = new THREE.TextureLoader().load('images/sun.jpg');
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(19, 38, 32),
  new THREE.MeshStandardMaterial({ map: suntexture })
);
sun.position.set(13, 75, -123);
scene.add(sun);

// Céu (fundo)
const skytexture = new THREE.TextureLoader().load('images/sky.jpg');
scene.background = skytexture;

// Chão com textura
const grass_texture = new THREE.TextureLoader().load('images/grass.jpg');
const grass = new THREE.Mesh(
  new THREE.BoxGeometry(250, 1, 250),
  new THREE.MeshStandardMaterial({ map: grass_texture })
);
scene.add(grass);

// ⚙️ PHYSICS CANNON.JS
const physicsWorld = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
});

// Chão físico (plano)
const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane()
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
physicsWorld.addBody(groundBody);

//* Esfera física
const sphereRadius = 3;
const sphereShape = new CANNON.Sphere(sphereRadius);
const sphereBody = new CANNON.Body({
  mass: 1,
  shape: sphereShape,
  position: new CANNON.Vec3(0, 20, 0)
});
physicsWorld.addBody(sphereBody);

// Esfera visual
const sphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(sphereRadius, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0x00ffff })
);
//scene.add(sphereMesh);


// GLTF

const syncedObjects = []; // [{ mesh: ..., body: ... }, ...]


function load_3d(model, size,x,y,z) {
  
  const loader = new GLTFLoader();
  const model_to_load = model;
  let object = null;
  let body = null;
  
  loader.load(
    `/models/${model_to_load}/scene.gltf`,
    function (gltf) {
      object = gltf.scene;
  
      object.scale.set(size, size, size);
      object.position.set(x, y, z);
      object.rotation.y = Math.PI;
  
      scene.add(object);
  
      let mesh = null;
      object.traverse((child) => {
        if (child.isMesh && !mesh) {
          mesh = child;
        }
      });
  
      if (mesh) {
        mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox;
        const sizeVec = new THREE.Vector3();
        bbox.getSize(sizeVec);
  
        const boxShape = new CANNON.Box(
          new CANNON.Vec3(sizeVec.x * size / 2, sizeVec.y * size / 2, sizeVec.z * size / 2)
        );
  
        body = new CANNON.Body({
          mass: 1,
          shape: boxShape,
          position: new CANNON.Vec3(x, y + 10,z), // para cair
        });
  
        physicsWorld.addBody(body);
  
        // Guarda o par mesh + corpo
        syncedObjects.push({ mesh: object, body: body });
      }
  
      console.log('Modelo carregado:', object);
    },
  
    function (xhr) {
      console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    function (error) {
      console.error(error);
    }
  );
}
// Carregar o modelo 3D
load_3d('fisherman', 2,0,0,0);
load_3d('pine', 2,45,0,7);
load_3d('pine', 2,45,0,57);
load_3d('pine', 2,25,0,65);
load_3d('pine', 2,-85,0,12);
load_3d('pine', 2,-45,0,7);
load_3d('pine', 2,45,0,-117);



// ANIMAÇÃO
function animate() {
  // Atualizar física
  physicsWorld.fixedStep();

  // Atualizar todos os modelos com corpo físico
  syncedObjects.forEach(({ mesh, body }) => {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  });


  // Atualizar debugger e controlos
  controls.update();

  // Renderizar
  renderer.render(scene, camera);

  // Próximo frame
  requestAnimationFrame(animate);
}

animate();
