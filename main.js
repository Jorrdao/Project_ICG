// Autor: José Jordão

import './style.css';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'; // ✅ FIXED IMPORT
import * as THREE from 'three';


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 11000);
camera.position.z = 70; // ✅ Zoom out a bit more

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111); 
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// Cube 
//const cube_geometry = new THREE.BoxGeometry(5, 5, 5);
//const cube2_material = new THREE.MeshStandardMaterial({ color: 0xFF6347 });
//const cube2 = new THREE.Mesh(cube_geometry, cube2_material);
//scene.add(cube2);

//lighting

//const point_light = new THREE.PointLight(0xFFFFFF, 1);
//point_light.position.set(1,30,89);
const ambient_light = new THREE.AmbientLight(0xFFFFFF, 1);
scene.add(ambient_light);

//const light_helper = new THREE.PointLightHelper(point_light);
const grid_helper = new THREE.GridHelper(200, 50);
scene.add( grid_helper);

const controls = new OrbitControls(camera, renderer.domElement);


const suntexture = new THREE.TextureLoader().load('images/sun.jpg');
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(19, 38, 32),
  new THREE.MeshStandardMaterial({ map: suntexture })
);
sun.position.set(13, 75, -123);
scene.add(sun);

const skytexture = new THREE.TextureLoader().load('images/sky.jpg');
scene.background = skytexture;

const grass_texture = new THREE.TextureLoader().load('images/grass.jpg');
const grass = new THREE.Mesh(
  new THREE.BoxGeometry(250,1,-250),
  new THREE.MeshStandardMaterial({ map: grass_texture })
);

scene.add(grass);





function animate() {
	
  //cube2.rotation.x -= 0.01;
  //cube2.rotation.y -= 0.01;

  controls.update();

  renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );