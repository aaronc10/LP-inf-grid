import React from 'react';
import TagFilter from './TagFilter.jsx';
import { motion } from 'framer-motion';

const topBarAnimationProps = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: "easeOut" },
};

const FloatingTagsContainer = ({
  focusedProduct,
  allTagOptions,
  pinnedTags,
  onPinToggle,
  onSwapTag,
  openDropdown,
  setOpenDropdown,
  onPrevious,
  onRestart,
  renderTopTags // New prop
}) => {
  const tagCategories = [
    { key: 'type', displayName: 'Category' },
    { key: 'texture', displayName: 'Material' },
    { key: 'color', displayName: 'Color' },
  ];

  return (
    <>
      <motion.div
        className="floating-previous-btn-wrapper"
        {...topBarAnimationProps}
      >
        <button onClick={onPrevious} aria-label="Previous state" className="floating-nav-button">
          &lt; Previous
        </button>
      </motion.div>

      {/* Conditionally render the top tags bar */}
      {renderTopTags && (
        <motion.div
          className="floating-tags-bar"
          {...topBarAnimationProps}
        >
          {tagCategories.map(({ key, displayName }) => {
            const optionsForCategory = allTagOptions[key] || [];
            if (optionsForCategory.length === 0 && !(focusedProduct?.tags?.[key]) && !pinnedTags[key]) return null;

            return (
              <TagFilter
                key={key}
                categoryKey={key}
                categoryDisplayName={displayName}
                currentTagValue={focusedProduct?.tags?.[key] || null}
                pinnedValue={pinnedTags[key]}
                options={optionsForCategory}
                onPinToggle={onPinToggle}
                onSelectOption={onSwapTag}
                isOpen={openDropdown === key}
                onToggleDropdown={() => setOpenDropdown(prev => (prev === key ? null : key))}
              />
            );
          })}
        </motion.div>
      )}

      <motion.div
        className="floating-restart-btn-wrapper"
        {...topBarAnimationProps}
      >
        <button onClick={onRestart} aria-label="Restart experience" className="floating-nav-button">
          Restart ↻
        </button>
      </motion.div>
    </>
  );
};

export default FloatingTagsContainer;
