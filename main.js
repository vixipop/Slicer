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
// let cuttingPlane;

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

let planeProxyClip;

function onMouseMove(event) {
  if (!startPoint) return;
  mouse = getMouseCoordinates(event.clientX, event.clientY);
  endPoint = getIntersectionPoint(mouse);

  // if (cuttingPlane) {
  //   scene.remove(cuttingPlane);
  // }

  const planeNormal = new THREE.Vector3()
    .subVectors(endPoint, startPoint)
    .normalize();
  const planeConstant = new THREE.Vector3()
    .subVectors(endPoint, startPoint)
    .length();

  //Cutting Plane
  planeProxyClip = new THREE.BoxGeometry(1000, 1000, 1000);
  planeProxyClip.translate(0, 0, 499.9 - planeConstant);
  planeProxyClip.lookAt(planeNormal);

  // cuttingPlane = new THREE.Mesh(
  //   new THREE.PlaneGeometry(10, 10),
  //   new THREE.MeshBasicMaterial({
  //     color: 0xff0000,
  //     side: THREE.DoubleSide,
  //     transparent: true,
  //     opacity: 0.5,
  //   })
  // );
  // cuttingPlane.position.x = (endPoint.x + startPoint.x) / 2;
  // cuttingPlane.position.y = (endPoint.y + startPoint.y) / 2;
  // cuttingPlane.position.z = (endPoint.z + startPoint.z) / 2;

  // cuttingPlane.lookAt(planeNormal);
  // cuttingPlane.scale.set(1, planeConstant, 1);
  // scene.add(cuttingPlane);
}

function onMouseUp(event) {
  if (!startPoint) return;

  startPoint = null;
  endPoint = null;

  performCut();
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

function performCut() {
  if (!objectToCut || !planeProxyClip) return;

  const plane = new THREE.Plane();
  const direction = new THREE.Vector3(0, 1, 0);
  planeProxyClip.getWorldDirection(direction); //Gives normal ?
  plane.setFromCoplanarPoints(direction, planeProxyClip.position);

  const cutPieces = cutPlane(plane);
  console.log("This is WHAT IT HAS CUT INTO ", cutPieces);
  // if (!cutPieces && cutPieces.length < 2) return;

  // const material = new THREE.MeshBasicMaterial({
  //   color: 0x00ff00,
  //   side: THREE.DoubleSide,
  // });

  // const half1 = new THREE.Mesh(cutPieces[0], material);
  // const half2 = new THREE.Mesh(cutPieces[1], material);

  // scene.add(half1, half2);
}

// Cutting Method
function cutPlane() {
  const brush1 = new Brush(objectToCut);
  brush1.updateMatrixWorld();
  const brush2 = new Brush(planeProxyClip);
  brush1.updateMatrixWorld();

  const evaluator = new Evaluator();
  const result = evaluator.evaluate(brush1, brush2, SUBTRACTION);
  console.log(result);
  return result;
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
