import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { guify } from 'guify';

import './style/main.css';
import terrainVertexShader from './shaders/terrain/vertex.glsl';
import terrainFragmentShader from './shaders/terrain/fragment.glsl';

// Canvas
const canvas = document.querySelector('.webgl');

/**
 * Sizes
 */
const sizes = {};
sizes.width = window.innerWidth;
sizes.height = window.innerHeight;

window.addEventListener('resize', () => {
    // Save sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * GUI
 */
const gui = new guify({
    title: 'Debug panel',
    align: 'right',
    theme: 'dark',
    barMode: 'none',
    panelOverflowBehavior: 'overflow'
});

const guiVariables = {
    clearColor: 0x141d29
};

/**
 * Environments
 */
// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.x = 1;
camera.position.y = 1;
camera.position.z = 1;
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Terrain
 */
// terrain
const terrain = {};

// geometry
terrain.geometry = new THREE.PlaneGeometry(1, 1, 600, 600);
terrain.geometry.rotateX(-Math.PI * 0.5);

// material
terrain.material = new THREE.ShaderMaterial({
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
        uElevation: { value: 2 }
    }
});

// debug
gui.Register({
    object: terrain.material.uniforms.uElevation,
    property: 'value',
    type: 'range',
    label: 'uElevation',
    min: 0.5,
    max: 5,
    step: 0.001
})

// mesh
terrain.mesh = new THREE.Mesh(terrain.geometry, terrain.material);
terrain.mesh.scale.set(10, 10, 10);

scene.add(terrain.mesh);

// Renderer
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
});
renderer.setSize(sizes.width, sizes.height);
renderer.setClearColor(guiVariables.clearColor, 1);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Debug
gui.Register({
    object: guiVariables,
    property: 'clearColor',
    type: 'color',
    label: 'clearColor',
    format: 'hex',
    onChange: () => {
        renderer.setClearColor(guiVariables.clearColor, 1);
    }
});

/**
 * Loop
 */
const loop = () => {
    // Controller
    controls.update();

    // Render
    renderer.render(scene, camera);

    // Keep looping
    window.requestAnimationFrame(loop);
};
loop();
