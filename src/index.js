import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import './style/main.css';
import terrainVertexShader from './shaders/terrain/vertex.glsl';
import terrainFragmentShader from './shaders/terrain/fragment.glsl';

// Global
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const isSmallScreen = window.matchMedia('(max-width: 860px), (pointer: coarse)').matches;
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

/**
 * Terrain
 */
const terrain = {};

// geometry
// fewer vertices on phones and tablets, the contours stay smooth thanks to the per-pixel lines
const segments = isSmallScreen ? 320 : 512;
terrain.geometry = new THREE.PlaneGeometry(1, 1, segments, segments);
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
    defines: {
        BUMPS_COUNT: 8
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
        uFogFar: { value: 13 },
        uBumps: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 1)) },
        uCursor: { value: new THREE.Vector4(0, 0, 0.8, 0) }
    }
});

// mesh
terrain.mesh = new THREE.Mesh(terrain.geometry, terrain.material);
terrain.mesh.scale.set(20, 20, 20);

scene.add(terrain.mesh);

// Quality: the pixel ratio drops automatically when frames get too slow
const quality = {
    maxPixelRatio: Math.min(window.devicePixelRatio, isSmallScreen ? 1.5 : 2),
    minPixelRatio: 0.75,
    pixelRatio: 0,
    frameTimes: [],
    lastChange: 0
};
quality.pixelRatio = quality.maxPixelRatio;

const adaptQuality = (deltaTime, now) => {
    quality.frameTimes.push(deltaTime);

    // judge roughly once per second, whatever the frame rate
    const total = quality.frameTimes.reduce((sum, time) => sum + time, 0);
    if (total < 1) return;

    const average = total / quality.frameTimes.length;
    quality.frameTimes.length = 0;

    // leave some time between changes so the new resolution can settle
    if (now - quality.lastChange < 1.5) return;

    let pixelRatio = quality.pixelRatio;
    if (average > 1 / 45) pixelRatio = Math.max(quality.minPixelRatio, pixelRatio - 0.25);
    else if (average < 1 / 58) pixelRatio = Math.min(quality.maxPixelRatio, pixelRatio + 0.25);

    if (pixelRatio !== quality.pixelRatio) {
        quality.pixelRatio = pixelRatio;
        quality.lastChange = now;
        renderer.setPixelRatio(pixelRatio);
    }
};

// Renderer
let renderer = null;
try {
    renderer = new THREE.WebGLRenderer({
        canvas,
        // the shader already anti-aliases the lines, MSAA only helps on low density screens
        antialias: window.devicePixelRatio < 2,
        powerPreference: 'high-performance'
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setClearColor(0x070b14, 1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(quality.pixelRatio);
} catch (error) {
    // No WebGL: the page content still works, just without the terrain
    document.documentElement.classList.add('no-webgl');
    console.warn('WebGL is not available', error);
}

/**
 * Debug panel (add ?debug or #debug to the URL)
 */
// guify is only downloaded when the debug panel is requested
if (isDebug) import('guify').then(({ guify }) => {
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
});

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
 * Explore mode: orbit, pan, zoom, sculpt hills and drag them around
 */
const explore = {
    active: false,
    tool: 'orbit',
    hud: document.querySelector('#explore-hud'),
    hint: document.querySelector('#explore-hint'),
    enterButton: document.querySelector('#explore-enter'),
    // hills in terrain coordinates
    bumps: [],
    maxBumps: terrain.material.uniforms.uBumps.value.length,
    brushRadius: 0.9,
    hoveredBump: null,
    selectedBump: null,
    drag: null,
    cursor: { x: 0, z: 0, visible: 0, targetVisible: 0 },
    resetting: false,
    home: { position: new THREE.Vector3(), target: new THREE.Vector3() }
};

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const hints = isTouch ? {
    orbit: 'Drag to orbit · Two fingers to pan and pinch to zoom',
    pan: 'Drag to pan · Two fingers to pan and pinch to zoom',
    sculpt: 'Swipe up to raise a hill, down to dig a valley',
    move: 'Touch a hill and drag it around'
} : {
    orbit: 'Drag to orbit · Right-drag to pan · Scroll to zoom',
    pan: 'Drag to pan · Right-drag to orbit · Scroll to zoom',
    sculpt: 'Drag up to raise a hill, down to dig a valley · Right-drag to orbit',
    move: 'Select a hill and drag it around · Delete removes it · Right-drag to orbit'
};

const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 11;
controls.maxPolarAngle = Math.PI * 0.49;
controls.zoomSpeed = 0.8;
// grabbing the camera cancels a running "reset view"
controls.addEventListener('start', () => {
    explore.resetting = false;
});

const setTool = (tool) => {
    explore.tool = tool;
    document.documentElement.dataset.tool = tool;
    explore.hud.querySelectorAll('[data-tool]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    });
    explore.hint.textContent = hints[tool];

    const isBrush = tool === 'sculpt' || tool === 'move';
    controls.mouseButtons = {
        LEFT: isBrush ? -1 : tool === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: tool === 'orbit' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
    };
    controls.touches = {
        ONE: isBrush ? -1 : tool === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };

    if (!isBrush) explore.cursor.targetVisible = 0;
    if (tool !== 'move') explore.selectedBump = null;
};

const syncBumps = () => {
    const uniform = terrain.material.uniforms.uBumps.value;
    uniform.forEach((vector, index) => {
        const bump = explore.bumps[index];
        if (bump) vector.set(bump.x, bump.z, bump.height, bump.radius);
        else vector.set(0, 0, 0, 1);
    });
};

// Terrain coordinates under the pointer (ray against the ground plane)
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointerNdc = new THREE.Vector2();
const groundHit = new THREE.Vector3();

const pickTerrain = (event) => {
    pointerNdc.set((event.clientX / sizes.width) * 2 - 1, -(event.clientY / sizes.height) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(groundPlane, groundHit)) return null;
    if (Math.abs(groundHit.x) > 8 || Math.abs(groundHit.z) > 8) return null;

    // the vertex shader samples the terrain at (x, z - offset)
    return { x: groundHit.x, z: groundHit.z - terrain.material.uniforms.uOffset.value };
};

const findBump = (point) => {
    let closest = null;
    let closestDistance = Infinity;
    explore.bumps.forEach((bump) => {
        const distance = Math.hypot(bump.x - point.x, bump.z - point.z);
        if (distance < bump.radius && distance < closestDistance) {
            closest = bump;
            closestDistance = distance;
        }
    });
    return closest;
};

const isBrushPointer = (event) => (
    explore.active
    && (explore.tool === 'sculpt' || explore.tool === 'move')
    && (event.pointerType !== 'mouse' || event.button === 0)
    && event.isPrimary
);

canvas.addEventListener('pointerdown', (event) => {
    if (!isBrushPointer(event)) return;

    const point = pickTerrain(event);
    if (!point) return;

    if (explore.tool === 'sculpt') {
        // start a new hill (the oldest one makes room when all are used)
        const bump = { x: point.x, z: point.z, height: 0, radius: explore.brushRadius };
        if (explore.bumps.length >= explore.maxBumps) explore.bumps.shift();
        explore.bumps.push(bump);
        explore.drag = { bump, startY: event.clientY, startHeight: 0 };
    } else {
        const bump = findBump(point);
        explore.selectedBump = bump;
        if (!bump) return;
        explore.drag = { bump, offsetX: bump.x - point.x, offsetZ: bump.z - point.z };
        document.documentElement.dataset.dragging = '';
    }

    canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
    if (!explore.active) return;

    const isBrush = explore.tool === 'sculpt' || explore.tool === 'move';
    const point = isBrush ? pickTerrain(event) : null;
    const drag = explore.drag;

    if (drag && explore.tool === 'sculpt') {
        drag.bump.height = clamp(drag.startHeight + (drag.startY - event.clientY) * 0.012, -2.5, 2.5);
        syncBumps();
        return;
    }

    if (drag && explore.tool === 'move' && point) {
        drag.bump.x = point.x + drag.offsetX;
        drag.bump.z = point.z + drag.offsetZ;
        syncBumps();
        return;
    }

    // hover feedback
    if (point) {
        explore.cursor.x = point.x;
        explore.cursor.z = point.z;
        explore.hoveredBump = explore.tool === 'move' ? findBump(point) : null;
    }
    explore.cursor.targetVisible = point && (explore.tool === 'sculpt' || explore.hoveredBump || explore.selectedBump) ? 1 : 0;

    if (explore.hoveredBump) document.documentElement.dataset.hover = 'bump';
    else delete document.documentElement.dataset.hover;
});

const endDrag = () => {
    if (!explore.drag) return;

    // tiny drags in sculpt mode would leave invisible hills behind
    if (explore.tool === 'sculpt' && Math.abs(explore.drag.bump.height) < 0.05) {
        explore.bumps.splice(explore.bumps.indexOf(explore.drag.bump), 1);
        syncBumps();
    }
    explore.drag = null;
    delete document.documentElement.dataset.dragging;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const zoomBy = (factor) => {
    const offset = camera.position.clone().sub(controls.target);
    const distance = clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setLength(distance));
};

const resetView = () => {
    explore.resetting = true;
};

const clearBumps = () => {
    explore.bumps.length = 0;
    explore.selectedBump = null;
    explore.hoveredBump = null;
    syncBumps();
};

const toggleSettings = (force) => {
    const isOpen = document.documentElement.classList.toggle('show-settings', force);
    explore.hud.querySelector('[data-action="settings"]').setAttribute('aria-pressed', String(isOpen));
};

const enterExplore = () => {
    if (explore.active) return;
    explore.active = true;

    document.querySelector('#playground').scrollIntoView({ behavior: 'instant', block: 'start' });
    explore.scrollY = window.scrollY;
    document.documentElement.classList.add('is-exploring');
    explore.hud.hidden = false;

    // start from wherever the scroll camera currently is
    explore.home.position.copy(camera.position);
    explore.home.target.copy(scroll.current.target);
    controls.target.copy(scroll.current.target);
    controls.enabled = true;
    controls.update();

    setTool('orbit');
    explore.hud.querySelector('[data-tool="orbit"]').focus({ preventScroll: true });
};

const exitExplore = () => {
    if (!explore.active) return;
    explore.active = false;

    endDrag();
    controls.enabled = false;
    explore.cursor.targetVisible = 0;
    explore.selectedBump = null;
    toggleSettings(false);

    // ease back from the explored view to the scroll camera
    scroll.current.position.copy(camera.position);
    scroll.current.target.copy(controls.target);

    document.documentElement.classList.remove('is-exploring');
    delete document.documentElement.dataset.tool;
    delete document.documentElement.dataset.hover;
    explore.hud.hidden = true;
    // the scrollbar coming back reflows the page, put it back where it was
    window.scrollTo({ top: explore.scrollY, behavior: 'instant' });
    explore.enterButton.focus({ preventScroll: true });
};

explore.enterButton.addEventListener('click', enterExplore);

explore.hud.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.tool) setTool(button.dataset.tool);

    switch (button.dataset.action) {
        case 'zoom-in': zoomBy(0.8); break;
        case 'zoom-out': zoomBy(1.25); break;
        case 'reset-view': resetView(); break;
        case 'clear': clearBumps(); break;
        case 'settings': toggleSettings(); break;
        case 'exit': exitExplore(); break;
        default: break;
    }
});

window.addEventListener('keydown', (event) => {
    if (!explore.active || event.ctrlKey || event.metaKey || event.altKey) return;

    const tools = { 1: 'orbit', 2: 'pan', 3: 'sculpt', 4: 'move' };
    if (tools[event.key]) {
        setTool(tools[event.key]);
    } else if (event.key === 'Escape') {
        if (document.documentElement.classList.contains('show-settings')) toggleSettings(false);
        else exitExplore();
    } else if (event.key === '+' || event.key === '=') {
        zoomBy(0.8);
    } else if (event.key === '-') {
        zoomBy(1.25);
    } else if (event.key === 'r' || event.key === 'R') {
        resetView();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && explore.selectedBump) {
        explore.bumps.splice(explore.bumps.indexOf(explore.selectedBump), 1);
        explore.selectedBump = null;
        syncBumps();
    } else {
        return;
    }
    event.preventDefault();
});

const updateExplore = (deltaTime) => {
    // fly back to the starting view
    if (explore.resetting) {
        const ease = 1 - Math.exp(-deltaTime * 6);
        camera.position.lerp(explore.home.position, ease);
        controls.target.lerp(explore.home.target, ease);
        if (camera.position.distanceTo(explore.home.position) < 0.01) explore.resetting = false;
    }
    controls.update();
};

// Brush / selection ring
const updateCursor = (deltaTime) => {
    const cursor = explore.cursor;
    const focus = explore.drag?.bump || explore.selectedBump || (explore.tool === 'move' ? explore.hoveredBump : null);
    const uniform = terrain.material.uniforms.uCursor.value;

    if (focus) {
        uniform.x = focus.x;
        uniform.y = focus.z;
        uniform.z = focus.radius;
        cursor.targetVisible = explore.active ? 1 : 0;
    } else {
        uniform.x = cursor.x;
        uniform.y = cursor.z;
        uniform.z = explore.brushRadius;
    }

    cursor.visible = lerp(cursor.visible, cursor.targetVisible, 1 - Math.exp(-deltaTime * 12));
    uniform.w = cursor.visible;
};

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
        renderer.setPixelRatio(quality.pixelRatio);
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
    // the terrain holds still while exploring so sculpted hills stay under the pointer
    if (!explore.active) uniforms.uOffset.value += deltaTime * (0.12 + scroll.velocity * 0.0005) * motionScale;

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

    if (explore.active) {
        updateExplore(deltaTime);
    } else {
        camera.position.copy(current.position);
        camera.position.x += pointer.easedX * 0.35 * parallax;
        camera.position.y -= pointer.easedY * 0.15 * parallax;
        camera.lookAt(current.target);
    }
    updateCursor(deltaTime);

    // Render
    if (renderer) {
        renderer.render(scene, camera);
        adaptQuality(deltaTime, clock.elapsedTime);
    }

    // Keep looping
    window.requestAnimationFrame(loop);
};
loop();
