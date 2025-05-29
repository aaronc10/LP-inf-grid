import React from 'react';
import { motion } from 'framer-motion';
import type { Product, StyleProps } from './types';

interface ImageTileProps {
  image: Product & { uniqueId: string };
  styleProps: StyleProps;
  isFocused: boolean;
  distanceFactor: number;
  onClick: (product: Product) => void;
  isInteracting: boolean;
  tileIndex?: number;
}

const ImageTile: React.FC<ImageTileProps> = ({ image, styleProps, isFocused, distanceFactor, onClick, isInteracting, tileIndex }) => {
  const { uniqueId, id, src, alt, name, price, vr, vc } = image as any;

  const style = {
    left: `${styleProps.left}px`,
    top: `${styleProps.top}px`,
    width: `${styleProps.width}px`,
    height: `${styleProps.height}px`,
    boxShadow: isFocused ? '0 0 0 6px rgba(0,255,0,0.7), 0 0 16px 8px rgba(0,255,0,0.3)' : undefined,
    zIndex: isFocused ? 20 : undefined,
  };

  const falloffScale = 1 - (distanceFactor * 0.9); // Increased multiplier for more space
  const falloffOpacity = 1 - (distanceFactor * 0.4);

  const tileVariants = {
    initial: { 
        scale: falloffScale * 0.9,
        opacity: falloffOpacity * 0.7,
        zIndex: 1 
    },
    focused: { 
      scale: 1.35, 
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
      id={`tile-${uniqueId || id}`} 
      className={`image-tile${isFocused ? ' focused-indicator' : ''}`}
      style={style} 
      variants={tileVariants}
      animate={isFocused ? "focused" : "normal"}
      initial="initial" 
      role="button"
      aria-label={alt || name}
      onClick={() => onClick(image)} 
      tabIndex={0} 
      onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(image); }} 
    >
      {typeof tileIndex === 'number' && (
        <div style={{
          position: 'absolute',
          top: 4,
          right: 8,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: '0.8em',
          padding: '2px 6px',
          borderRadius: '6px',
          zIndex: 100
        }}>
          #{tileIndex}<br />vr:{vr} vc:{vc}<br />d:{distanceFactor.toFixed(2)}
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