import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const variants = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut', delay: 0.1 } }, // Slight delay
  exit: { opacity: 0, y: 10, scale: 0.9, transition: { duration: 0.2, ease: 'easeIn' } }
};

const FloatingCTA = ({ onFindSimilar, isGridSettled }) => {
  return (
    <AnimatePresence>
      {isGridSettled && (
        <motion.div
          className="floating-cta-container"
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <button 
            className="find-similar-btn-floating" 
            onClick={onFindSimilar}
            aria-label="Find similar items"
          >
            Find Similar
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingCTA;