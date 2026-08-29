// Raw WebGL2 atmosphere shader - no library (OGL/three.js not needed for one
// fullscreen triangle + one fragment shader). Mounts only in the `full`
// motion tier; lite/still get the CSS gradient base in Atmosphere.astro and
// never download this module (see home.js act gating and Atmosphere.astro).
//
// Uniform bus: u_progress / u_sweep / u_intensity are pushed in from the
// GSAP film timeline's onUpdate callbacks (see src/scripts/home.js) - this
// keeps the shader reactive to the story, not decorative wallpaper.
import vertSrc from './atmosphere.vert?raw';
import fragSrc from './atmosphere.frag?raw';

const DPR_MAX = 1.5;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`atmosphere shader compile failed: ${info}`);
  }
  return shader;
}

function createProgram(gl, vertSource, fragSource) {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`atmosphere program link failed: ${info}`);
  }
  return program;
}

/**
 * @param {{ canvas: HTMLCanvasElement }} opts
 * @returns {{ setUniform: (name: string, value: number) => void, start: () => void, stop: () => void, destroy: () => void }}
 */
export function createAtmosphere({ canvas }) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) {
    return { setUniform() {}, start() {}, stop() {}, destroy() {} };
  }

  const program = createProgram(gl, vertSrc, fragSrc);
  gl.useProgram(program);

  const uniformLocations = {
    u_time: gl.getUniformLocation(program, 'u_time'),
    u_resolution: gl.getUniformLocation(program, 'u_resolution'),
    u_progress: gl.getUniformLocation(program, 'u_progress'),
    u_sweep: gl.getUniformLocation(program, 'u_sweep'),
    u_intensity: gl.getUniformLocation(program, 'u_intensity'),
  };

  const values = { u_progress: 0, u_sweep: 0, u_intensity: 0 };

  // No vertex buffer required - the vertex shader derives the fullscreen
  // triangle from gl_VertexID. A VAO is still bound so gl.drawArrays is valid
  // across drivers that require one even with no attributes.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let rafId = null;
  let running = false;
  let startTime = performance.now();
  let destroyed = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function frame(now) {
    if (!running) return;
    resize();
    gl.uniform1f(uniformLocations.u_time, (now - startTime) / 1000);
    gl.uniform2f(uniformLocations.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(uniformLocations.u_progress, values.u_progress);
    gl.uniform1f(uniformLocations.u_sweep, values.u_sweep);
    gl.uniform1f(uniformLocations.u_intensity, values.u_intensity);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || destroyed) return;
    running = true;
    startTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function setUniform(name, value) {
    if (name in values) values[name] = value;
  }

  function destroy() {
    stop();
    destroyed = true;
    try {
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
    } finally {
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }

  return { setUniform, start, stop, destroy };
}
