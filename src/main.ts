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
//const controls = new FlyControls(camera, renderer.domElement);
const clock = new THREE.Clock();

controls.movementSpeed = 2;
controls.domElement = renderer.domElement;
controls.rollSpeed = Math.PI / 24;
controls.autoForward = false;
controls.dragToLook = false;

const auxScene = new AuxScene(
    shaderMap.vsScreen,
    shaderMap.fsScreen,
    {
        cameraMatrix: { value: camera.projectionMatrixInverse },
        worldMatrix: { value: camera.matrixWorld },
        realCameraPosition: { value: camera.position },
    }
);

function loop() {
    stats.update();
    //renderer.render(scene, camera);
    const delta = clock.getDelta();
    controls.update( delta );

    auxScene.uniforms.cameraMatrix.value = camera.projectionMatrixInverse;
    auxScene.uniforms.worldMatrix.value = camera.matrixWorld;
    auxScene.uniforms.realCameraPosition.value = camera.position;
    renderer.render(auxScene.scene, auxScene.camera);

    //console.log(camera.matrixWorld.toArray());
    //console.log(camera.position);

    requestAnimationFrame(loop);
}

function onKeyDown(event: any) {
    switch (event.keyCode) {
        case 83: // up
            camera.position.z += 50;
            break;
        case 87: // down
            camera.position.z -= 50;
            break;
    }
    controls.update();
}

function init() {
    console.log('Init2');

    document.body.appendChild(renderer.domElement);
    camera.position.set(0, 0, 5);
    //controls.update();

    document.body.addEventListener( 'keydown', onKeyDown, false );

    loop();
}

init();
