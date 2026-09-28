import * as THREE from 'three';
import { guify } from 'guify';

import './style/main.css';
import terrainVertexShader from './shaders/terrain/vertex.glsl';
import terrainFragmentShader from './shaders/terrain/fragment.glsl';

// Global
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const isDebug = new URLSearchParams(window.location.search).has('debug') || window.location.hash === '#debug';

// Canvas
const canvas = document.querySelector('.webgl');

/**
 * Sizes
 */
const sizes = {};
sizes.width = window.innerWidth;
sizes.height = window.innerHeight;

/**
 * Palettes
 * Phases for the cosine palette in the fragment shader: 0.5 + 0.5 * cos(TAU * (t + phase))
 */
const palettes = [
    { name: 'Aurora', phase: new THREE.Vector3(0.0, 0.33, 0.67) },
    { name: 'Synth', phase: new THREE.Vector3(0.5, 0.2, 0.25) },
    { name: 'Ember', phase: new THREE.Vector3(0.0, 0.1, 0.2) },
    { name: 'Ocean', phase: new THREE.Vector3(0.6, 0.45, 0.3) }
];

const paletteColor = (phase, t) => {
    const channel = (p) => Math.round((0.5 + 0.5 * Math.cos(Math.PI * 2 * (t + p))) * 255);
    return `rgb(${channel(phase.x)}, ${channel(phase.y)}, ${channel(phase.z)})`;
};

/**
 * Scroll keyframes, one per section (in page order)
 */
const keyframes = {
    hero: { position: [0, 1.1, 4.2], target: [0, -0.2, 0], elevation: 0.8, valley: 0.85, palette: 0 },
    features: { position: [2.4, 1.7, 3.0], target: [0, 0, -0.5], elevation: 1.1, valley: 0.4, palette: 1 },
    how: { position: [-2.6, 1.2, 2.2], target: [0.6, 0.1, -1], elevation: 1.4, valley: 0.15, palette: 2 },
    playground: { position: [0, 4.4, 1.4], target: [0, 0, -0.6], elevation: 1.0, valley: 0.3, palette: 3 },
    start: { position: [0, 0.9, 3.8], target: [0, 0, -2], elevation: 0.7, valley: 0.9, palette: 0 }
};

/**
 * Settings (editable from the playground)
 */
const defaults = {
    elevation: 2,
    linesCount: 3.5,
    miniLinesCount: 4,
    flowSpeed: 1,
    miniIntensity: 1,
    palette: 'auto'
};
const settings = { ...defaults };

/**
 * Environments
 */
// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 100);
camera.position.set(...keyframes.hero.position);
scene.add(camera);

const cameraTarget = new THREE.Vector3(...keyframes.hero.target);

/**
 * Terrain
 */
const terrain = {};

// geometry
terrain.geometry = new THREE.PlaneGeometry(1, 1, 600, 600);
terrain.geometry.rotateX(-Math.PI * 0.5);

// material
terrain.material = new THREE.ShaderMaterial({
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    extensions: {
        derivatives: true
    },
    uniforms: {
        uTime: { value: 0 },
        uOffset: { value: 0 },
        uElevation: { value: settings.elevation },
        uValley: { value: keyframes.hero.valley },
        uLinesCount: { value: settings.linesCount },
        uMiniLinesCount: { value: settings.miniLinesCount },
        uMajorThickness: { value: 1.6 },
        uMiniThickness: { value: 1.3 },
        uMiniIntensity: { value: settings.miniIntensity },
        uPalettePhase: { value: palettes[0].phase.clone() },
        uFogNear: { value: 4 },
        uFogFar: { value: 13 }
    }
});

// mesh
terrain.mesh = new THREE.Mesh(terrain.geometry, terrain.material);
terrain.mesh.scale.set(20, 20, 20);

scene.add(terrain.mesh);

// Renderer
let renderer = null;
try {
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setClearColor(0x070b14, 1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
} catch (error) {
    // No WebGL: the page content still works, just without the terrain
    document.documentElement.classList.add('no-webgl');
    console.warn('WebGL is not available', error);
}

/**
 * Debug panel (add ?debug or #debug to the URL)
 */
if (isDebug) {
    const gui = new guify({
        title: 'Debug panel',
        align: 'right',
        theme: 'dark',
        barMode: 'none',
        panelOverflowBehavior: 'overflow'
    });

    gui.Register({ object: terrain.material, property: 'wireframe', type: 'checkbox' });

    [
        ['uMajorThickness', 0.5, 5],
        ['uMiniThickness', 0.5, 5],
        ['uFogNear', 0, 10],
        ['uFogFar', 1, 20]
    ].forEach(([uniform, min, max]) => {
        gui.Register({
            object: terrain.material.uniforms[uniform],
            property: 'value',
            type: 'range',
            label: uniform,
            min,
            max,
            step: 0.001
        });
    });
}

/**
 * Scroll
 */
const scroll = {
    y: window.scrollY,
    previousY: window.scrollY,
    velocity: 0,
    sections: [],
    // current keyframe mix, eased every frame towards the scroll target
    current: {
        position: new THREE.Vector3(...keyframes.hero.position),
        target: new THREE.Vector3(...keyframes.hero.target),
        elevation: keyframes.hero.elevation,
        valley: keyframes.hero.valley,
        phase: palettes[0].phase.clone()
    }
};

const measureSections = () => {
    scroll.sections = [...document.querySelectorAll('[data-section]')].map((element) => ({
        id: element.dataset.section,
        center: element.offsetTop + element.offsetHeight * 0.5
    }));
};
measureSections();

// Which two keyframes the middle of the viewport sits between
const getScrollKeyframes = () => {
    const middle = scroll.y + sizes.height * 0.5;
    const sections = scroll.sections;

    if (middle <= sections[0].center) {
        return { from: sections[0].id, to: sections[0].id, t: 0 };
    }

    for (let i = 0; i < sections.length - 1; i++) {
        if (middle < sections[i + 1].center) {
            const t = (middle - sections[i].center) / (sections[i + 1].center - sections[i].center);
            return { from: sections[i].id, to: sections[i + 1].id, t: smoothstep(clamp(t, 0, 1)) };
        }
    }

    const last = sections[sections.length - 1].id;
    return { from: last, to: last, t: 0 };
};

const progressBar = document.querySelector('.scroll-progress__bar');
const nav = document.querySelector('.nav');
const scrollHint = document.querySelector('.scroll-hint');

const onScroll = () => {
    scroll.y = window.scrollY;

    const maxScroll = document.documentElement.scrollHeight - sizes.height;
    progressBar.style.transform = `scaleX(${maxScroll > 0 ? scroll.y / maxScroll : 0})`;

    nav.classList.toggle('is-scrolled', scroll.y > 20);
    scrollHint.classList.toggle('is-hidden', scroll.y > 40);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/**
 * Pointer parallax
 */
const pointer = { x: 0, y: 0, easedX: 0, easedY: 0 };

window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / sizes.width) * 2 - 1;
    pointer.y = (event.clientY / sizes.height) * 2 - 1;
}, { passive: true });

