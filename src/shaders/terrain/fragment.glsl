varying float vElevation;

void main() {
    // float elevation = vElevation + 0.5;

    float alpha = mod(vElevation * 10.0, 1.0);
    alpha = step(0.95, alpha);

    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
}
