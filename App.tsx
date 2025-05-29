import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import ImageGrid from './ImageGrid.jsx';
import FloatingProductInfo from './FloatingProductInfo.jsx';
import FloatingCTA from './FloatingCTA.jsx';
import FloatingTagsContainer from './FloatingTagsContainer.jsx';
import TagFilter from './TagFilter.jsx'; // Import TagFilter for direct use
import { mockImageData } from './data.js';
import './index.css';
import type { Product, TagOptions, PinnedTags, HistoryState } from './types';

const getAllTagOptions = (products: Product[]): TagOptions => {
  const options: TagOptions = {
    type: [],
    texture: [],
    color: []
  };

  products.forEach(p => {
    if (p.tags) {
      (Object.keys(p.tags) as Array<keyof PinnedTags>).forEach(key => {
        const value = p.tags[key];
        if (value && !(options[key] as string[]).includes(value)) {
          (options[key] as string[]).push(value);
        }
      });
    }
  });

  return options;
};

const tagCategories = [ 
  { key: 'type', displayName: 'Category' },
  { key: 'texture', displayName: 'Material' },
  { key: 'color', displayName: 'Color' },
];

export default function App() {
  const [focusedProduct, setFocusedProduct] = useState<Product | null>(null);
  const [isGridSettled, setIsGridSettled] = useState(false); 
  const [isInteracting, setIsInteracting] = useState(false); // New state for interaction

  const [allTagOptions, setAllTagOptions] = useState<TagOptions>({
    type: [],
    texture: [],
    color: []
  });
  const [pinnedTags, setPinnedTags] = useState<PinnedTags>({
    type: null,
    texture: null,
    color: null
  });
  const [productsToDisplay, setProductsToDisplay] = useState<Product[]>(mockImageData);
  const [historyStack, setHistoryStack] = useState<HistoryState[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null); 

  useEffect(() => {
    const options = getAllTagOptions(productsToDisplay);
    setAllTagOptions(options);
    if (mockImageData.length > 0 && !focusedProduct) {
      // Initial focus is handled by ImageGrid
    }
  }, [focusedProduct]);

  const pushToHistory = (currentState: HistoryState) => {
    setHistoryStack(prev => [...prev.slice(-10), currentState]);
  };

  const applyFilters = useCallback((currentPins: PinnedTags) => {
    let filtered = [...mockImageData];

    (Object.keys(currentPins) as Array<keyof PinnedTags>).forEach(key => {
      const value = currentPins[key];
      if (value) {
        filtered = filtered.filter(p => p.tags && p.tags[key] === value);
      }
    });

    if (filtered.length === 0) {
      setProductsToDisplay(mockImageData.slice(0,1)); 
    } else {
      setProductsToDisplay(filtered);
    }
  }, []);

  const handleSetFocusedProduct = useCallback((product: Product | null) => {
    setFocusedProduct(product);
  }, []);

  const handleIsGridSettledChange = useCallback((settled: boolean) => {
    setIsGridSettled(settled);
  }, []);

  const handleInteractingChange = useCallback((interacting: boolean) => {
    setIsInteracting(interacting);
  }, []);

  const handlePinToggle = useCallback((categoryKey: keyof PinnedTags) => {
    pushToHistory({ products: productsToDisplay, pins: pinnedTags, focus: focusedProduct?.id || null });

    const currentTagValueOnProduct = focusedProduct?.tags?.[categoryKey];

    setPinnedTags(prevPins => {
      if (prevPins[categoryKey] === currentTagValueOnProduct && currentTagValueOnProduct) {
        const newPins = { ...prevPins, [categoryKey]: null };
        applyFilters(newPins);
        return newPins;
      } else {
        const newPins = { ...prevPins, [categoryKey]: currentTagValueOnProduct };
        applyFilters(newPins);
        return newPins;
      }
    });
  }, [focusedProduct, pinnedTags, productsToDisplay, applyFilters]);

  const handleSwapTag = useCallback((categoryKey: keyof PinnedTags, newValue: string) => {
    pushToHistory({ products: productsToDisplay, pins: pinnedTags, focus: focusedProduct?.id || null });

    const newPins = { ...pinnedTags, [categoryKey]: newValue };
    setPinnedTags(newPins);
    applyFilters(newPins);
  }, [focusedProduct, pinnedTags, productsToDisplay, applyFilters]);

  const handleFindSimilar = useCallback(() => {
    pushToHistory({ products: productsToDisplay, pins: pinnedTags, focus: focusedProduct?.id || null });

    if (focusedProduct) {
      alert(`Finding similar items to ${focusedProduct.name}. (Clearing current filters)`);
      setPinnedTags({ type: null, texture: null, color: null });
      setProductsToDisplay(mockImageData);
      setFocusedProduct(mockImageData.length > 0 ? mockImageData[0] : null);
    }
  }, [focusedProduct, pinnedTags, productsToDisplay]);

  const handleProductImageClick = useCallback((product: Product) => {
    // ImageGrid handles centering. This is for potential navigation.
  }, []);
  
  const handlePrevious = () => {
    if (historyStack.length > 0) {
      const prevState = historyStack[historyStack.length - 1];
      setProductsToDisplay(prevState.products);
      setPinnedTags(prevState.pins);
      setFocusedProduct(
        prevState.products.find(p => p.id === prevState.focus) || prevState.products[0] || mockImageData[0]
      );
      setHistoryStack(prev => prev.slice(0, -1));
    } else {
      alert("No previous state.");
    }
  };

  const handleRestart = () => {
    setPinnedTags({ type: null, texture: null, color: null });
    setProductsToDisplay(mockImageData);
    setFocusedProduct(mockImageData.length > 0 ? mockImageData[0] : null);
    setHistoryStack([]);
    alert("Canvas reset to initial view.");
  };

  const showBottomPane = isGridSettled && focusedProduct && !isInteracting;
  const showFallbackTopInfoCTA = focusedProduct && !isGridSettled && !isInteracting;
  const showTopTagsBarInFloatingContainer = !showBottomPane && !isInteracting;


  return (
    <div className="app-container product-explorer full-canvas">
      <FloatingTagsContainer
        focusedProduct={focusedProduct}
        allTagOptions={allTagOptions}
        pinnedTags={pinnedTags}
        onPinToggle={handlePinToggle}
        onSwapTag={handleSwapTag}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        onPrevious={handlePrevious}
        onRestart={handleRestart}
        renderTopTags={showTopTagsBarInFloatingContainer} 
      />
      <ImageGrid 
        images={productsToDisplay} 
        onFocusedProductChange={handleSetFocusedProduct}
        onIsSettledChange={handleIsGridSettledChange}
        onProductImageClick={handleProductImageClick}
        onInteractingChange={handleInteractingChange} // Pass new callback
        isInteracting={isInteracting} // Pass state down
      />

      {/* Always show the floating product info pane if there is a focused product */}
      {focusedProduct && (
        <div className="focused-product-details-pane">
          <FloatingProductInfo 
            product={focusedProduct} 
            isGridSettled={true} // Always show
          />
          <FloatingCTA 
            onFindSimilar={handleFindSimilar} 
            isGridSettled={isGridSettled} 
          />
          <div className="focused-pane-tags-wrapper">
            {tagCategories.map(({ key, displayName }) => {
              const optionsForCategory = allTagOptions[key as keyof typeof allTagOptions] || [];
              if (
                (!Array.isArray(optionsForCategory) || (optionsForCategory as string[]).length === 0) &&
                !(focusedProduct?.tags?.[key as keyof typeof focusedProduct.tags]) &&
                !(pinnedTags[key as keyof typeof pinnedTags])
              ) return null;

              return (
                <TagFilter
                  key={key}
                  categoryKey={key}
                  categoryDisplayName={displayName}
                  currentTagValue={focusedProduct?.tags?.[key as keyof typeof focusedProduct.tags] || null}
                  pinnedValue={pinnedTags[key as keyof typeof pinnedTags]}
                  options={optionsForCategory}
                  onPinToggle={handlePinToggle} 
                  onSelectOption={handleSwapTag} 
                  isOpen={openDropdown === key}
                  onToggleDropdown={() => setOpenDropdown(prev => (prev === key ? null : key))}
                />
              );
            })}
          </div>
        </div>
      )}

      {showFallbackTopInfoCTA && (
         <>
            <div className="floating-product-info-top">
                <h3>{focusedProduct?.name}</h3>
                {focusedProduct?.price && <p className="price">{focusedProduct.price}</p>}
            </div>
            <div className="floating-cta-container-top">
                 <button 
                    className="find-similar-btn-floating" 
                    onClick={handleFindSimilar}
                    aria-label="Find similar items"
                  >
                    Find Similar
                  </button>
            </div>
         </>
      )}
    </div>
  );
}