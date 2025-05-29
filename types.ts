export interface Product {
  id: string;
  src: string;
  alt: string;
  name: string;
  price: string;
  tags: {
    [key in TagCategory]: string;
  };
}

export type TagCategory = 'type' | 'texture' | 'color';

export interface TagOptions {
  [key in TagCategory]: string[];
}

export interface PinnedTags {
  [key in TagCategory]: string | null;
}

export interface HistoryState {
  products: Product[];
  pins: PinnedTags;
  focus: string | null;
}

export interface StyleProps {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface VirtualCell {
  vr: number;
  vc: number;
  uniqueId: string;
  productId: string;
}

export interface LayoutConfig {
  imageWidth: number;
  imageHeight: number;
  tileAndSpacingWidth: number;
  tileAndSpacingHeight: number;
  numColsEffective: number;
  spacing: number;
}

export interface ImageTileProps {
  image: Product;
  styleProps: StyleProps;
  isFocused: boolean;
  distanceFactor: number;
  onClick: (product: Product) => void;
  isInteracting: boolean;
}

export interface TagFilterProps {
  categoryKey: TagCategory;
  categoryDisplayName: string;
  currentTagValue: string | null;
  pinnedValue: string | null;
  options: string[];
  onPinToggle: (categoryKey: TagCategory) => void;
  onSelectOption: (categoryKey: TagCategory, newValue: string) => void;
  isOpen: boolean;
  onToggleDropdown: () => void;
}

export interface FloatingCTAProps {
  onFindSimilar: () => void;
  isGridSettled: boolean;
}

export interface FloatingProductInfoProps {
  product: Product | null;
  isGridSettled: boolean;
}

export interface FloatingTagsContainerProps {
  focusedProduct: Product | null;
  allTagOptions: TagOptions;
  pinnedTags: PinnedTags;
  onPinToggle: (categoryKey: TagCategory) => void;
  onSwapTag: (categoryKey: TagCategory, newValue: string) => void;
  openDropdown: string | null;
  setOpenDropdown: (key: string | null) => void;
  onPrevious: () => void;
  onRestart: () => void;
  renderTopTags: boolean;
}

export interface ImageGridProps {
  images: Product[];
  onFocusedProductChange: (product: Product | null) => void;
  onIsSettledChange: (settled: boolean) => void;
  onProductImageClick: (product: Product) => void;
  onInteractingChange: (interacting: boolean) => void;
  isInteracting: boolean;
} 