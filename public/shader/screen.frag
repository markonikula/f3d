precision highp float;

varying vec2 uvPos;
uniform mat4 cameraMatrix;
uniform mat4 worldMatrix;
uniform vec3 realCameraPosition;

int MAX_ITERATIONS = 10;
float POWER = 8.0;
float GRADIENT_EPSILON = 0.0001;
float THRESHOLD_EPSILON = 0.0001;

// Adapted from https://github.com/benmandrew/Fractal3D/blob/master/Fractal/fragment.shader
float mandelbulbSDF(vec3 p, out vec4 color) {
    vec3 z = p;
    float dr = 1.0;
    float r = 0.0;
    float minL = 10.0;
    float minX = 10.0;
    float minY = 10.0;
    float minZ = 10.0;
    for (int i = 0; i < MAX_ITERATIONS; i++) {
        r = length(z);
        if (r > 2.0) break;

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

        minL = min(minL, length(z));
        minX = min(minX, length(vec3(z.x, z.y, 0.0)));
        minY = min(minY, length(vec3(z.y, z.z, 0.0)));
        minZ = min(minZ, length(vec3(z.x, z.z, 0.0)));
    }
    color = vec4(minL, minX, minY, minZ);
    return 0.5 * log(r) * r / dr;
}

float sdf(vec3 point, out vec4 color) {
    return mandelbulbSDF(point, color);
    //return length(point) - 1.0;
}

vec4 march(vec3 startPoint, vec3 direction, out vec4 color) {
    vec3 point = startPoint;
    float t = 0.0;
    float l = length(point);
    const float skip = 1.2;
    if (l > skip) {
        t += l - skip;
    }

    point = startPoint + t * direction;
    float dist = sdf(point, color);
    int i = 0;
    int max = 200;
    float threshold = THRESHOLD_EPSILON * t;
    while (dist > threshold && i < max) {
        i++;
        t += dist;
        point = startPoint + t * direction;
        dist = sdf(point, color);
        if (dist > 1.0) break;
        threshold = THRESHOLD_EPSILON * t;
    }
    if (dist > 1.0) {
        return vec4(0.0, 0.0, 0.0, 0.0);
    }
    return vec4(point.xyz, float(i) / float(max));
}

vec3 clipToWorld(vec4 clipPos) {
    vec4 viewPos = cameraMatrix * clipPos;
    viewPos /= viewPos.w;
    return (worldMatrix * viewPos).xyz;
}

vec4 marchClipPos(vec4 clipPos, out vec4 color) {
    vec3 worldPos = clipToWorld(clipPos);
    vec3 ray = normalize(worldPos - realCameraPosition);
    return march(realCameraPosition, ray, color);
}

// Adapted from https://iquilezles.org/articles/normalsSDF/
vec3 calcNormal( in vec3 p, float t ) {
    float h = GRADIENT_EPSILON * t;
    const vec2 k = vec2(1,-1);
    vec4 tmpColor;
    return normalize( k.xyy * sdf( p + k.xyy*h, tmpColor ) + 
                      k.yyx * sdf( p + k.yyx*h, tmpColor ) + 
                      k.yxy * sdf( p + k.yxy*h, tmpColor ) + 
                      k.xxx * sdf( p + k.xxx*h, tmpColor ) );
}

void main() {
    vec4 clipPos = vec4(uvPos.x - 0.5, uvPos.y - 0.5, 1.0, 1.0);
    vec4 color;
    vec4 resultPos = marchClipPos(clipPos, color);
    if (resultPos.w == 0.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    float t = distance(realCameraPosition.xyz, resultPos.xyz);
    vec3 normal = calcNormal(resultPos.xyz, t);

    vec3 lightColor = vec3(1.0, 1.0, 0.8);
    vec3 light = clipToWorld(vec4(100.0, 100.0, -1.0, 1.0));
    vec3 lightToPoint = resultPos.xyz - light;
    vec4 tmp;
    vec4 lightRayResult = march(light, normalize(lightToPoint), tmp);
    bool shadow = distance(resultPos.xyz, lightRayResult.xyz) > 0.01;

    float trap0 = color.x;
    vec3 finalColors = vec3(
        0.9 * pow(trap0, 10.0) * 1.5 * smoothstep(0.0, 0.2, color.w),
        0.95 * mix(pow((1.0 - 0.3 * (smoothstep(0.0, 0.4, color.y))), 2.0), 0.8, pow(trap0, 10.0)),
        pow((1.0 - 0.28 * (smoothstep(0.0, 0.7, color.z))), 2.0)
    );

    vec3 ambient = vec3(0.3);

    float specularStrength = 0.5;
    float specularStrength = 0.5 * pow(trap0, 10.0);
    float specularFactor = pow(max(dot(normal, normalize(light)), 0.0), 32.0);
    vec3 specular = shadow ? vec3(0.0) : specularFactor * specularStrength * lightColor;

    float occlusion = 1.0 - smoothstep(0.1, 0.5, resultPos.w);
    occlusion = pow(occlusion, 3.0);
    occlusion *= shadow ? 0.5 : 1.0;
    occlusion *= 1.9;

    float diffuseStrength = 0.3;
    float diffuseFactor = max(dot(normal, normalize(-light)), 0.0);
    vec3 diffuse = diffuseFactor * diffuseStrength * lightColor;
    vec3 final = (ambient + diffuse + specular) * occlusion * finalColors;

    final *= 1.3;
    final = pow(final, vec3(1.5));

    gl_FragColor = vec4(final, 1.0);
}
