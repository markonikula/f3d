precision highp float;

varying vec2 uvPos;
uniform int frame;
uniform float waterLevel;
uniform mat4 cameraMatrix;
uniform mat4 worldMatrix;
uniform vec3 realCameraPosition;
//: Planet radius, default 1.0, 0.1-20
uniform float PlanetRadius;
//: Noise frequency 1, default 2, 0.1-10
uniform float NoiseFrequency1;
//: Noise amplitude 1, default 0.1, 0-0.2
uniform float NoiseAmplitude1;
//: Background color, default [0.0, 0.0, 0.0]
uniform vec3 bgColor;
//: Light color, default [1.0, 1.0, 0.8]
uniform vec3 lightColor;
//: Water color, default [0.1, 0.1, 0.7]
uniform vec3 waterColor;
//: Low altitude color, default [0.0, 0.8, 0.1]
uniform vec3 lowAltitudeColor;
//: Medium altitude color, default [0.6, 0.3, 0.15]
uniform vec3 mediumAltitudeColor;
//: High altitude color, default [0.9, 0.9, 0.9]
uniform vec3 highAltitudeColor;
//: Medium altitude threshold, default 0.25, 0-1
uniform float mediumAltitudeThreshold;
//: High altitude threshold, default 0.3, 0-1
uniform float highAltitudeThreshold;


// Utilities, copied/adapted from https://www.shadertoy.com/view/4ttSWf

//==========================================================================================
// hashes (low quality, do NOT use in production)
//==========================================================================================

float hash1( vec2 p ) {
    p  = 50.0*fract( p*0.3183099 );
    return fract( p.x*p.y*(p.x+p.y) );
}

float hash1( float n ) {
    return fract( n*17.0*fract( n*0.3183099 ) );
}

vec2 hash2( vec2 p )  {
    const vec2 k = vec2( 0.3183099, 0.3678794 );
    float n = 111.0*p.x + 113.0*p.y;
    return fract(n*fract(k*n));
}

//==========================================================================================
// noises
//==========================================================================================

// value noise, and its analytical derivatives
vec4 noised( in vec3 x ) {
    vec3 p = floor(x);
    vec3 w = fract(x);
    #if 1
    vec3 u = w*w*w*(w*(w*6.0-15.0)+10.0);
    vec3 du = 30.0*w*w*(w*(w-2.0)+1.0);
    #else
    vec3 u = w*w*(3.0-2.0*w);
    vec3 du = 6.0*w*(1.0-w);
    #endif

    float n = p.x + 317.0*p.y + 157.0*p.z;
    
    float a = hash1(n+0.0);
    float b = hash1(n+1.0);
    float c = hash1(n+317.0);
    float d = hash1(n+318.0);
    float e = hash1(n+157.0);
	float f = hash1(n+158.0);
    float g = hash1(n+474.0);
    float h = hash1(n+475.0);

    float k0 =   a;
    float k1 =   b - a;
    float k2 =   c - a;
    float k3 =   e - a;
    float k4 =   a - b - c + d;
    float k5 =   a - c - e + g;
    float k6 =   a - b - e + f;
    float k7 = - a + b + c - d + e - f - g + h;

    return vec4( -1.0+2.0*(k0 + k1*u.x + k2*u.y + k3*u.z + k4*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z), 
                      2.0* du * vec3( k1 + k4*u.y + k6*u.z + k7*u.y*u.z,
                                      k2 + k5*u.z + k4*u.x + k7*u.z*u.x,
                                      k3 + k6*u.x + k5*u.y + k7*u.x*u.y ) );
}

//==========================================================================================
// fbm constructions
//==========================================================================================

const mat3 m3  = mat3( 0.00,  0.80,  0.60,
                      -0.80,  0.36, -0.48,
                      -0.60, -0.48,  0.64 );
const mat3 m3i = mat3( 0.00, -0.80, -0.60,
                       0.80,  0.36, -0.48,
                       0.60, -0.48,  0.64 );
const mat2 m2 = mat2(  0.80,  0.60,
                      -0.60,  0.80 );
const mat2 m2i = mat2( 0.80, -0.60,
                       0.60,  0.80 );

