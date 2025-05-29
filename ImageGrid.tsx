import React, { useState, useRef, useCallback, useEffect } from 'react';
import gsap from 'gsap';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import type { Tween } from 'gsap';
gsap.registerPlugin(InertiaPlugin);
// import { motion, useMotionValue, animate, PanInfo } from 'framer-motion';
import ImageTile from './ImageTile';
import type { Product, StyleProps, VirtualCell, ImageGridProps } from './types';

const MIN_SPACING_DESKTOP = 50; 
const MAX_SPACING_DESKTOP = 80;
const MIN_SPACING_MOBILE = 30;
const MAX_SPACING_MOBILE = 50;

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

  // Add hovered tile vr/vc state
  const [hoveredVr, setHoveredVr] = useState<number | null>(null);
  const [hoveredVc, setHoveredVc] = useState<number | null>(null);

  // Drag state for grid dragging
  const dragStart = useRef<{ x: number; y: number; vr: number; vc: number } | null>(null);
  const [draggedVr, setDraggedVr] = useState<number | null>(null);
  const [draggedVc, setDraggedVc] = useState<number | null>(null);

  // Helper to get the current vr/vc (dragged or focused)
  const currentVr = draggedVr !== null ? draggedVr : focusedVr;
  const currentVc = draggedVc !== null ? draggedVc : focusedVc;

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

    const minImageWidthMobile = 120; 
    const maxImageWidthMobile = 250; 
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
    if (currentVr === null || currentVc === null) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      vr: currentVr,
      vc: currentVc,
    };
    setIsUserInteractingOrSnappingLocal(true);
    if (onInteractingChange) onInteractingChange(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !dragStart.current) return;
    const { x, y, vr, vc } = dragStart.current;
    const dx = e.clientX - x;
    const dy = e.clientY - y;
    const { tileAndSpacingWidth, tileAndSpacingHeight } = layoutConfig;
    if (!tileAndSpacingWidth || !tileAndSpacingHeight) return;
    // Negative dx means drag right moves grid left (vc increases)
    const deltaVc = -dx / tileAndSpacingWidth;
    const deltaVr = -dy / tileAndSpacingHeight;
    setDraggedVr(vr + deltaVr);
    setDraggedVc(vc + deltaVc);
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

  // When focusedVr or focusedVc changes, pan to center the focused tile with GSAP elastic animation
  useEffect(() => {
    if (focusedVr === null || focusedVc === null || !layoutConfig.imageWidth || !layoutConfig.tileAndSpacingWidth) return;
    if (!viewportRef.current || !gridRef.current) return;
    if (draggedVr !== null || draggedVc !== null) return; // Don't animate during drag
    const { tileAndSpacingWidth, tileAndSpacingHeight, imageWidth, imageHeight } = layoutConfig;
    // Center of the focused tile in grid coordinates
    const tileCenterX = focusedVc * tileAndSpacingWidth + imageWidth / 2;
    const tileCenterY = focusedVr * tileAndSpacingHeight + imageHeight / 2;
    // Pan so that the grid's (0,0) is at the viewport center, and the focused tile is centered
    panX.current = -tileCenterX;
    panY.current = -tileCenterY;
    // Animate grid transform with GSAP elastic
    gsap.to(gridRef.current, {
      x: panX.current,
      y: panY.current,
      duration: 1.1,
      ease: "elastic.out(0.5, 0.5)",
      overwrite: true,
    });
  }, [focusedVr, focusedVc, layoutConfig, draggedVr, draggedVc]);

  // // Debug popup for focused index
  //   const debugPopupRef = useRef<HTMLDivElement | null>(null);

  //   const DebugPopup = () => (
  //     <div style={{
  //       position: 'fixed',
  //       top: 10,
  //       right: 10,
  //       background: 'rgba(0,0,0,0.7)',
  //       color: 'white',
  //       padding: '8px 12px',
  //       borderRadius: 4,
  //       fontSize: 14,
  //       zIndex: 9999,
  //       pointerEvents: 'none',
  //       userSelect: 'none',
  //     }}>
  //       Focused Index: {focusedVr}, {focusedVc}
  //     </div>
  //   );

  const getVisibleTiles = useCallback(() => {
    if (!viewportRef.current || !layoutConfig.imageWidth || layoutConfig.tileAndSpacingWidth === 0 || layoutConfig.tileAndSpacingHeight === 0 || images.length === 0) {
      return [];
    }
    const vpElementWidth = viewportRef.current.offsetWidth;
    const vpElementHeight = viewportRef.current.offsetHeight; 
    const { imageWidth, imageHeight, tileAndSpacingWidth, tileAndSpacingHeight, numColsEffective } = layoutConfig;
    const centerVr = currentVr ?? 0;
    const centerVc = currentVc ?? 0;
    const tilesWide = Math.ceil(vpElementWidth / tileAndSpacingWidth) + 4;
    const tilesHigh = Math.ceil(vpElementHeight / tileAndSpacingHeight) + 4;
    const minVisibleVc = centerVc - Math.floor(tilesWide / 2);
    const maxVisibleVc = centerVc + Math.floor(tilesWide / 2);
    const minVisibleVr = centerVr - Math.floor(tilesHigh / 2);
    const maxVisibleVr = centerVr + Math.floor(tilesHigh / 2);
    const visibleTiles: TileData[] = [];
    for (let vr = minVisibleVr; vr <= maxVisibleVr; vr++) {
      for (let vc = minVisibleVc; vc <= maxVisibleVc; vc++) {
        const imageIndex = mapVirtualCellToImageIndex({vr, vc}, images, numColsEffective);
        const originalImage = images[imageIndex];
        if (!originalImage) continue;
        const uniqueId = `${originalImage.id}-${vr}-${vc}`;
        const tileX_final = vc * tileAndSpacingWidth;
        const tileY_final = vr * tileAndSpacingHeight;
        let distanceFactor = 1;
        if (currentVr !== null && currentVc !== null) {
          const dVr = Math.abs(vr - currentVr);
          const dVc = Math.abs(vc - currentVc);
          distanceFactor = (dVr + dVc) / 6;
        }
        const tileData: TileData = {
          ...originalImage,
          uniqueId,
          vr,
          vc,
          styleProps: { left: tileX_final, top: tileY_final, width: imageWidth, height: imageHeight },
          isFocused: false,
          distanceFactor,
          key: uniqueId,
          isInteracting,
        };
        visibleTiles.push(tileData);
      }
    }
    return visibleTiles;
  }, [images, layoutConfig, isInteracting, currentVr, currentVc]);

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
    setIsUserInteractingOrSnappingLocal(false);
    if (onInteractingChange) onInteractingChange(false);
    if (draggedVr !== null && draggedVc !== null) {
      // Snap to nearest integer
      const snappedVr = Math.round(draggedVr);
      const snappedVc = Math.round(draggedVc);
      setFocusedVr(snappedVr);
      setFocusedVc(snappedVc);
    }
    setDraggedVr(null);
    setDraggedVc(null);
    dragStart.current = null;
  };

  useEffect(() => {
    images.forEach((img: Product) => {
      const image = new Image();
      image.src = img.src;
    });
  }, [images]);

  // Keep floating product info in sync with focused tile
  useEffect(() => {
    if (focusedVr !== null && focusedVc !== null) {
      const focusedTile = tilesToRender.find(t => t.vr === focusedVr && t.vc === focusedVc);
      if (focusedTile && onFocusedProductChange) {
        onFocusedProductChange(focusedTile);
      }
    }
  }, [focusedVr, focusedVc, tilesToRender, onFocusedProductChange]);

  // Add mouse wheel support for elastic snapping with GSAP inertia
  useEffect(() => {
    let virtualVr = focusedVr ?? 0;
    let virtualVc = focusedVc ?? 0;
    let gsapTweenVr: Tween | null = null;
    let gsapTweenVc: Tween | null = null;
    const SCROLL_SENSITIVITY = 0.001; // Lower = more resistance
    const handleWheel = (e: WheelEvent) => {
      if (focusedVr === null || focusedVc === null) return;
      // Determine scroll direction and accumulate
      let deltaVr = 0;
      let deltaVc = 0;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        deltaVr = e.deltaY * SCROLL_SENSITIVITY;
      } else {
        deltaVc = e.deltaX * SCROLL_SENSITIVITY;
      }
      virtualVr += deltaVr;
      virtualVc += deltaVc;
      // Kill any existing tweens
      if (gsapTweenVr) gsapTweenVr.kill();
      if (gsapTweenVc) gsapTweenVc.kill();
      // Animate virtualVr and virtualVc with inertia, then snap
      gsapTweenVr = gsap.to({ v: virtualVr }, {
        v: Math.round(virtualVr),
        duration: 0.7,
        ease: "power3.out",
        onUpdate: function() {
          setFocusedVr(Math.round(this.targets()[0].v));
        },
        onComplete: function() {
          virtualVr = Math.round(virtualVr);
        }
      });
      gsapTweenVc = gsap.to({ v: virtualVc }, {
        v: Math.round(virtualVc),
        duration: 0.7,
        ease: "power3.out",
        onUpdate: function() {
          setFocusedVc(Math.round(this.targets()[0].v));
        },
        onComplete: function() {
          virtualVc = Math.round(virtualVc);
        }
      });
      e.preventDefault();
    };
    const vp = viewportRef.current;
    if (vp) vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      if (vp) vp.removeEventListener('wheel', handleWheel);
      if (gsapTweenVr) gsapTweenVr.kill();
      if (gsapTweenVc) gsapTweenVc.kill();
    };
  }, [focusedVr, focusedVc]);

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
      style={{ touchAction: 'none', width: '100%', height: '100%', cursor: 'grab' }}
    >
      <div
        ref={gridRef}
        className="image-grid-container"
        // transform is now set by useEffect
      >
        {tilesToRender.map((tile, idx) => (
          <ImageTile
            key={tile.key}
            image={tile as Product & { uniqueId: string }}
            styleProps={tile.styleProps}
            isFocused={tile.vr === currentVr && tile.vc === currentVc}
            isHovered={tile.vr === hoveredVr && tile.vc === hoveredVc}
            distanceFactor={tile.distanceFactor}
            onClick={() => {
              setFocusedVr(tile.vr);
              setFocusedVc(tile.vc);
              onProductImageClick(tile);
            }}
            isInteracting={tile.isInteracting}
            tileIndex={idx}
            onHover={(vr, vc) => {
              setHoveredVr(vr);
              setHoveredVc(vc);
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ImageGrid;