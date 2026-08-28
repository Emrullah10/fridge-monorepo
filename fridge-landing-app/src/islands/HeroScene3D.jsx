// Hero 3B sahnesinin AĞIR gövdesi (three.js + @react-three/fiber, ~220KB gzip).
// Bu dosya SADECE HeroScene.jsx'in dinamik import()'u ile, yükleme kapısından
// GEÇTİKTEN SONRA indirilir — mobil/reduced-motion/düşük donanım ziyaretçiler
// bu JS'i hiç indirmez (statik <script> importu değil, koşullu import()).
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

// @react-three/drei (RoundedBox/Cylinder) barrel importu tree-shake olmuyordu
// ve bundle'ı ~220KB gzip'e şişiriyordu (bütçe: 180KB) — ham three.js
// geometrileriyle aynı görsel his çok daha küçük payload ile elde edilir.
function FloatingProducts() {
  const group = useRef(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = state.clock.elapsedTime * 0.15;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.15;
  });

  // DESIGN_SPEC renkleri: primaryContainer #2E7D5B, storage-freezer #06B6D4
  const items = useMemo(
    () => [
      { pos: [-1.4, 0.4, 0], color: '#2E7D5B', kind: 'box' },
      { pos: [1.3, -0.3, 0.4], color: '#06B6D4', kind: 'cyl' },
      { pos: [0, 0.9, -0.6], color: '#096444', kind: 'box' },
      { pos: [-0.6, -0.8, 0.6], color: '#3B82F6', kind: 'cyl' },
      { pos: [1.5, 0.7, -0.3], color: '#B45309', kind: 'box' },
    ],
    []
  );

  return (
    <group ref={group}>
      {items.map((item, i) =>
        item.kind === 'box' ? (
          <mesh key={i} position={item.pos}>
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshStandardMaterial color={item.color} roughness={0.35} metalness={0.1} />
          </mesh>
        ) : (
          <mesh key={i} position={item.pos}>
            <cylinderGeometry args={[0.35, 0.35, 0.8, 24]} />
            <meshStandardMaterial color={item.color} roughness={0.3} metalness={0.15} />
          </mesh>
        )
      )}
    </group>
  );
}

function Scene() {
  // Environment preset (@react-three/drei) HDR/PMREM için ağır kod ekliyordu
  // (~230KB gzip, performans bütçesini aşıyordu) — birkaç yönlü ışıkla aynı
  // camsı/parlak his, çok daha küçük bundle ile elde edilir.
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 2]} intensity={1.6} color="#D0FFE3" />
      <directionalLight position={[-3, -2, -2]} intensity={0.6} color="#88D6AF" />
      <pointLight position={[0, 2, 3]} intensity={0.5} color="#ffffff" />
      <FloatingProducts />
    </>
  );
}

export default function HeroScene3D() {
  // Karar (poster mı 3B mi) çağıran HeroScene.jsx'te verildi — bu bileşen
  // yalnızca gerçekten mount edilmesi gerektiğinde import edilir. Dış sarmalayıcı
  // (role/aria-label) HeroScene.jsx'te — burada tekrar edilmez.
  return (
    <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
      <Scene />
    </Canvas>
  );
}
