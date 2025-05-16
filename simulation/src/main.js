import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector('#bg');
console.log(canvas); // Should not be null

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas });

renderer.setClearColor(0x222222); // Set background color
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 20; // Move camera closer

const geometry = new THREE.TorusGeometry(5, 1, 16, 100); // Smaller torus
const material = new THREE.MeshStandardMaterial({ color: 0xFF6347 , wireframe: true}); // No wireframe
const torus = new THREE.Mesh(geometry, material);
scene.add(torus);

const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(20, 20, 20);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Add ambient light
scene.add(ambientLight);

camera.lookAt(torus.position);

const gridHelper = new THREE.GridHelper(100, 100);
scene.add(gridHelper);

const controls = new OrbitControls(camera, renderer.domElement);

function animate() {
  requestAnimationFrame(animate);
  torus.rotation.x += 0.01;
  torus.rotation.y += 0.005;
  torus.rotation.z += 0.01;
  renderer.render(scene, camera);
  controls.update();
}
animate();