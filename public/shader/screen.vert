varying vec2 uvPos;

void main() {
    uvPos = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
