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
camera.position.x = 0;
camera.position.y = 1;
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

// ThreeJS Sphere
// const objectToCut = new THREE.Mesh(
//   new THREE.SphereGeometry(1),
//   new THREE.MeshPhongMaterial({ color: 0xffff8fb2 })
// );
// objectToCut.position.set(0, 1, 0);
// console.log(objectToCut.getAttributes("position"));
// scene.add(objectToCut);

const objectToCutGeom = new THREE.SphereGeometry(1);
const objectToCut = new THREE.Mesh(
  objectToCutGeom,
  new THREE.MeshPhongMaterial({ color: 0xffff8fb2 })
);
objectToCut.position.set(0, 1, 0);
scene.add(objectToCut);
// console.log("ObjectToCut Log", objectToCutGeom.attributes.position);

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
const controls = new OrbitControls(camera, canvas);

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

const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
const points = [];
let lineGeometry;
let line;

function onMouseDown(event) {
  mouse = getMouseCoordinates(event.clientX, event.clientY);
  startPoint = getIntersectionPoint(mouse);
  endPoint = startPoint.clone();

  //line
  points.push(startPoint.x, startPoint.y, startPoint.z);
  lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  line = new THREE.Mesh(lineMaterial, lineGeometry);
  scene.add(line);
}

function onMouseMove(event) {
  if (!startPoint) return;
  mouse = getMouseCoordinates(event.clientX, event.clientY);
  endPoint = getIntersectionPoint(mouse);

  points.push(endPoint.x, endPoint.y, endPoint.z);
  lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  line = new THREE.Mesh(lineMaterial, lineGeometry);
}

function onMouseUp(event) {
  if (!startPoint) return;

  performCut(startPoint, endPoint);
  scene.remove(line);

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
  //OG plane used to find normal and constant
  const newPlane = new THREE.Plane();
  newPlane.setFromCoplanarPoints(startPoint, endPoint, camera.position);

  //Cutting plane 1
  const cuttingPlane = new THREE.BoxGeometry(1000, 1000, 1000);
  cuttingPlane.translate(0, 0, 499.9 - newPlane.constant);
  cuttingPlane.lookAt(newPlane.normal);

  //CuttingPlane2
  const cuttingPlaneOther = new THREE.BoxGeometry(1000, 1000, 1000);
  cuttingPlaneOther.translate(0, 0, 499.9 + newPlane.constant);
  cuttingPlaneOther.lookAt(newPlane.normal.clone().multiplyScalar(-1));

  //Post cut split object
  const [postCutTopGeometry, postCutBottomGeometry] = cutPlane(
    cuttingPlane,
    cuttingPlaneOther
  );

  const postCutTopObject = new THREE.Mesh(
    postCutTopGeometry,
    new THREE.MeshPhongMaterial({ color: 0xffff8fb2 })
  );
  postCutTopObject.position.y = 1;
  // postCutTopObject.position.x -= 0.2;
  const postCutBottomObject = new THREE.Mesh(
    postCutBottomGeometry,
    new THREE.MeshPhongMaterial({ color: 0xffff8fb2 })
  );
  postCutBottomObject.position.y = 1;
  // postCutBottomObject.position.x += 0.2;

  scene.add(postCutTopObject, postCutBottomObject);
  scene.remove(objectToCut);

  // console.log("Post Cut Geom", postCutGeometry);
  // console.log("Result.geometry position", postCutGeometry.attributes.position);
  // const postCutMaterial = new THREE.MeshPhongMaterial({ color: 0xffff8fb2 });
  // const postCutObject = new THREE.Mesh(postCutGeometry, postCutMaterial);
  // postCutObject.position.set(0, 2, 0);

  // scene.add(postCutObject);
  // scene.remove(objectToCut);
}

// Cutting Method

function cutPlane(cuttingPlane, cuttingPlaneOther) {
  const topSlice = new Brush(cuttingPlane);
  topSlice.updateMatrixWorld();

  const bottomSlice = new Brush(cuttingPlaneOther);
  bottomSlice.updateMatrixWorld();
  bottomSlice.geometry.computeVertexNormals();

  const meshBrush = new Brush(objectToCutGeom);
  meshBrush.updateMatrixWorld();

  const evaluator = new Evaluator();
  const topResult = evaluator.evaluate(meshBrush, topSlice, SUBTRACTION);
  const bottomResult = evaluator.evaluate(meshBrush, bottomSlice, SUBTRACTION);
  // console.log("RESULT GEOMETRY", topResult.geometry, bottomResult.geometry);
  return [topResult.geometry, bottomResult.geometry];
}
//Render loop
const clock = new THREE.Clock();
function animate() {
  //Delta
  const elapsedTime = clock.getElapsedTime();

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
