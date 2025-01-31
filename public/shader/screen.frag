precision highp float;

varying vec2 uvPos;
uniform int frame;
uniform float waterLevel;
uniform mat4 cameraMatrix;
uniform mat4 worldMatrix;
uniform vec3 realCameraPosition;
//: Mandelbulb power, default 8.0, 1-20
uniform float Power;
//: Background color, default [0.0, 0.0, 0.0]
uniform vec3 bgColor;
//: Light color, default [1.0, 1.0, 0.8]
uniform vec3 lightColor;
//: Water color, default [0.3, 0.4, 0.8]
uniform vec3 waterColor;


int MAX_ITERATIONS = 10;
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
        dr = pow(r, Power - 1.0) * Power * dr + 1.0;

        float zr = pow(r, Power);
        theta = theta * Power;
        phi = phi * Power;

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
}

const float waterOffsetDist = 0.002;

float waterSurfaceOffset(vec3 point, int localFrame) {
    float r = length(point);
    float theta = acos(point.z / r);
    float phi = atan(point.y, point.x);
    float q = waterOffsetDist;
    float timeF = float(localFrame) / 50.0;
    float angleF = 50.0;

    return 
        q * sin(theta * angleF + timeF) + 
        q * sin(phi * angleF + timeF) +
        q * 0.0423 * sin(theta * angleF * 7.456 + timeF) + 
        q * 0.03243 * sin(phi * angleF * 9.2214 + timeF);
}

float sdfWater(vec3 point, int localFrame) {
    float offset = waterSurfaceOffset(point, localFrame);
    return length(point) - (waterLevel + offset);
}

vec4 march(vec3 startPoint, vec3 direction, out vec4 color, float tOffset, bool water) {
    vec3 point = startPoint;
    float t = 0.0;
    float l = length(point);
    const float skip = 2.2;
    if (l > skip) {
        t += l - skip;
    }

    point = startPoint + t * direction;
    float dist = sdf(point, color);
    int i = 0;
    int max = 200;
    float threshold = THRESHOLD_EPSILON * (t + tOffset);
    while (dist > threshold && i < max) {
        i++;
        t += dist;
        point = startPoint + t * direction;
        if (water) {
            dist = sdfWater(point, frame);
        } else {
            dist = sdf(point, color);
        }
        if (dist > 1.0) break;
        threshold = THRESHOLD_EPSILON * (t + tOffset);
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

vec3 calcNormalWater( in vec3 p, float t ) {
    float h = GRADIENT_EPSILON * t;
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy * sdfWater( p + k.xyy*h, frame ) + 
                      k.yyx * sdfWater( p + k.yyx*h, frame ) + 
                      k.yxy * sdfWater( p + k.yxy*h, frame ) + 
                      k.xxx * sdfWater( p + k.xxx*h, frame ) );
}

vec3 getTargetColor(vec4 resultPos, vec4 color, vec3 normal, vec3 normalWater, vec3 light, bool hitsWater) {
    vec3 lightToPoint = resultPos.xyz - light;
    vec4 tmp;
    vec4 lightRayResult = march(light, normalize(lightToPoint), tmp, 0.0, false);
    bool shadow = distance(resultPos.xyz, lightRayResult.xyz) > 0.01;

    float trap0 = color.x;
    vec3 finalColors = vec3(
        0.9 * pow(trap0, 10.0) * 1.5 * smoothstep(0.0, 0.2, color.w),
        0.95 * mix(pow((1.0 - 0.3 * (smoothstep(0.0, 0.4, color.y))), 2.0), 0.8, pow(trap0, 10.0)),
        pow((1.0 - 0.28 * (smoothstep(0.0, 0.7, color.z))), 2.0)
    );
    if (resultPos.w == 0.0 && hitsWater) {
      finalColors = waterColor;
    }

    vec3 ambient = vec3(0.3);

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
    return clamp(final, 0.0, 1.0);
}

void main() {
    vec4 clipPos = vec4(uvPos.x - 0.5, uvPos.y - 0.5, 1.0, 1.0);
    vec4 color;
    vec3 worldPos = clipToWorld(clipPos);
    vec3 ray = normalize(worldPos - realCameraPosition);
    vec4 resultPosWater = march(realCameraPosition, ray, color, 0.0, true);
    vec4 resultPos = march(realCameraPosition, ray, color, 0.0, false);

    float t = distance(realCameraPosition.xyz, resultPos.xyz);
    float tWater = resultPosWater.w == 0.0 ? 100.0 : distance(realCameraPosition.xyz, resultPosWater.xyz);
    bool hitsWater = tWater < t;
    vec3 normalWater = calcNormalWater(resultPosWater.xyz, tWater);
    vec4 resultPosReflection = vec4(0.0);
    vec3 reflectedColor = vec3(0.0);
    float reflectionStrength = 0.0;

    vec3 light = clipToWorld(vec4(100.0, 100.0, -1.0, 1.0));
    bool waterInShadow = true;
    float foam = 0.0;

    if (hitsWater) {
        vec3 reflectedRay = normalize(reflect(ray, normalWater));
        resultPosReflection = march(resultPosWater.xyz, reflectedRay, color, t, false);
        if (resultPosReflection.w != 0.0) {
          float tReflection = distance(resultPosWater.xyz, resultPosReflection.xyz);
          vec3 resultPosReflectionNormal = calcNormal(resultPosReflection.xyz, t + tReflection);
          reflectedColor = getTargetColor(resultPosReflection, color, resultPosReflectionNormal, vec3(0.0), light, false);
        } else {
          reflectedColor = bgColor;
        }
        reflectionStrength = 1.0 - pow(abs(dot(ray, normalWater)), 0.5);

        vec3 lightToWaterSurface = resultPosWater.xyz - light;
        vec4 tmp;
        vec4 waterSurfaceLightRayResultA = march(light, normalize(lightToWaterSurface), tmp, 0.0, false);
        vec4 waterSurfaceLightRayResultB = march(light, normalize(lightToWaterSurface), tmp, 0.0, true);
        float tA = distance(light, waterSurfaceLightRayResultA.xyz);
        float tB = distance(light, waterSurfaceLightRayResultB.xyz);
        waterInShadow = tA < tB;

        ray = refract(ray, normalWater, 3.0 / 3.5);
        resultPos = march(resultPosWater.xyz, ray, color, t, false);
    } else {
        float waterDistMomentAgo = sdfWater(resultPos.xyz, frame - 50);
        foam = 1.0 - clamp(waterDistMomentAgo / (waterOffsetDist * 0.5), 0.0, 1.0);
    }

    vec3 normal = calcNormal(resultPos.xyz, t);
    float waterDepth = max(0.0, t - tWater);
    if (resultPos.w == 0.0 && !hitsWater) {
        gl_FragColor = vec4(bgColor, 1.0);
        return;
    }

    float ambientWater = hitsWater ? 0.3 : 0.0;
    float specularWater = hitsWater && !waterInShadow
        ? pow(max(dot(normalWater, normalize(light)), 0.0), 64.0) * 0.8
        : 0.0;

    vec3 final = getTargetColor(resultPos, color, normal, normalWater, light, hitsWater);

    final = mix(final, final * 0.5, clamp(waterDepth / 0.4, 0.0, 1.0));
    final = mix(final, waterColor, ambientWater);
    final = mix(final, reflectedColor, reflectionStrength * 0.5);
    final = mix(final, clamp(final * 7.0, 0.0, 1.0), foam * 0.35);
    final = mix(final, lightColor, specularWater);

    final *= 1.3;
    final = pow(final, vec3(1.5));

    gl_FragColor = vec4(final, 1.0);
}