vec4 fbmd( in vec3 x, float t )
{
    float f = 2.21; //1.92;
    float s = 0.5;
    float a = 0.0;
    float b = 0.5;
    vec3  d = vec3(0.0);
    mat3  m = mat3(1.0,0.0,0.0,
                   0.0,1.0,0.0,
                   0.0,0.0,1.0);
    int max = int(max(5.0, min(10.0, 5.0 / t)));
    for( int i=0; i<max; i++ )
    {
        vec4 n = noised(x);
        a += b*n.x;          // accumulate values		
        d += b*m*n.yzw;      // accumulate derivatives
        b *= s;
        x = f*m3*x;
        m = f*m3i*m;
    }
	return vec4( a, d );
}


// End of utilities ---------------------------

float calculateAltitude(float distToCenter) {
    return (distToCenter - PlanetRadius) / NoiseAmplitude1;
}

vec4 sdf(vec3 point, float t) {
    // First calculate distance to the closest ideal sphere surface point
    float d = length(point);

    float radius = PlanetRadius;
    // Then offset that based on the noise
    vec4 noise = fbmd(point * NoiseFrequency1, t);
    float noiseOffset = noise.x * NoiseAmplitude1;
    radius += noiseOffset;

    vec3 sphereNormal = normalize(point);
    float altitude = calculateAltitude(radius);

    if (noiseOffset < 0.0) {
        return vec4(d - PlanetRadius, sphereNormal);
    }
    vec3 normal = normalize(sphereNormal * PlanetRadius + noise.yzw * NoiseAmplitude1);
    return vec4(d - radius, normal);
}

vec4 march(vec3 startPoint, vec3 direction, float maxT) {
    vec3 point = startPoint;
    float t = 0.0;
    float l = length(point);
    const float skip = 2.2;
    if (l > skip) {
        t += l - skip;
    }

    point = startPoint + t * direction;
    vec4 distD = sdf(point, length(point) - PlanetRadius);
    int i = 0;
    int max = 200;
    while (t < maxT && i < max) {
        i++;
        t += distD.x * 0.25;
        point = startPoint + t * direction;
        distD = sdf(point, length(point) - PlanetRadius);
    }

    return vec4(t, distD.yzw);
}

vec3 clipToWorld(vec4 clipPos) {
    vec4 viewPos = cameraMatrix * clipPos;
    viewPos /= viewPos.w;
    return (worldMatrix * viewPos).xyz;
}

// Adapted from https://iquilezles.org/articles/normalsSDF/
/*
vec3 calcNormal( in vec3 p, float t ) {
    float h = GRADIENT_EPSILON * t;
    const vec2 k = vec2(1,-1);
    vec4 tmpColor;
    return normalize( k.xyy * sdf( p + k.xyy*h, tmpColor ) + 
                      k.yyx * sdf( p + k.yyx*h, tmpColor ) + 
                      k.yxy * sdf( p + k.yxy*h, tmpColor ) + 
                      k.xxx * sdf( p + k.xxx*h, tmpColor ) );
}
*/

const vec3 light = vec3(10.0, 10.0, 10.0);

float colorMixFactor(float threshold, float value) {
    return smoothstep(
        threshold, // * 0.99, 
        threshold, // * 1.01, 
        value
    );
}

void main() {
    vec4 clipPos = vec4(uvPos.x - 0.5, uvPos.y - 0.5, 1.0, 1.0);
    vec3 worldPos = clipToWorld(clipPos);

    vec3 ray = normalize(worldPos - realCameraPosition);
    float maxT = 100.0;
    vec4 result = march(realCameraPosition, ray, maxT);
    float t = result.x;
    if (t >= maxT) {
        gl_FragColor = vec4(bgColor, 1.0);
        return;
    }

    vec3 normal = result.yzw;
    float shade = dot(normal, normalize(light)) * 0.5 + 0.5;

    vec3 resultPos = realCameraPosition + t * ray;
    float altitude = calculateAltitude(length(resultPos));
    vec3 color = waterColor;

    if (altitude > 0.0001) {
        float mediumAltitudeFactor = colorMixFactor(mediumAltitudeThreshold, altitude);
        color = mix(lowAltitudeColor, mediumAltitudeColor, mediumAltitudeFactor);
        float highAltitudeFactor = colorMixFactor(highAltitudeThreshold, altitude);
        color = mix(color, highAltitudeColor, highAltitudeFactor);
    }

    vec3 final = color * shade;

    final = pow(final, vec3(1.5));

    gl_FragColor = vec4(final, 1.0);
}
