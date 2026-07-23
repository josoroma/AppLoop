uniform float uTime;
uniform float uProgress;
uniform vec2 uMouse;
uniform float uMouseDown;
uniform vec3 uFormations[8];
uniform float uFormationMorph;
uniform float uParticleCount;
uniform float uTransitionProgress;

attribute vec3 position;
attribute vec3 offset;
attribute float size;
attribute float life;
attribute float formationIndex;
attribute vec3 velocity;
attribute float phase;
attribute float noiseSeed;
attribute vec3 baseColor;

varying vec3 vColor;
varying float vSize;
varying float vLife;
varying float vFormationIndex;
varying vec3 vPosition;
varying vec3 vVelocity;
varying float vPhase;
varying float vNoiseSeed;
varying vec3 vOffset;

vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                       dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), f.x),
                   mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                       dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), f.x), f.y),
               mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                       dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), f.x),
                   mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                       dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

vec3 fbm3(vec3 p, int octaves) {
    vec3 value = vec3(0.0);
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        value += amplitude * vec3(noise(p), noise(p + 17.0), noise(p + 43.0));
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

vec3 formationSphere(vec3 pos, float progress, float phase) {
    float r = 2.5 + progress * 3.0;
    float theta = pos.x * 6.28318 + phase;
    float phi = pos.y * 3.14159 + phase * 0.5;
    return vec3(
        r * sin(phi) * cos(theta),
        r * cos(phi),
        r * sin(phi) * sin(theta)
    );
}

vec3 formationTorus(vec3 pos, float progress, float phase) {
    float R = 3.0 + progress * 2.0;
    float r = 1.0 + progress * 0.5;
    float u = pos.x * 6.28318 + phase;
    float v = pos.y * 6.28318 + phase * 0.7;
    return vec3(
        (R + r * cos(v)) * cos(u),
        r * sin(v),
        (R + r * cos(v)) * sin(u)
    );
}

vec3 formationWave(vec3 pos, float progress, float phase) {
    float amp = 2.0 + progress * 3.0;
    float freq = 1.5 + progress;
    float x = (pos.x - 0.5) * 20.0;
    float z = (pos.y - 0.5) * 20.0;
    float y = sin(x * freq + uTime * 2.0 + phase) * cos(z * freq + uTime * 1.5 + phase) * amp;
    y += sin(x * 0.5 + uTime + phase) * cos(z * 0.3 + uTime * 0.7 + phase) * amp * 0.5;
    return vec3(x, y, z);
}

vec3 formationSpiral(vec3 pos, float progress, float phase) {
    float turns = 3.0 + progress * 4.0;
    float height = 8.0 + progress * 12.0;
    float t = pos.y * turns * 6.28318 + phase;
    float r = (pos.x + progress * 0.5) * 3.0;
    return vec3(
        r * cos(t),
        (pos.y - 0.5) * height,
        r * sin(t)
    );
}

vec3 formationTunnel(vec3 pos, float progress, float phase) {
    float segments = 8.0 + progress * 12.0;
    float segmentLength = 3.0;
    float t = pos.y * segments;
    float segment = floor(t);
    float localT = fract(t);
    float angle = segment * 0.785398 + phase;
    float radius = 2.0 + progress * 1.5 + sin(segment * 1.5 + uTime * 0.5) * 0.5;
    float u = pos.x * 6.28318;
    return vec3(
        radius * cos(u) * cos(angle) - radius * sin(u) * sin(angle),
        radius * sin(u),
        segment * segmentLength + localT * segmentLength
    );
}

vec3 formationField(vec3 pos, float progress, float phase) {
    vec3 p = pos * 10.0;
    vec3 force = fbm3(p + uTime * 0.1 + phase, 4);
    return pos * (5.0 + progress * 10.0) + force * (3.0 + progress * 5.0);
}

vec3 formationBurst(vec3 pos, float progress, float phase) {
    float angle = pos.x * 6.28318 * 3.0 + phase;
    float radius = pos.y * (2.0 + progress * 8.0);
    float z = (pos.z - 0.5) * 4.0 * (1.0 - progress);
    return vec3(
        radius * cos(angle) + sin(uTime + phase) * 0.5,
        radius * sin(angle) + cos(uTime * 0.7 + phase) * 0.5,
        z
    );
}

vec3 formationOrganic(vec3 pos, float progress, float phase) {
    float n = noise(pos * 3.0 + uTime * 0.15 + phase);
    float n2 = noise(pos * 5.0 - uTime * 0.1 + phase * 1.3);
    float n3 = noise(pos * 8.0 + uTime * 0.05 + phase * 0.7);
    vec3 organic = pos * (4.0 + progress * 6.0);
    organic.x += (n - 0.5) * (2.0 + progress * 4.0);
    organic.y += (n2 - 0.5) * (2.0 + progress * 4.0);
    organic.z += (n3 - 0.5) * (2.0 + progress * 4.0);
    return organic;
}

vec3 getFormationPosition(vec3 pos, float formationIdx, float progress, float phase) {
    if (formationIdx < 1.0) return formationSphere(pos, progress, phase);
    else if (formationIdx < 2.0) return formationTorus(pos, progress, phase);
    else if (formationIdx < 3.0) return formationWave(pos, progress, phase);
    else if (formationIdx < 4.0) return formationSpiral(pos, progress, phase);
    else if (formationIdx < 5.0) return formationTunnel(pos, progress, phase);
    else if (formationIdx < 6.0) return formationField(pos, progress, phase);
    else if (formationIdx < 7.0) return formationBurst(pos, progress, phase);
    else return formationOrganic(pos, progress, phase);
}

vec3 getFormationVelocity(vec3 pos, float formationIdx, float progress, float phase) {
    float eps = 0.01;
    vec3 p = getFormationPosition(pos, formationIdx, progress, phase);
    vec3 px = getFormationPosition(pos + vec3(eps, 0, 0), formationIdx, progress, phase);
    vec3 py = getFormationPosition(pos + vec3(0, eps, 0), formationIdx, progress, phase);
    vec3 pz = getFormationPosition(pos + vec3(0, 0, eps), formationIdx, progress, phase);
    return vec3(px.x - p.x, py.y - p.y, pz.z - p.z) * 100.0;
}

void main() {
    vColor = baseColor;
    vSize = size;
    vLife = life;
    vFormationIndex = formationIndex;
    vPhase = phase;
    vNoiseSeed = noiseSeed;
    vOffset = offset;
    vVelocity = velocity;

    vec3 targetPos = getFormationPosition(position, formationIndex, uProgress, phase);
    vec3 targetVel = getFormationVelocity(position, formationIndex, uProgress, phase);

    float formationNext = formationIndex + 1.0;
    if (formationNext >= 8.0) formationNext = 0.0;
    vec3 nextPos = getFormationPosition(position, formationNext, uProgress, phase);
    vec3 nextVel = getFormationVelocity(position, formationNext, uProgress, phase);

    vec3 morphedPos = mix(targetPos, nextPos, uFormationMorph);
    vec3 morphedVel = mix(targetVel, nextVel, uFormationMorph);

    vec3 noiseForce = fbm3(morphedPos * 0.1 + uTime * 0.05 + noiseSeed, 3);
    morphedPos += noiseForce * (0.5 + uProgress * 1.5);

    float lifeFactor = smoothstep(0.0, 1.0, life);
    float sizeMul = mix(0.1, 1.0, lifeFactor) * (0.5 + 0.5 * sin(uTime * 3.0 + phase));

    vec2 mouseVec = uMouse * 2.0 - 1.0;
    vec3 mouseWorld = vec3(mouseVec.x * 15.0, mouseVec.y * -10.0, 0.0);
    float mouseDist = distance(morphedPos.xy, mouseWorld.xy);
    float mouseInfluence = smoothstep(20.0, 0.0, mouseDist) * (1.0 + uMouseDown * 3.0);
    vec3 mouseDir = normalize(morphedPos - mouseWorld);
    morphedPos += mouseDir * mouseInfluence * (2.0 + life * 3.0);
    
    float shockwave = uMouseDown * smoothstep(0.0, 15.0, 15.0 - mouseDist) * (1.0 - uTime * 0.1);
    morphedPos += mouseDir * shockwave * 5.0 * (1.0 - lifeFactor);

    vPosition = morphedPos;
    vSize *= sizeMul;

    vec4 mvPosition = modelViewMatrix * vec4(morphedPos, 1.0);
    gl_PointSize = vSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}