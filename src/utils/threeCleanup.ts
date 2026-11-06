import * as THREE from 'three';

/**
 * Recursively disposes of a material and its associated textures.
 */
export function disposeMaterial(material: THREE.Material | THREE.Material[] | undefined | null): void {
  if (!material) return;

  const materials = Array.isArray(material) ? material : [material];

  materials.forEach((mat) => {
    if (!mat) return;

    // Dispose all texture properties attached to the material
    Object.keys(mat).forEach((key) => {
      const prop = (mat as Record<string, any>)[key];
      if (prop && typeof prop === 'object') {
        if (typeof prop.dispose === 'function' && (prop.isTexture || prop.image || key.toLowerCase().includes('map'))) {
          try {
            prop.dispose();
          } catch {
            // Ignore already disposed texture errors
          }
        }
      }
    });

    try {
      mat.dispose();
    } catch {
      // Ignore already disposed material errors
    }
  });
}

/**
 * Deeply disposes a Three.js scene, traversing all descendant objects
 * to release geometries, materials, textures, and clears the scene graph.
 * If a WebGLRenderer is provided, disposes the renderer and forces WebGL context loss.
 */
export function disposeThreeScene(
  scene: THREE.Scene | null | undefined,
  renderer?: THREE.WebGLRenderer | null | undefined
): void {
  if (!scene) return;

  // 1. Traverse all scene objects and release GPU buffers
  scene.traverse((object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;

    // Dispose geometry
    if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
      try {
        mesh.geometry.dispose();
      } catch {
        // Ignore already disposed geometry errors
      }
    }

    // Dispose material and associated textures
    if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });

  // 2. Dispose environment and background textures if present
  if (scene.background && typeof (scene.background as any).dispose === 'function') {
    try {
      (scene.background as any).dispose();
    } catch {}
    scene.background = null;
  }

  if (scene.environment && typeof (scene.environment as any).dispose === 'function') {
    try {
      (scene.environment as any).dispose();
    } catch {}
    scene.environment = null;
  }

  // 3. Clear all scene children
  try {
    scene.clear();
  } catch {}

  // 4. Clean up renderer & WebGL context
  if (renderer) {
    try {
      renderer.dispose();
    } catch {}

    if (typeof (renderer as any).forceContextLoss === 'function') {
      try {
        (renderer as any).forceContextLoss();
      } catch {}
    }

    if (renderer.domElement && renderer.domElement.parentNode) {
      try {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      } catch {}
    }
  }
}
