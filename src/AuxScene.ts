import * as THREE from 'three';

class AuxScene {
    scene: THREE.Scene = new THREE.Scene();
    camera: THREE.Camera = new THREE.OrthographicCamera(
        window.innerWidth / - 2, 
        window.innerWidth / 2, 
        window.innerHeight / 2,
        window.innerHeight / - 2,
        -10000, 
        10000
    );
    buffer: THREE.WebGLRenderTarget;
    uniforms: any;

    constructor(vertexShader: string, fragmentShader: string, parameters = {}) {
        this.camera.position.z = 100;

        this.buffer = new THREE.WebGLRenderTarget(
            window.innerWidth,
            window.innerHeight,
            { format: THREE.RGBAFormat, type: THREE.FloatType }
        );
        this.buffer.depthBuffer = true;
        this.buffer.depthTexture = new THREE.DepthTexture(window.innerWidth, window.innerHeight);

        this.uniforms = { buffer: { value: this.buffer.texture }, ...parameters };
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader,
            fragmentShader,
            depthWrite: false
        });

        const plane = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);

        const quad = new THREE.Mesh(plane, material);
        quad.position.z = -100;
        this.scene.add(quad);
    }
}

export { AuxScene };
