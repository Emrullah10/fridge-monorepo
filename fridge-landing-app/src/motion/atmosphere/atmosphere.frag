#version 300 es
precision mediump float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_progress;   // 0..1 overall film scroll progress
uniform float u_sweep;      // 0..1 act1 scan sweep position
uniform float u_intensity;  // 0..1 act4 waste/warning intensity

// Cheap value noise - no texture lookups, single sine lattice, good enough
// for slow-moving fog bands at this resolution.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // Two slow-drifting fog layers.
  float t = u_time * 0.02;
  float n1 = noise(p * 1.6 + vec2(t, -t * 0.6));
  float n2 = noise(p * 2.8 - vec2(-t * 0.8, t * 0.4));
  float fog = mix(n1, n2, 0.5);

  // Base color track: key green -> freezer cyan (act 3) -> warning amber (act 4).
  vec3 keyGreen = vec3(0.204, 0.635, 0.412);
  vec3 freezerCyan = vec3(0.024, 0.714, 0.831);
  vec3 warningAmber = vec3(0.909, 0.639, 0.239);

  vec3 base = mix(keyGreen, freezerCyan, smoothstep(0.25, 0.6, u_progress));
  base = mix(base, warningAmber, u_intensity);

  // Act 1 scan sweep brightens a horizontal band that travels with u_sweep.
  float sweepBand = 1.0 - smoothstep(0.0, 0.18, abs(uv.y - u_sweep));
  float brightness = 0.16 + fog * 0.10 + sweepBand * 0.22;

  vec3 color = base * brightness;
  fragColor = vec4(color, brightness * 0.9);
}