// Glow that follows the pointer inside the feature cards
document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
        const bounds = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${event.clientX - bounds.left}px`);
        card.style.setProperty('--my', `${event.clientY - bounds.top}px`);
    });
});

/**
 * Reveal on scroll + active section
 */
document.querySelectorAll('.reveal').forEach((element) => {
    const siblings = [...element.parentElement.children].filter((child) => child.classList.contains('reveal'));
    element.style.setProperty('--delay', `${siblings.indexOf(element) * 90}ms`);
});

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const id = entry.target.dataset.section;
        document.querySelectorAll('[data-nav], [data-dot]').forEach((link) => {
            const isActive = link.dataset.nav === id || link.dataset.dot === id;
            link.classList.toggle('is-active', isActive);
            if (isActive) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
        });
    });
}, { rootMargin: '-50% 0px -50% 0px' });

document.querySelectorAll('[data-section]').forEach((section) => sectionObserver.observe(section));

/**
 * Playground controls
 */
const controlsForm = document.querySelector('#controls');

const formatValue = (name, value) => (name === 'miniLinesCount' ? `${value}` : Number(value).toFixed(2));

const syncControls = () => {
    controlsForm.querySelectorAll('input[type="range"]').forEach((input) => {
        input.value = settings[input.name];
        const fill = ((input.value - input.min) / (input.max - input.min)) * 100;
        input.style.setProperty('--fill', `${fill}%`);
        controlsForm.querySelector(`[data-output="${input.name}"]`).textContent = formatValue(input.name, input.value);
    });
    controlsForm.querySelector(`input[name="palette"][value="${settings.palette}"]`).checked = true;
};

controlsForm.addEventListener('input', (event) => {
    const { name, value } = event.target;
    if (!(name in settings)) return;

    settings[name] = name === 'palette' ? value : parseFloat(value);
    syncControls();
});

document.querySelector('#reset-controls').addEventListener('click', () => {
    Object.assign(settings, defaults);
    syncControls();
});

// Palette chips preview the real shader palette
document.querySelectorAll('[data-swatch]').forEach((chip) => {
    const phase = palettes[chip.dataset.swatch].phase;
    const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => paletteColor(phase, t));
    chip.style.background = `conic-gradient(${stops.join(', ')})`;
});

syncControls();

/**
 * Resize
 */
window.addEventListener('resize', () => {
    // Save sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Update renderer
    if (renderer) {
        renderer.setSize(sizes.width, sizes.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    measureSections();
    onScroll();
});

// Fonts and late layout can move the sections
window.addEventListener('load', measureSections);

/**
 * Loop
 */
const clock = new THREE.Clock();
const targetPosition = new THREE.Vector3();
const targetLookAt = new THREE.Vector3();
const targetPhase = new THREE.Vector3();
const keyframeVector = new THREE.Vector3();

const loop = () => {
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    const motionScale = reducedMotion.matches ? 0.2 : 1;

    // Scroll velocity (px / s), smoothed, makes the colours and the terrain rush
    const rawVelocity = (scroll.y - scroll.previousY) / Math.max(deltaTime, 0.001);
    scroll.previousY = scroll.y;
    scroll.velocity = lerp(scroll.velocity, rawVelocity, 1 - Math.exp(-deltaTime * 6));
    const boost = clamp(Math.abs(scroll.velocity) / 1200, 0, 3);

    const uniforms = terrain.material.uniforms;
    uniforms.uTime.value += deltaTime * settings.flowSpeed * (1 + boost * 2) * motionScale;
    uniforms.uOffset.value += deltaTime * (0.12 + scroll.velocity * 0.0005) * motionScale;

    // Blend the two keyframes around the current scroll position
    const { from, to, t } = getScrollKeyframes();
    const a = keyframes[from];
    const b = keyframes[to];

    targetPosition.fromArray(a.position).lerp(keyframeVector.fromArray(b.position), t);
    targetLookAt.fromArray(a.target).lerp(keyframeVector.fromArray(b.target), t);

    if (settings.palette === 'auto') {
        targetPhase.copy(palettes[a.palette].phase).lerp(palettes[b.palette].phase, t);
    } else {
        targetPhase.copy(palettes[settings.palette].phase);
    }

    // Ease everything towards its target
    const ease = 1 - Math.exp(-deltaTime * (reducedMotion.matches ? 10 : 3));
    const current = scroll.current;
    current.position.lerp(targetPosition, ease);
    current.target.lerp(targetLookAt, ease);
    current.phase.lerp(targetPhase, ease);
    current.elevation = lerp(current.elevation, lerp(a.elevation, b.elevation, t), ease);
    current.valley = lerp(current.valley, lerp(a.valley, b.valley, t), ease);

    uniforms.uElevation.value = settings.elevation * current.elevation;
    uniforms.uValley.value = current.valley;
    uniforms.uPalettePhase.value.copy(current.phase);
    uniforms.uLinesCount.value = settings.linesCount;
    uniforms.uMiniLinesCount.value = settings.miniLinesCount;
    uniforms.uMiniIntensity.value = settings.miniIntensity;

    // Pointer parallax
    const parallax = reducedMotion.matches ? 0 : 1;
    pointer.easedX = lerp(pointer.easedX, pointer.x, 1 - Math.exp(-deltaTime * 4));
    pointer.easedY = lerp(pointer.easedY, pointer.y, 1 - Math.exp(-deltaTime * 4));

    camera.position.copy(current.position);
    camera.position.x += pointer.easedX * 0.35 * parallax;
    camera.position.y -= pointer.easedY * 0.15 * parallax;
    camera.lookAt(current.target);

    // Render
    if (renderer) renderer.render(scene, camera);

    // Keep looping
    window.requestAnimationFrame(loop);
};
loop();
