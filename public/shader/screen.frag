varying vec2 uvPos;
uniform sampler2D buffer;
uniform mat4 cameraMatrix;
uniform mat4 worldMatrix;
uniform vec3 realCameraPosition;

int MAX_ITERATIONS = 10;
float POWER = 8.0;

// Adapted from https://github.com/benmandrew/Fractal3D/blob/master/Fractal/fragment.shader
float mandelbulbSDF(vec3 p) {
	vec3 z = p;
	float dr = 1.0;
	float r = 0.0;
	for (int i = 0; i < MAX_ITERATIONS; i++) {
		r = length(z);
		if (r > 10.0) break;

		float theta = acos(z.z / r);
		float phi = atan(z.y, z.x);
		dr = pow(r, POWER - 1.0) * POWER * dr + 1.0;

		float zr = pow(r, POWER);
		theta = theta * POWER;
		phi = phi * POWER;

		z = zr * vec3(
			sin(theta) * cos(phi),
			sin(phi) * sin(theta),
			cos(theta)
		);
		z += p;
	}
	return 0.5 * log(r) * r / dr;
}

float sdf(vec3 point) {
    return mandelbulbSDF(point);
}

float march(vec3 startPoint, vec3 direction) {
    float dist = sdf(startPoint);
    vec3 point = startPoint;
    int i = 0;
    int max = 50;
    float minDist = 0.0001;
    while (dist > minDist && i < max) {
        i++;
        point += dist * direction;
        dist = sdf(point);
        if (dist > 1.0) break;
    }
    if (dist > 1.0) {
        return 0.7;
    }
    return 1.0 - (float(i) / float(max) * 0.9);
}

void main() {
    vec4 clipPos = vec4(uvPos.x - 0.5, uvPos.y - 0.5, 0.0, 1.0);
    vec4 viewPos = cameraMatrix * clipPos;
    viewPos /= viewPos.w;
    vec3 worldPos = (worldMatrix * viewPos).xyz;

    vec3 ray = normalize(worldPos - realCameraPosition);
    float result = march(realCameraPosition, ray);
    result *= result;
    gl_FragColor = vec4(result, result, result, 1.0);

	#include <colorspace_fragment>
}
