/**
 * Brand and Chain Restaurant Detection
 * 
 * Detects known restaurant chains and branded items from user input
 * to prioritize verified nutrition data over estimates.
 */

// Common restaurant chains and fast food brands
const RESTAURANT_CHAINS = [
  // Coffee & Juice
  'joe & the juice', 'joe and the juice', 'starbucks', 'costa', 'pret', 'pret a manger',
  'dunkin', 'dunkin donuts', 'tim hortons', 'caribou coffee', 'dutch bros',
  'jamba', 'jamba juice', 'smoothie king', 'tropical smoothie',
  
  // Fast Food
  'mcdonalds', "mcdonald's", 'burger king', 'wendys', "wendy's", 'five guys',
  'shake shack', 'in-n-out', 'in n out', 'whataburger', 'carls jr', "carl's jr",
  'hardees', "hardee's", 'jack in the box', 'sonic', 'dairy queen', 'culvers',
  
  // Quick Service
  'chipotle', 'qdoba', 'taco bell', 'del taco', 'moes', "moe's",
  'subway', 'jersey mikes', "jersey mike's", 'firehouse subs', 'jimmy johns', "jimmy john's",
  'panera', 'panera bread', 'au bon pain', 'corner bakery',
  
  // Pizza
  'dominos', "domino's", 'pizza hut', 'papa johns', "papa john's", 'little caesars',
  'papa murphys', "papa murphy's", 'hungry howies', "hungry howie's",
  
  // Chicken
  'chick-fil-a', 'chick fil a', 'popeyes', 'kfc', 'raising canes', "raising cane's",
  'wingstop', 'buffalo wild wings', 'zaxbys', "zaxby's", 'church\'s chicken',
  
  // Casual Dining
  'applebees', "applebee's", 'chilis', "chili's", 'olive garden', 'red lobster',
  'outback', 'outback steakhouse', 'longhorn', 'texas roadhouse', 'tgi fridays',
  'buffalo wild wings', 'hooters', 'dennys', "denny's", 'ihop', 'cracker barrel',
  
  // Asian
  'panda express', 'pf changs', "p.f. chang's", 'benihana', 'noodles & company',
  
  // UK Chains
  'nandos', "nando's", 'greggs', 'leon', 'wagamama', 'itsu', 'eat', 'pod',
  'wasabi', 'yo sushi', 'yo! sushi', 'tortilla', 'tortilla mexican',
  
  // Health/Fitness
  'sweetgreen', 'cava', 'dig inn', 'chopt', 'just salad', 'tender greens',
] as const;

// Common brand keywords that indicate packaged/branded foods
const BRAND_KEYWORDS = [
  'protein bar', 'protein shake', 'energy bar', 'granola bar',
  'quest', 'rxbar', 'kind bar', 'clif bar', 'larabar', 'nature valley',
  'muscle milk', 'premier protein', 'fairlife', 'core power',
  'gatorade', 'powerade', 'bodyarmor', 'celsius', 'bang energy',
  'huel', 'soylent', 'ensure', 'boost',
];

/**
 * Detects if the input contains a known restaurant chain name
 */
export function detectChainRestaurant(input: string): {
  isChain: boolean;
  chainName?: string;
  originalQuery: string;
} {
  const normalized = input.toLowerCase().trim();
  
  for (const chain of RESTAURANT_CHAINS) {
    if (normalized.includes(chain)) {
      return {
        isChain: true,
        chainName: chain,
        originalQuery: input,
      };
    }
  }
  
  return {
    isChain: false,
    originalQuery: input,
  };
}

/**
 * Detects if the input contains a branded product keyword
 */
export function detectBrandedProduct(input: string): {
  isBranded: boolean;
  brandKeyword?: string;
} {
  const normalized = input.toLowerCase().trim();
  
  for (const keyword of BRAND_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return {
        isBranded: true,
        brandKeyword: keyword,
      };
    }
  }
  
  return {
    isBranded: false,
  };
}

/**
 * Extracts item name from a chain restaurant query
 * e.g., "Joe & The Juice Tunacado" -> { chain: "joe & the juice", item: "Tunacado" }
 */
export function extractChainAndItem(input: string): {
  chain?: string;
  item: string;
} {
  const detection = detectChainRestaurant(input);
  
  if (!detection.isChain || !detection.chainName) {
    return { item: input };
  }
  
  // Remove the chain name and clean up
  const normalized = input.toLowerCase();
  const chainIndex = normalized.indexOf(detection.chainName);
  
  if (chainIndex === -1) {
    return { chain: detection.chainName, item: input };
  }
  
  // Extract the item name (part after the chain name)
  const beforeChain = input.slice(0, chainIndex).trim();
  const afterChain = input.slice(chainIndex + detection.chainName.length).trim();
  
  const item = afterChain || beforeChain || input;
  
  return {
    chain: detection.chainName,
    item: item.replace(/^[-–—:,\s]+/, '').trim(), // Clean leading punctuation
  };
}

/**
 * Returns source label for display
 */
export function getNutritionSourceLabel(source: string): string {
  switch (source) {
    case 'branded_verified':
      return '✓ Verified';
    case 'barcode_verified':
      return '✓ Barcode';
    case 'database_generic':
      return 'Database';
    case 'estimate':
      return '⚡ Estimate';
    case 'open_food_facts':
      return '✓ Verified';
    case 'usda':
      return 'USDA';
    case 'uk_cofid':
      return 'UK Database';
    case 'fatsecret':
      return '✓ FatSecret';
    case 'ai_estimation':
      return '⚡ Estimate';
    default:
      if (source?.includes('verified')) return '✓ Verified';
      if (source?.includes('fatsecret')) return '✓ FatSecret';
      if (source?.includes('estimate')) return '⚡ Estimate';
      return source || 'Unknown';
  }
}
