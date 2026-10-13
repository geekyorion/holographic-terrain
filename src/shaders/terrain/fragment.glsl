uniform float uTime;
uniform float uLinesCount;
uniform float uMiniLinesCount;
uniform float uMajorThickness;
uniform float uMiniThickness;
uniform float uMiniIntensity;
uniform vec3 uPalettePhase;
uniform float uFogNear;
uniform float uFogFar;
// explore mode brush / selection: xy = terrain position, z = radius, w = visibility
uniform vec4 uCursor;

varying float vElevation;
varying vec2 vTerrainPosition;
varying vec2 vUv;
varying float vDepth;

#define TAU 6.28318530718

// Cosine palette (Inigo Quilez) - uPalettePhase shifts the hues per section
vec3 palette(float t) {
    return 0.5 + 0.5 * cos(TAU * (t + uPalettePhase));
}

// Anti-aliased contour line: 1.0 on integer values of v, fading over ~thickness pixels
float contour(float v, float thickness) {
    float distanceToLine = abs(fract(v + 0.5) - 0.5);
    float pixelWidth = fwidth(v);
    return 1.0 - smoothstep(0.0, pixelWidth * thickness, distanceToLine);
}

void main() {
    // Major lines
    float majorValue = vElevation * uLinesCount;
    float major = contour(majorValue, uMajorThickness);
    float majorGlow = contour(majorValue, uMajorThickness * 4.0) * 0.25;

    // Mini lines sit between the major ones
    float miniValue = majorValue * uMiniLinesCount;
    float mini = contour(miniValue, uMiniThickness) * (1.0 - contour(majorValue, uMajorThickness * 2.0));

    // Which mini line this is (1..count-1) gives each one its own hue
    float miniIndex = mod(floor(miniValue + 0.5), uMiniLinesCount);

    // Flowing colors
    float majorHue = vTerrainPosition.x * 0.06 + vTerrainPosition.y * 0.04 + vElevation * 0.12 - uTime * 0.12;
    vec3 majorColor = palette(majorHue) * 1.35;

    float miniHue = miniIndex / uMiniLinesCount + vTerrainPosition.y * 0.08 + uTime * 0.2 + 0.35;
    vec3 miniColor = palette(miniHue) * 1.2;

    // Light pulses travelling along the mini lines
    float pulse = 0.5 + 0.5 * sin((vTerrainPosition.x - vTerrainPosition.y) * 2.2 - uTime * 2.5 + miniIndex * 1.7);
    pulse = mix(0.45, 1.3, pow(pulse, 3.0));

    vec3 color = majorColor * (major + majorGlow) + miniColor * mini * uMiniIntensity * pulse;
    float alpha = max(major + majorGlow, mini * uMiniIntensity * pulse);

    // Brush / selection ring drawn on the terrain surface
    float cursorDistance = distance(vTerrainPosition, uCursor.xy);
    float cursorRing = 1.0 - smoothstep(0.0, fwidth(cursorDistance) * 1.5, abs(cursorDistance - uCursor.z));
    float cursorFill = (1.0 - smoothstep(0.0, uCursor.z, cursorDistance)) * 0.12;
    float cursor = (cursorRing + cursorFill) * uCursor.w;
    color += vec3(0.85, 0.95, 1.0) * cursor;
    alpha = max(alpha, cursor);

    // Fade into the background at the plane edges and in the distance
    float edgeFade = 1.0 - smoothstep(0.32, 0.5, length(vUv - 0.5));
    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    float fade = edgeFade * (1.0 - fog);

    // additive blending: the alpha scales how much light each fragment adds
    gl_FragColor = vec4(color, alpha * fade);
}
