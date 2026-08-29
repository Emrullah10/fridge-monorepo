// Atmosphere lifecycle glue - pause via IntersectionObserver AND
// visibilitychange (either alone misses a case: IO misses tab-switch while
// the canvas stays in-viewport, visibilitychange misses scrolling the
// canvas off-screen within a visible tab). WEBGL_lose_context runs inside a
// finally block on destroy so a thrown teardown never leaks the context.
let instance = null;
let observer = null;
let visibilityHandler = null;
let canvasRef = null;

function markReady(canvas) {
  canvas.setAttribute('data-ready', 'true');
}

/**
 * `gl.js` is dynamically imported here (not statically at module top) so
 * the `lite` tier - which never calls mountAtmosphere - genuinely never
 * pulls the shader source strings into its bundle graph either.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<{ setUniform: (name: string, value: number) => void, destroy: () => void }>}
 */
export async function mountAtmosphere(canvas) {
  if (instance) return instance;

  const { createAtmosphere } = await import('./gl.js');
  canvasRef = canvas;
  const atmosphere = createAtmosphere({ canvas });
  atmosphere.start();
  markReady(canvas);

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) atmosphere.start();
        else atmosphere.stop();
      }
    },
    { threshold: 0 }
  );
  observer.observe(canvas);

  visibilityHandler = () => {
    if (document.hidden) atmosphere.stop();
    else atmosphere.start();
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  function destroy() {
    try {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }
    } finally {
      atmosphere.destroy();
    }
    instance = null;
    canvasRef = null;
  }

  instance = { setUniform: atmosphere.setUniform, destroy };
  return instance;
}

export function getAtmosphere() {
  return instance;
}

export function getAtmosphereCanvas() {
  return canvasRef;
}
