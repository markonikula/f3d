import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { loadShaderMap } from "./util.js";
import { AuxScene } from './AuxScene.js';

const worldDimensions = new THREE.Vector3(
    Math.floor(window.innerWidth * 0.6),
    Math.floor(window.innerHeight),
    Math.floor(window.innerHeight * 0.7)
);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);

const stats = new Stats();
document.getElementsByTagName("body")[0].appendChild(stats.dom);

const SHADERS = {
    vsScreen: "screen.vert",
    fsScreen: "screen.frag",
};
const shaderMap = await loadShaderMap(SHADERS);

const geometry = new THREE.BoxGeometry(100, 100, 100);
const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
const controls = new OrbitControls(camera, renderer.domElement);
const clock = new THREE.Clock();
const realCamera = new THREE.Vector3(0, 0, 5);
var movableCamera = false;

var waterLevel = 0.9;

const auxScene = new AuxScene(
    shaderMap.vsScreen,
    shaderMap.fsScreen,
    {
        cameraMatrix: { value: camera.projectionMatrixInverse },
        worldMatrix: { value: camera.matrixWorld },
        realCameraPosition: { value: camera.position },
        frame: { value: 0 },
        waterLevel: { value: waterLevel }
    }
);

var frame = 0;

function loop() {
    stats.update();
    const delta = clock.getDelta();
    controls.update( delta );

    auxScene.uniforms.frame.value = frame++;
    auxScene.uniforms.waterLevel.value = waterLevel;
    auxScene.uniforms.cameraMatrix.value = camera.projectionMatrixInverse;
    auxScene.uniforms.worldMatrix.value = camera.matrixWorld;
    if (movableCamera) {
        auxScene.uniforms.realCameraPosition.value = realCamera;
    } else {
        auxScene.uniforms.realCameraPosition.value = camera.position;
    }
    renderer.render(auxScene.scene, auxScene.camera);

    requestAnimationFrame(loop);
}

const tmp: THREE.Vector3 = new THREE.Vector3();

function onKeyDown(event: any) {
    var factor = 0;
    switch (event.key) {
        case 'q': factor = 0.01; break;
        case 'w': factor = 0.001; break;
        case 'e': factor = 0.0001; break;
        case 'a': factor = -0.01; break;
        case 's': factor = -0.001; break;
        case 'd': factor = -0.0001; break;
        case '1': movableCamera = false; camera.position.copy(realCamera); break;
        case '2': movableCamera = true; realCamera.copy(camera.position); break;
        case 'ArrowUp': waterLevel *= 1.001; break;
        case 'ArrowDown': waterLevel /= 1.001; break;
    }
    camera.getWorldDirection(tmp);
    tmp.multiplyScalar(factor);
    realCamera.add(tmp);
    console.log(realCamera);
}

function init() {
    console.log('Init');

    document.body.appendChild(renderer.domElement);
    camera.position.set(0, 0, 5);

    document.body.addEventListener( 'keydown', onKeyDown, false );

    loop();
}

init();
