import React, { useState, useRef, useCallback, useEffect } from 'react';
import gsap from 'gsap';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
gsap.registerPlugin(InertiaPlugin);
// import { motion, useMotionValue, animate, PanInfo } from 'framer-motion';
import ImageTile from './ImageTile';
import type { Product, StyleProps, VirtualCell, ImageGridProps } from './types';

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
  // const tilesRef = useRef<Map<string, TileData>>(new Map());

  const [layoutConfig, setLayoutConfig] = useState({
    imageWidth: 0,
    imageHeight: 0,
    spacing: 30,
    numColsEffective: 3,
    tileAndSpacingWidth: 0,
    tileAndSpacingHeight: 0,
  });

  // Focused tile vr/vc state
  const [focusedVr, setFocusedVr] = useState<number | null>(null);
  const [focusedVc, setFocusedVc] = useState<number | null>(null);

  const lastFocusedVirtualCellRef = useRef<VirtualCell | null>(null); 
  // isUserInteractingOrSnapping is now primarily for onIsSettledChange, 
  // while App.jsx's isInteracting handles broader UI state.
  const [isUserInteractingOrSnappingLocal, setIsUserInteractingOrSnappingLocal] = useState(false);

  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const lastMoveTime = useRef(Date.now());

  // Add panX and panY refs for panning
  const panX = useRef(0);
  const panY = useRef(0);

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
    velocity.current = { x: dx / dt * 16, y: dy / dt * 16 }; // px per frame
    lastPointer.current = { x: e.clientX, y: e.clientY };
    lastMoveTime.current = now;
  };

  // Helper to track when both inertia animations are done
  let inertiaAnimationsDone = 0;
  const onInertiaComplete = () => {
    inertiaAnimationsDone++;
    if (inertiaAnimationsDone === 2) {
      inertiaAnimationsDone = 0;
    }
  };

  // Utility to snap a value to the nearest increment
  function snapToIncrement(value: number, increment: number) {
    return Math.round(value / increment) * increment;
  }

  // When focusedVr or focusedVc changes, pan to center the focused tile
  useEffect(() => {
    if (focusedVr === null || focusedVc === null || !layoutConfig.imageWidth || !layoutConfig.tileAndSpacingWidth) return;
    if (!viewportRef.current) return;
    const { tileAndSpacingWidth, tileAndSpacingHeight, imageWidth, imageHeight } = layoutConfig;
    const vpWidth = viewportRef.current.offsetWidth;
    const vpHeight = viewportRef.current.offsetHeight;
    // Center of the focused tile in grid coordinates
    const tileCenterX = focusedVc * tileAndSpacingWidth + imageWidth / 2;
    const tileCenterY = focusedVr * tileAndSpacingHeight + imageHeight / 2;
    // Pan so that the grid's (0,0) is at the viewport center, and the focused tile is centered
    panX.current = -tileCenterX;
    panY.current = -tileCenterY;
    // Update grid transform
    if (gridRef.current) {
      gridRef.current.style.transform = `translate3d(${panX.current}px, ${panY.current}px, 0)`;
    }
  }, [focusedVr, focusedVc, layoutConfig]);

  // Debug popup for focused index
    const debugPopupRef = useRef<HTMLDivElement | null>(null);

    const DebugPopup = () => (
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: 4,
        fontSize: 14,
        zIndex: 9999
      }}>
        Focused Index: {focusedVr}, {focusedVc}
      </div>
    );

  const getVisibleTiles = useCallback(() => {
    if (!viewportRef.current || !layoutConfig.imageWidth || layoutConfig.tileAndSpacingWidth === 0 || layoutConfig.tileAndSpacingHeight === 0 || images.length === 0) {
      return [];
    }
    
    const vpElementWidth = viewportRef.current.offsetWidth;
    const vpElementHeight = viewportRef.current.offsetHeight; 
    // No panX or panY, so just use 0 for currentPanX/currentPanY
    const currentPanX = 0;
    const currentPanY = 0;
    const { imageWidth, imageHeight, tileAndSpacingWidth, tileAndSpacingHeight, numColsEffective } = layoutConfig;

    const bufferX = vpElementWidth * RENDER_BUFFER_FACTOR;
    const bufferY = vpElementHeight * RENDER_BUFFER_FACTOR;

    if (tileAndSpacingWidth <= 0 || tileAndSpacingHeight <= 0) return [];

    const minVisibleVc = Math.floor((-currentPanX - bufferX) / tileAndSpacingWidth);
    const maxVisibleVc = Math.ceil((-currentPanX + vpElementWidth + bufferX) / tileAndSpacingWidth);
    const minVisibleVr = Math.floor((-currentPanY - bufferY) / tileAndSpacingHeight);
    const maxVisibleVr = Math.ceil((-currentPanY + vpElementHeight + bufferY) / tileAndSpacingHeight);
    
    const visibleTiles: TileData[] = [];
    // const newTilesMap = new Map<string, TileData>();

    for (let vr = minVisibleVr; vr <= maxVisibleVr; vr++) {
      for (let vc = minVisibleVc; vc <= maxVisibleVc; vc++) {
        const imageIndex = mapVirtualCellToImageIndex({vr, vc}, images, numColsEffective);
        const originalImage = images[imageIndex];
        
        if (!originalImage) continue; 
        
        const uniqueId = `${originalImage.id}-${vr}-${vc}`;
        // const isTileCurrentlyFocused = !isUserInteractingOrSnappingLocal && lastFocusedVirtualCellRef.current?.uniqueId === uniqueId;

        const tileX_final = vc * tileAndSpacingWidth;
        const tileY_final = vr * tileAndSpacingHeight;
        
        // Distance factor: Manhattan distance from focused tile
        let distanceFactor = 1;
        if (focusedVr !== null && focusedVc !== null) {
          const dVr = Math.abs(vr - focusedVr);
          const dVc = Math.abs(vc - focusedVc);
          distanceFactor = (dVr + dVc) / 6; // 6 is an arbitrary normalization factor, tweak as needed
        }

        const tileData: TileData = {
          ...originalImage,
          uniqueId,
          vr,
          vc,
          styleProps: { left: tileX_final, top: tileY_final, width: imageWidth, height: imageHeight },
          isFocused: false, // Only set by idx === focusedIdx
          distanceFactor,
          key: uniqueId,
          isInteracting,
        };

        // newTilesMap.set(uniqueId, tileData);
        visibleTiles.push(tileData);
      }
    }

    // tilesRef.current = newTilesMap;
    return visibleTiles;
  }, [images, layoutConfig, isInteracting, focusedVr, focusedVc]);

  const tilesToRender = getVisibleTiles();

  // Find all unique vr and vc in tilesToRender for clamping
  const allVrs = Array.from(new Set(tilesToRender.map(t => t.vr))).sort((a, b) => a - b);
  const allVcs = Array.from(new Set(tilesToRender.map(t => t.vc))).sort((a, b) => a - b);

  // Set initial focusedVr/Vc to (0,0) or closest tile
  useEffect(() => {
    if (tilesToRender.length > 0 && (focusedVr === null || focusedVc === null)) {
      // Try to find the tile at vr:0, vc:0, otherwise pick the closest to (0,0)
      let tile = tilesToRender.find(t => t.vr === 0 && t.vc === 0);
      if (!tile) {
        tile = tilesToRender.reduce((closest, t) => {
          const dist = Math.abs(t.vr) + Math.abs(t.vc);
          const closestDist = Math.abs(closest.vr) + Math.abs(closest.vc);
          return dist < closestDist ? t : closest;
        }, tilesToRender[0]);
      }
      setFocusedVr(tile.vr);
      setFocusedVc(tile.vc);
    }
  }, [tilesToRender, focusedVr, focusedVc]);

  // Find the focused tile index
  const focusedIdx = tilesToRender.findIndex(t => t.vr === focusedVr && t.vc === focusedVc);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (focusedVr === null || focusedVc === null) return;
    let newVr = focusedVr;
    let newVc = focusedVc;
    if (e.key === 'ArrowLeft') {
      // Clamp to min vc
      newVc = Math.max(Math.min(...allVcs), focusedVc - 1);
    } else if (e.key === 'ArrowRight') {
      // Clamp to max vc
      newVc = Math.min(Math.max(...allVcs), focusedVc + 1);
    } else if (e.key === 'ArrowUp') {
      newVr = Math.max(Math.min(...allVrs), focusedVr - 1);
    } else if (e.key === 'ArrowDown') {
      newVr = Math.min(Math.max(...allVrs), focusedVr + 1);
    }
    // Only update if a tile exists at the new vr/vc
    const candidate = tilesToRender.find(t => t.vr === newVr && t.vc === newVc);
    if (candidate && (newVr !== focusedVr || newVc !== focusedVc)) {
      setFocusedVr(newVr);
      setFocusedVc(newVc);
      if (onFocusedProductChange) {
        onFocusedProductChange(candidate);
      }
      e.preventDefault();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    // Snap to grid after drag, no inertia
    // animateSnapPanToGrid();
  };

  useEffect(() => {
    images.forEach((img: Product) => {
      const image = new Image();
      image.src = img.src;
    });
  }, [images]);

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
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ touchAction: 'none', width: '100%', height: '100%' }}
    >
      <div
        ref={gridRef}
        className="image-grid-container"
        // transform is now set by useEffect
      >
        <DebugPopup />
        {tilesToRender.map((tile, idx) => (
          <ImageTile
            key={tile.key}
            image={tile as Product & { uniqueId: string }}
            styleProps={tile.styleProps}
            isFocused={tile.vr === focusedVr && tile.vc === focusedVc}
            distanceFactor={tile.distanceFactor}
            onClick={() => onProductImageClick(tile)}
            isInteracting={tile.isInteracting}
            tileIndex={idx}
          />
        ))}
      </div>
    </div>
  );
};

export default ImageGrid;