import React, { useState, useRef, useCallback, useEffect } from 'react';
import gsap from 'gsap';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
gsap.registerPlugin(InertiaPlugin);
// import { motion, useMotionValue, animate, PanInfo } from 'framer-motion';
import ImageTile from './ImageTile';
import type { Product, StyleProps, VirtualCell, ImageGridProps } from './types';

// DEBUG
const debugCenterDot = document.createElement('div');
debugCenterDot.id = 'debug-center-dot';
debugCenterDot.style.position = 'fixed';
debugCenterDot.style.left = '50%';
debugCenterDot.style.top = '50%';
debugCenterDot.style.width = '300px';
debugCenterDot.style.height = '350px';
debugCenterDot.style.backgroundColor = 'transparent';
debugCenterDot.style.borderRadius = '0%';
debugCenterDot.style.border = '1px solid red';
debugCenterDot.style.zIndex = '9999';
debugCenterDot.style.transform = 'translate(-50%, -50%)';
debugCenterDot.style.pointerEvents = 'none';
document.body.appendChild(debugCenterDot);

const MIN_SPACING_DESKTOP = 30; 
const MAX_SPACING_DESKTOP = 70;
const MIN_SPACING_MOBILE = 15;
const MAX_SPACING_MOBILE = 25;

const BASE_ASPECT_RATIO = 3 / 4; 
const RENDER_BUFFER_FACTOR = 0.8; 
const MAX_RANDOM_OFFSET_FACTOR = 0.2; 

interface TileData extends Product {
  uniqueId: string;
  vr: number;
  vc: number;
  styleProps: StyleProps;
  isFocused: boolean;
  distanceFactor: number;
  key: string;
  isInteracting: boolean;
}

const ImageGrid: React.FC<ImageGridProps> = ({ 
    images, 
    onFocusedProductChange, 
    onIsSettledChange, 
    onProductImageClick,
    onInteractingChange,
    isInteracting
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<Map<string, TileData>>(new Map());

  const panX = useRef(0);
  const panY = useRef(0);
  const rotateX = useRef(0);
  const rotateY = useRef(0);

  const [layoutConfig, setLayoutConfig] = useState({
    imageWidth: 0,
    imageHeight: 0,
    spacing: 30,
    numColsEffective: 3,
    tileAndSpacingWidth: 0,
    tileAndSpacingHeight: 0,
  });

  const lastFocusedVirtualCellRef = useRef<VirtualCell | null>(null); 
  // isUserInteractingOrSnapping is now primarily for onIsSettledChange, 
  // while App.jsx's isInteracting handles broader UI state.
  const [isUserInteractingOrSnappingLocal, setIsUserInteractingOrSnappingLocal] = useState(false);

  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const lastMoveTime = useRef(Date.now());

  useEffect(() => {
    if (onIsSettledChange) {
      onIsSettledChange(!isUserInteractingOrSnappingLocal);
    }
  }, [isUserInteractingOrSnappingLocal, onIsSettledChange]);

  const mapVirtualCellToImageIndex = ({vr, vc}: {vr: number, vc: number}, imageArray: Product[], numColsForPattern: number) => {
    if (imageArray.length === 0) return 0;
    const safeNumCols = Math.max(1, numColsForPattern);
    const intVr = Math.floor(vr);
    const intVc = Math.floor(vc);
    const flatIndex = intVr * safeNumCols + intVc;
    return ((flatIndex % imageArray.length) + imageArray.length) % imageArray.length;
  };

  const calculateLayoutConstants = useCallback(() => {
    if (!viewportRef.current || images.length === 0) return {
        imageWidth: 0, imageHeight: 0, spacing: 0, numColsEffective: 0, tileAndSpacingWidth: 0, tileAndSpacingHeight: 0
    };

    const viewportWidth = viewportRef.current.offsetWidth;
    
    const isSmallMobile = viewportWidth < 480;
    const isMobile = viewportWidth < 768;
    
    let targetCols;
    if (isSmallMobile) {
        targetCols = 3; 
    } else if (isMobile) {
        targetCols = 4; 
    } else if (viewportWidth < 1024) {
        targetCols = 5;
    } else if (viewportWidth < 1440) {
        targetCols = 6;
    } else {
        targetCols = 7;
    }
    targetCols = Math.max(1, targetCols);

    let numCols = targetCols;
    let currentSpacing = isMobile ? MIN_SPACING_MOBILE : MIN_SPACING_DESKTOP;

    const minImageWidthMobile = 60; 
    const maxImageWidthMobile = 100; 
    const minImageWidthDesktop = 120;
    const maxImageWidthDesktop = 250;

    const minAcceptableImageWidth = isMobile ? minImageWidthMobile : minImageWidthDesktop;
    const maxAcceptableImageWidth = isMobile ? maxImageWidthMobile : maxImageWidthDesktop;
    
    const maxColsMobile = 6; 
    const maxColsDesktop = 10;
    const maxCols = isMobile ? maxColsMobile : maxColsDesktop;

    let calculatedImageWidth = (viewportWidth - (numCols + 1) * currentSpacing) / numCols;
    
    while (calculatedImageWidth < minAcceptableImageWidth && numCols > 1) {
        numCols--;
        currentSpacing = isMobile ? MIN_SPACING_MOBILE : MIN_SPACING_DESKTOP; 
        calculatedImageWidth = (viewportWidth - (numCols + 1) * currentSpacing) / numCols;
    }
    
    while (calculatedImageWidth > maxAcceptableImageWidth && numCols < maxCols) {
        numCols++;
        currentSpacing = isMobile ? MIN_SPACING_MOBILE : MIN_SPACING_DESKTOP; 
        calculatedImageWidth = (viewportWidth - (numCols + 1) * currentSpacing) / numCols;
    }
    
    calculatedImageWidth = Math.max(isMobile ? 50 : 100, calculatedImageWidth); 
    
    currentSpacing = (viewportWidth - numCols * calculatedImageWidth) / (numCols + 1);
    currentSpacing = Math.max(
        isMobile ? MIN_SPACING_MOBILE : MIN_SPACING_DESKTOP,
        Math.min(currentSpacing, isMobile ? MAX_SPACING_MOBILE : MAX_SPACING_DESKTOP)
    );
    
    calculatedImageWidth = (viewportWidth - (numCols + 1) * currentSpacing) / numCols;
    calculatedImageWidth = Math.max(isMobile ? 50 : 100, calculatedImageWidth);

    const calculatedImageHeight = calculatedImageWidth / BASE_ASPECT_RATIO;
    
    const newLayoutConfig = {
      imageWidth: calculatedImageWidth,
      imageHeight: calculatedImageHeight,
      spacing: currentSpacing,
      numColsEffective: numCols,
      tileAndSpacingWidth: calculatedImageWidth + currentSpacing,
      tileAndSpacingHeight: calculatedImageHeight + currentSpacing,
    };
    setLayoutConfig(newLayoutConfig);
    return newLayoutConfig;
  }, [images]);

  const centerOnVirtualCell = useCallback((vr: number, vc: number, currentLayout: typeof layoutConfig, useAnimation = true) => {
    if (!viewportRef.current || !currentLayout || currentLayout.imageWidth === 0 || currentLayout.tileAndSpacingWidth === 0 || images.length === 0) return;

    const itemCenterXInVirtualPlane = vc * currentLayout.tileAndSpacingWidth + currentLayout.imageWidth / 2;
    const itemCenterYInVirtualPlane = vr * currentLayout.tileAndSpacingHeight + currentLayout.imageHeight / 2;
    
    let targetPanX = window.innerWidth / 2 - itemCenterXInVirtualPlane;
    let targetPanY = window.innerHeight / 2 - itemCenterYInVirtualPlane;
    targetPanX -= window.innerWidth * 0.5;
    targetPanY -= window.innerHeight * 0.5;

    const updateFocusStateAndInteractionEnd = () => {
      // Only update focus state if not using animation (i.e., initial load or resize)
      if (!useAnimation) {
        const imageIndex = mapVirtualCellToImageIndex({ vr, vc }, images, currentLayout.numColsEffective);
        const product = images[imageIndex];
        if (product) {
          const newUniqueId = `${product.id}-${vr}-${vc}`;
          if (onFocusedProductChange) {
            onFocusedProductChange(product);
          }
          lastFocusedVirtualCellRef.current = { vr, vc, uniqueId: newUniqueId, productId: product.id };
        }
      }
      setIsUserInteractingOrSnappingLocal(false);
      if (onInteractingChange) onInteractingChange(false);
    };

    if (useAnimation) {
      setIsUserInteractingOrSnappingLocal(true); 
      if (onInteractingChange) onInteractingChange(true);
      panX.current = targetPanX;
      panY.current = targetPanY;
      
      Promise.all([
        Promise.resolve(),
        Promise.resolve()
      ])
        .then(() => {
          updateFocusStateAndInteractionEnd();
        })
        .catch(error => {
          console.error("Error during snap animation:", error);
          updateFocusStateAndInteractionEnd();
        });
    } else {
      panX.current = targetPanX;
      panY.current = targetPanY;
      if (onInteractingChange) onInteractingChange(false);
      updateFocusStateAndInteractionEnd();
    }
  }, [images, onFocusedProductChange, onInteractingChange]);

  useEffect(() => {
    const vpCurrent = viewportRef.current;
    if (!vpCurrent || images.length === 0) return;

    const performLayoutAndFocus = () => {
        const currentLayout = calculateLayoutConstants();
        if (currentLayout.imageWidth > 0) {
            if (!lastFocusedVirtualCellRef.current || !images.find(img => img.id === lastFocusedVirtualCellRef.current?.productId) ) { 
                const initialVr = Math.floor(images.length / (currentLayout.numColsEffective * 2)); 
                const numColsForInitial = Math.max(1, currentLayout.numColsEffective);
                const initialVc = Math.floor(numColsForInitial / 2); 
                centerOnVirtualCell(initialVr, initialVc, currentLayout, false);
            } else { 
                const { vr, vc } = lastFocusedVirtualCellRef.current;
                centerOnVirtualCell(vr, vc, currentLayout, false);
            }
        }
    };

    performLayoutAndFocus(); 
    const resizeObserver = new ResizeObserver(performLayoutAndFocus);
    resizeObserver.observe(vpCurrent);
    return () => {
      if (vpCurrent) { 
        resizeObserver.unobserve(vpCurrent);
      }
    };
  }, [images, calculateLayoutConstants, centerOnVirtualCell]); 
  
  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    lastMoveTime.current = Date.now();
    velocity.current = { x: 0, y: 0 };
    setIsUserInteractingOrSnappingLocal(true);
    if (onInteractingChange) onInteractingChange(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const now = Date.now();
    const dt = Math.max(1, now - lastMoveTime.current);
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    panX.current += dx;
    panY.current += dy;
    velocity.current = { x: dx / dt * 16, y: dy / dt * 16 }; // px per frame
    lastPointer.current = { x: e.clientX, y: e.clientY };
    lastMoveTime.current = now;
    updateGridTransform();
  };

  // Helper to track when both inertia animations are done
  let inertiaAnimationsDone = 0;
  const onInertiaComplete = () => {
    inertiaAnimationsDone++;
    if (inertiaAnimationsDone === 2) {
      inertiaAnimationsDone = 0;
      snapNearestTileToCenter(); 
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    inertiaAnimationsDone = 0;
    gsap.to(panX, {
      current: panX.current + velocity.current.x * 20,
      inertia: {
        velocity: velocity.current.x,
        resistance: 30
      },
      onUpdate: updateGridTransform,
      onComplete: onInertiaComplete
    });
    gsap.to(panY, {
      current: panY.current + velocity.current.y * 20,
      inertia: {
        velocity: velocity.current.y,
        resistance: 30
      },
      onUpdate: updateGridTransform,
      onComplete: onInertiaComplete
    });
  };

  // Snap the nearest tile to the center after inertia
  const snapNearestTileToCenter = () => {
    
    if (!viewportRef.current || !tilesRef.current.size) return;

    // TODO: This offset was a hack to center the tile on the screen. It should be removed. it should be calculated based on the grid size and the tile size.
    const vpWidth = viewportRef.current.getBoundingClientRect().width;
    const vpHeight = viewportRef.current.getBoundingClientRect().height;

    const centerX = vpWidth / 2 ;
    const centerY = vpHeight / 2;
    console.log('Viewport:', { vpWidth, vpHeight, centerX, centerY });

    const gridRect = gridRef.current.getBoundingClientRect();
    console.log('Grid bounding rect:', gridRect);

    let closestTile = null;
    let minDistance = Infinity;
    for (const tile of tilesRef.current.values()) {
      const tileCenterX = panX.current + tile.styleProps.left + tile.styleProps.width / 2;
      const tileCenterY = panY.current + tile.styleProps.top + tile.styleProps.height / 2;
      // console.log('Current Tile:', tile.uniqueId, { tileCenterX, tileCenterY });
      const dx = tileCenterX - centerX;
      const dy = tileCenterY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance) {
        minDistance = distance;
        closestTile = tile;
      }
    }
    console.log('Current pan:', { panX: panX.current, panY: panY.current });
    if (closestTile) {
      // Use the same logic as centerOnVirtualCell for perfect alignment
      const { vr, vc } = closestTile;
      const { imageWidth, imageHeight, tileAndSpacingWidth, tileAndSpacingHeight } = layoutConfig;

      const itemCenterXInVirtualPlane = vc * tileAndSpacingWidth + imageWidth / 2;
      const itemCenterYInVirtualPlane = vr * tileAndSpacingHeight + imageHeight / 2;

      // Use the actual viewport size, not just the grid container
      const vpWidth = window.innerWidth;
      const vpHeight = window.innerHeight;

      let targetPanX = vpWidth / 2 - itemCenterXInVirtualPlane;
      let targetPanY = vpHeight / 2 - itemCenterYInVirtualPlane;
      targetPanX -= vpWidth * 0.5;
      targetPanY -= vpHeight * 0.5;

      gsap.to(panX, {
        current: targetPanX,
        duration: 0.7,
        ease: 'elastic.out(1, 0.6)',
        onUpdate: updateGridTransform
      });
      gsap.to(panY, {
        current: targetPanY,
        duration: 0.7,
        ease: 'elastic.out(1, 0.6)',
        onUpdate: updateGridTransform
      });
    }
  };

  const updateGridTransform = () => {
    if (gridRef.current) {
      gridRef.current.style.transform = `translate3d(${panX.current}px, ${panY.current}px, 0) rotateX(${rotateX.current}deg) rotateY(${rotateY.current}deg)`;
    }
  };

  useEffect(() => {
    images.forEach((img: Product) => {
      const image = new Image();
      image.src = img.src;
    });
  }, [images]);




  // Update the continuous active item tracking effect
  useEffect(() => {
    let animationFrameId: number;
    const ACTIVE_ZONE_RADIUS = 100;


    const trackClosestTile = () => {
      if (!viewportRef.current || !gridRef.current || images.length === 0) return;

      const vpWidth = viewportRef.current.offsetWidth;
      const vpHeight = viewportRef.current.offsetHeight;
      const centerX = vpWidth / 2;
      const centerY = vpHeight / 2;


      let closestTile: TileData | null = null;
      let minDistance = Infinity;

      for (const tile of tilesRef.current.values()) {
        const tileCenterX = panX.current + tile.styleProps.left + tile.styleProps.width / 2;
        const tileCenterY = panY.current + tile.styleProps.top + tile.styleProps.height / 2;
        const dx = tileCenterX - centerX;
        const dy = tileCenterY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          closestTile = tile;
        }
      }

      // Only update if the closest tile is within the active zone
      if (
        closestTile &&
        minDistance < ACTIVE_ZONE_RADIUS &&
        (!lastFocusedVirtualCellRef.current ||
          lastFocusedVirtualCellRef.current.uniqueId !== closestTile.uniqueId)
      ) {
        onFocusedProductChange?.(closestTile);
        lastFocusedVirtualCellRef.current = {
          vr: closestTile.vr,
          vc: closestTile.vc,
          uniqueId: closestTile.uniqueId,
          productId: closestTile.id,
        };
      }

      animationFrameId = requestAnimationFrame(trackClosestTile);
    };

    animationFrameId = requestAnimationFrame(trackClosestTile);

    return () => cancelAnimationFrame(animationFrameId);
  }, [images, onFocusedProductChange]);

  const getDeterministicOffsetFactor = (seedPart1: number, seedPart2: number) => {
      let hash = seedPart1;
      hash = (hash << 5) - hash + seedPart2; 
      hash = hash & hash; 
      const random = Math.sin(hash);
      return random * 0.5; 
  };

  const getVisibleTiles = useCallback(() => {
    if (!viewportRef.current || !layoutConfig.imageWidth || layoutConfig.tileAndSpacingWidth === 0 || layoutConfig.tileAndSpacingHeight === 0 || images.length === 0) {
      return [];
    }
    
    const vpElementWidth = viewportRef.current.offsetWidth;
    const vpElementHeight = viewportRef.current.offsetHeight; 
    const currentPanX = panX.current;
    const currentPanY = panY.current;
    const { imageWidth, imageHeight, tileAndSpacingWidth, tileAndSpacingHeight, numColsEffective } = layoutConfig;

    const bufferX = vpElementWidth * RENDER_BUFFER_FACTOR;
    const bufferY = vpElementHeight * RENDER_BUFFER_FACTOR;

    if (tileAndSpacingWidth <= 0 || tileAndSpacingHeight <= 0) return [];

    const minVisibleVc = Math.floor((-currentPanX - bufferX) / tileAndSpacingWidth);
    const maxVisibleVc = Math.ceil((-currentPanX + vpElementWidth + bufferX) / tileAndSpacingWidth);
    const minVisibleVr = Math.floor((-currentPanY - bufferY) / tileAndSpacingHeight);
    const maxVisibleVr = Math.ceil((-currentPanY + vpElementHeight + bufferY) / tileAndSpacingHeight);
    
    const visibleTiles: TileData[] = [];
    const newTilesMap = new Map<string, TileData>();

    for (let vr = minVisibleVr; vr <= maxVisibleVr; vr++) {
      for (let vc = minVisibleVc; vc <= maxVisibleVc; vc++) {
        const imageIndex = mapVirtualCellToImageIndex({vr, vc}, images, numColsEffective);
        const originalImage = images[imageIndex];
        
        if (!originalImage) continue; 
        
        const uniqueId = `${originalImage.id}-${vr}-${vc}`;
        const isTileCurrentlyFocused = !isUserInteractingOrSnappingLocal && lastFocusedVirtualCellRef.current?.uniqueId === uniqueId;

        const tileX_final = vc * tileAndSpacingWidth;
        const tileY_final = vr * tileAndSpacingHeight;
        
        const tileCenterXInPannableViewport = currentPanX + tileX_final + imageWidth / 2;
        const tileCenterYInPannableViewport = currentPanY + tileY_final + imageHeight / 2;

        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;

        const dx = tileCenterXInPannableViewport - screenCenterX;
        const dy = tileCenterYInPannableViewport - screenCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.sqrt(Math.pow(screenCenterX, 2) + Math.pow(screenCenterY, 2));
        const distanceFactor = Math.min(1, distance / (maxDist * 0.8 + 1e-6)); 

        const tileData: TileData = {
          ...originalImage,
          uniqueId,
          vr,
          vc,
          styleProps: { left: tileX_final, top: tileY_final, width: imageWidth, height: imageHeight },
          isFocused: isTileCurrentlyFocused,
          distanceFactor,
          key: uniqueId,
          isInteracting,
        };

        newTilesMap.set(uniqueId, tileData);
        visibleTiles.push(tileData);
      }
    }

    // Update tilesRef with new tiles
    tilesRef.current = newTilesMap;
    return visibleTiles;
  }, [images, layoutConfig, panX, panY, isUserInteractingOrSnappingLocal, isInteracting]);

  const tilesToRender = getVisibleTiles();

  if (images.length === 0 && !isUserInteractingOrSnappingLocal) {
    return <div ref={viewportRef} className="image-grid-viewport loading-placeholder">No matching products. Try adjusting filters.</div>;
  }
  if (layoutConfig.imageWidth === 0) {
     return <div ref={viewportRef} className="image-grid-viewport loading-placeholder">Loading Products...</div>;
  }

  return (
    <div
      ref={viewportRef}
      className="image-grid-viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ touchAction: 'none', width: '100%', height: '100%' }}
    >
      <div
        ref={gridRef}
        className="image-grid-container"
        style={{
          transform: `translate3d(${panX.current}px, ${panY.current}px, 0) rotateX(${rotateX.current}deg) rotateY(${rotateY.current}deg)`
        }}
      >
        {tilesToRender.map((tile) => (
          <ImageTile
            key={tile.key}
            image={tile as Product & { uniqueId: string }}
            styleProps={tile.styleProps}
            isFocused={tile.isFocused}
            distanceFactor={tile.distanceFactor}
            onClick={() => onProductImageClick(tile)}
            isInteracting={tile.isInteracting}
          />
        ))}
      </div>
    </div>
  );
};

export default ImageGrid;