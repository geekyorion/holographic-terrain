uniform float uAlphaSteps;
uniform sampler2D uTexture;

varying float vElevation;

void main() {
    vec4 textureColor = texture2D(uTexture, vec2(0.0, vElevation * 30.0));

    // float elevation = vElevation + 0.5;

    // float alpha = mod(vElevation * 10.0, 1.0);
    // alpha = step(uAlphaSteps, alpha);
    // gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);

    gl_FragColor = textureColor;
}
