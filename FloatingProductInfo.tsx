import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.2, ease: 'easeIn' } }
};

const FloatingProductInfo = ({ product, isGridSettled }) => {
  return (
    <AnimatePresence>
      {isGridSettled && product && (
        <motion.div
          className="floating-product-info"
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          key={product.id} // Ensure re-animation when product changes
        >
          <h3>{product.name}</h3>
          {product.price && <p className="price">{product.price}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingProductInfo;