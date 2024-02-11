import * as THREE from "three";
import CANNON, { ContactMaterial } from "cannon";
import * as dat from "dat.gui";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SUBTRACTION, Brush, Evaluator } from "three-bvh-csg";

// Initial setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / innerHeight,
  0.1,
  1000
); //fov, aspect ratio, near, far
camera.position.x = 1;
camera.position.y = 2;
camera.position.z = 5;

// GUI
const gui = new dat.GUI();
//Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
const canvas = renderer.domElement;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
document.body.appendChild(canvas);

//Physics World
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

//Materials
const defaultMaterial = new CANNON.Material("concrete");

const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.1,
    restitution: 0.7,
  }
);
world.addContactMaterial(defaultContactMaterial);
world.defaultContactMaterial = defaultContactMaterial;

//Physics Sphere
const sphereShape = new CANNON.Sphere(1);
const sphereBody = new CANNON.Body({
  mass: 1,
  position: new CANNON.Vec3(0, 3, 0),
  shape: sphereShape,
});
world.addBody(sphereBody);

//Physics Floor
const floorShape = new CANNON.Plane();
const floorBody = new CANNON.Body();
floorBody.addShape(floorShape);
floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5);
world.addBody(floorBody);

// ThreeJS Sphere
const objectToCut = new THREE.Mesh(
  new THREE.SphereGeometry(1),
  new THREE.MeshPhongMaterial({ color: 0xffff8fb2 })
);
objectToCut.position.set(0, 1, 0);
scene.add(objectToCut);

//Knife
// const loader = new GLTFLoader();
// loader.load("/knife.glb", function (gltf) {
//   const knife = gltf.scene;
//   knife.position.set(2, 0, 0);
//   knife.scale.set(4, 4, 4);
//   knife.rotateY(Math.PI);

//   scene.add(knife);
// });

//Threejs Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(5, 5),
  new THREE.MeshBasicMaterial({ color: 0xffc9c9c9, side: THREE.DoubleSide })
);
floor.position.set(0, 0, 0);
floor.rotateX(-Math.PI / 2);

scene.add(floor);
//Controls
// const controls = new OrbitControls(camera, canvas);

//Light
const hemiLight = new THREE.HemisphereLight(0xffff61c5, 0xff7b61ff);
scene.add(hemiLight);

//Raycasting and mouse drag events
let startPoint;
let endPoint;

document.addEventListener("mousedown", onMouseDown, false);
document.addEventListener("mousemove", onMouseMove, false);
document.addEventListener("mouseup", onMouseUp, false);

const raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

function onMouseDown(event) {
  mouse = getMouseCoordinates(event.clientX, event.clientY);
  startPoint = getIntersectionPoint(mouse);
  endPoint = startPoint.clone();
}

function onMouseMove(event) {
  if (!startPoint) return;
  mouse = getMouseCoordinates(event.clientX, event.clientY);
  endPoint = getIntersectionPoint(mouse);
}

function onMouseUp(event) {
  if (!startPoint) return;

  performCut(startPoint, endPoint);

  startPoint = null;
  endPoint = null;
}

function getMouseCoordinates(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;
  return new THREE.Vector3(x, y, 0);
}

function getIntersectionPoint(mouse) {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(objectToCut);
  if (intersects.length > 0) {
    return intersects[0].point;
  }
  return null;
}

function performCut(startPoint, endPoint) {
  const newPlane = new THREE.Plane();
  newPlane.setFromCoplanarPoints(startPoint, endPoint, camera.position);
  const cuttingPlane = new THREE.BoxGeometry(1000, 1000, 1000);
  cuttingPlane.translate(0, 0, 499.9 - newPlane.constant);
  cuttingPlane.lookAt(newPlane.normal);
  console.log("Cutting Plane position", cuttingPlane.attributes.position);

  const postCutGeometry = cutPlane(cuttingPlane);
  console.log("Result.geometry position", postCutGeometry.attributes.position);
  const postCutMaterial = new THREE.MeshPhongMaterial({ color: 0xffff8fb2 });
  const postCutObject = new THREE.Mesh(postCutGeometry, postCutMaterial);
  scene.add(postCutObject);
}

// Cutting Method
function cutPlane(cuttingPlane) {
  const brush1 = new Brush(objectToCut.geometry);
  brush1.updateMatrixWorld();
  const brush2 = new Brush(cuttingPlane.geometry);
  brush1.updateMatrixWorld();

  const evaluator = new Evaluator();
  const result = evaluator.evaluate(brush1, brush2, SUBTRACTION);
  console.log(result.geometry);
  return result.geometry;
}
//Render loop
const clock = new THREE.Clock();
let oldElapsedTime = 0;

function animate() {
  //Delta
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - oldElapsedTime;
  oldElapsedTime = elapsedTime;

  //update physics world
  world.step(1 / 60, deltaTime, 3);
  objectToCut.position.copy(sphereBody.position);

  // controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
