import React, { useState, useEffect, useRef } from 'react';
import { motion, useSpring } from 'framer-motion';
import type { Product, StyleProps } from './types';

interface ImageTileProps {
  image: Product & { uniqueId: string };
  styleProps: StyleProps;
  isFocused: boolean;
  isHovered?: boolean;
  distanceFactor: number;
  onClick: (product: Product) => void;
  isInteracting: boolean;
  tileIndex?: number;
  onHover?: (vr: number, vc: number) => void;
}

const ImageTile: React.FC<ImageTileProps> = ({ image, styleProps, isFocused, isHovered, distanceFactor, onClick, isInteracting, tileIndex, onHover }) => {
  const { uniqueId, id, src, alt, name, price, vr, vc } = image as any;

  // Track mouse position for 3D effect
  const [mouse, setMouse] = useState<{x: number, y: number}>({x: 0, y: 0});
  const tileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouse({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Calculate 3D rotation based on mouse position
  let targetRotationX = 0;
  let targetRotationY = 0;
  if (!isHovered && tileRef.current) {
    const rect = tileRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxTilt = 18; // degrees, stronger effect
    const dx = mouse.x - centerX;
    const dy = mouse.y - centerY;
    targetRotationY = (dx / (rect.width / 2)) * maxTilt;
    targetRotationX = -(dy / (rect.height / 2)) * maxTilt;
    // Clamp
    targetRotationX = Math.max(-maxTilt, Math.min(maxTilt, targetRotationX));
    targetRotationY = Math.max(-maxTilt, Math.min(maxTilt, targetRotationY));
  }
  // If hovered, flatten the card
  if (isHovered) {
    targetRotationX = 0;
    targetRotationY = 0;
  }

  // Use Framer Motion springs for smooth, eased rotation
  const springConfig = { stiffness: 120, damping: 18, mass: 0.8 };
  const rotationX = useSpring(targetRotationX, springConfig);
  const rotationY = useSpring(targetRotationY, springConfig);

  // Calculate scale based only on distanceFactor
  const falloffScale = 0.75 - (distanceFactor * 0.7);
  const falloffOpacity = 1 - (distanceFactor * 0.9);

  // Compose full transform: rotation + scale (using spring values)
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  useEffect(() => {
    const unsubX = rotationX.onChange(setRotX);
    const unsubY = rotationY.onChange(setRotY);
    return () => { unsubX(); unsubY(); };
  }, [rotationX, rotationY]);
  const transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${isFocused ? 1.35 : falloffScale})`;

  // Style for static layout, boxShadow, 3D rotation, and scale/opacity
  const style = {
    left: `${styleProps.left}px`,
    top: `${styleProps.top}px`,
    width: `${styleProps.width}px`,
    height: `${styleProps.height}px`,
    boxShadow: isFocused
      ? '0 0 0 1px rgba(180,180,180,0.35), 0 0 1px 1px rgba(180,180,180,0.15)'
      : isHovered
        ? '0 0 0 3px rgba(200,200,200,0.25), 0 0 6px 2px rgba(200,200,200,0.10)'
        : undefined,
    zIndex: isFocused ? 20 : isHovered ? 15 : undefined,
    transform,
    opacity: isFocused ? 1 : falloffOpacity,
    willChange: 'transform, opacity, left, top, width, height, z-index',
  };

  const tileVariants = {
    initial: { 
        scale: falloffScale * 0.9,
        opacity: falloffOpacity * 0.7,
        zIndex: 1 
    },
    focused: { 
      scale: 1.25, 
      opacity: 1, 
      zIndex: 10, 
      transition: { type: 'spring', stiffness: 300, damping: 25 } 
    },
    normal: { 
      scale: falloffScale, 
      opacity: falloffOpacity, 
      zIndex: 1,
      transition: { type: 'spring', stiffness: 300, damping: 25 } 
    }
  };

  const tileInfoVariants = {
    hidden: { opacity: 0, y: 10, transition: { duration: 0.2 } },
    visible: { opacity: (1 - distanceFactor * 2), y: 0, transition: { duration: 0.3, delay: 0.15 } } 
  };
  
  const showOverlayInfo = !isFocused && distanceFactor < 0.3 && !isInteracting;

  return (
    <motion.div
      ref={tileRef}
      id={`tile-${uniqueId || id}`} 
      className={`image-tile${isFocused ? ' focused-indicator' : ''}`}
      style={style}
      role="button"
      aria-label={alt || name}
      onClick={() => onClick(image)} 
      tabIndex={0} 
      onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(image); }} 
      onMouseEnter={() => { if (onHover) onHover(vr, vc); }}
    >
      {typeof tileIndex === 'number' && (
        <div style={{
          position: 'absolute',
          top: 4,
          right: 8,
          background: 'rgba(255,255,255,0.0)',
          color: 'black',
          fontSize: '0.6em',
          padding: '2px 6px',
          borderRadius: '6px',
          zIndex: 100,
          opacity: 0.0,
          fontFamily: 'var(--tag-filter-serif-font)'
        }}>
          {name}<br />vr:{vr} vc:{vc}
        </div>
      )}
      <img src={src} alt={alt || name} draggable="false" />
      
      {!isFocused && ( // Render in-tile info only if NOT focused AND NOT INTERACTING
         <motion.div
            className="tile-product-info"
            variants={tileInfoVariants}
            animate={showOverlayInfo ? "visible" : "hidden"}
            initial="hidden"
            aria-hidden={isFocused || !showOverlayInfo}
          >
          <h3>{name}</h3>
          {price && <p className="tile-product-price">{price}</p>}
        </motion.div>
      )}
    </motion.div>
  );
};

export default ImageTile;