varying vec2 uvPos;
uniform sampler2D buffer;
uniform mat4 cameraMatrix;
uniform mat4 worldMatrix;
uniform vec3 realCameraPosition;

float modulo(float a,float b) {
    float m = floor(a / b) * b;
    return a - m;
}

float sdf2(vec3 point) {
    vec3 sphereCenter = vec3(150, 150, 150);
    float grid = 300.0;
    vec3 tmp = vec3(modulo(point.x, grid), modulo(point.y, grid), modulo(point.z, grid));
    return distance(tmp, sphereCenter) - 40.0;
}

float sdf(vec3 point) {
    return sdf2(point);
}

float march(vec3 startPoint, vec3 direction) {
    float dist = sdf(startPoint);
    vec3 point = startPoint;
    int i = 0;
    int max = 50;
    while (dist > 0.0001 && i < max) {
        i++;
        point += dist * direction;
        dist = sdf(point);
    }
    return 1.0 - (float(i) / float(max));
}

void main() {
    vec4 clipPos = vec4(uvPos.x - 0.5, uvPos.y - 0.5, 0.0, 1.0);
    vec4 viewPos = cameraMatrix * clipPos;
    viewPos /= viewPos.w;
    vec3 worldPos = (worldMatrix * viewPos).xyz;

    vec3 ray = normalize(worldPos - realCameraPosition);
    float result = march(realCameraPosition, ray);
    result *= result;
    gl_FragColor = vec4(0.0, result, result / 2.0, 1.0);

	#include <colorspace_fragment>
}
