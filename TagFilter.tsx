import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PinIcon = ({ isPinned }) => (
  <img 
    src={isPinned ? "/pinned.svg" : "/pin.svg"} 
    alt={isPinned ? "Pinned" : "Pin"} 
    className={`tag-filter-icon tag-filter-icon-pin${isPinned ? ' pinned' : ''}`}
    style={{ width: 14, height: 14, marginRight: 4, opacity: isPinned ? 1 : 0.7 }}
    draggable="false"
  />
);

const ChevronDownIcon = () => (
  <img 
    src="/arrow.svg" 
    alt="Dropdown Arrow" 
    className="tag-filter-icon tag-filter-icon-arrow"
    style={{ width: 14, height: 14, marginLeft: 4 }}
    draggable="false"
  />
);

const dropdownVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
};

// Renamed props for clarity in the new FloatingTagsContainer context
const TagFilter = ({ 
  categoryKey, // e.g., 'color', 'texture', 'type'
  categoryDisplayName, // e.g., 'Color', 'Texture', 'Type'
  currentTagValue, // The tag value from the FOCUSED product, e.g., "Red"
  pinnedValue, // The value currently PINNED for this category, e.g., "Blue" or null
  options, // All available options for this category's dropdown
  onPinToggle, // Callback for when pin icon is clicked
  onSelectOption, // Callback for when an option is selected from dropdown
  isOpen, // Is this specific dropdown open?
  onToggleDropdown // Callback to open/close this dropdown
}) => {
  
  // Display logic: Show pinned value if one exists, otherwise focused product's tag for this category.
  // If neither, show category name.
  let buttonText = categoryDisplayName; // Fallback to category name
  if (pinnedValue) {
    buttonText = pinnedValue;
  } else if (currentTagValue) {
    buttonText = currentTagValue;
  }
  
  const isActuallyPinned = pinnedValue !== null;

  return (
    <div className="tag-filter-wrapper">
      <button 
        className="tag-filter" 
        onClick={onToggleDropdown} 
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Filter by ${categoryDisplayName}. Current: ${buttonText}. Pinned: ${pinnedValue || 'None'}`}
      >
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation(); // Prevent dropdown toggle
            onPinToggle(categoryKey);
          }}
          onKeyPress={(e) => {
             if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onPinToggle(categoryKey);
             }
          }}
          aria-label={isActuallyPinned ? `Unpin ${pinnedValue}` : `Pin ${currentTagValue || categoryDisplayName}`}
          className="pin-icon-clickable-area" // For styling if needed
        >
          <PinIcon isPinned={isActuallyPinned} />
        </span>
        <span className="tag-filter-text">{buttonText}</span>
        <ChevronDownIcon />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.ul
            className="tag-filter-dropdown"
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            role="listbox"
            aria-label={`${categoryDisplayName} options`}
          >
            {/* Option to select the product's current tag (if not already pinned/selected) */}
            {currentTagValue && currentTagValue !== pinnedValue && (
              <li
                onClick={() => onSelectOption(categoryKey, currentTagValue)}
                className={`tag-filter-dropdown-item`}
                role="option"
                aria-selected={false}
              >
                Use "{currentTagValue}" (from product)
              </li>
            )}
            {/* Option to clear pin / select "Any" */}
            <li 
              onClick={() => onSelectOption(categoryKey, null)} // Clears pin or selects "Any"
              className={`tag-filter-dropdown-item ${!pinnedValue ? 'selected' : ''}`} // 'selected' if no pin active
              role="option"
              aria-selected={!pinnedValue}
            >
              Any {categoryDisplayName}
            </li>
            {options.map(option => {
              // Don't show the current product's tag again if it was listed above
              if (option === currentTagValue && currentTagValue !== pinnedValue) return null;
              
              return (
                <li 
                  key={option} 
                  onClick={() => onSelectOption(categoryKey, option)}
                  className={`tag-filter-dropdown-item ${pinnedValue === option ? 'selected' : ''}`}
                  role="option"
                  aria-selected={pinnedValue === option}
                >
                  {option}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TagFilter;