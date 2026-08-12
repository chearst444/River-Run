/** Every tradeable/consumable good in the economy. */
export type ResourceId =
  | "wheat"
  | "corn"
  | "potatoes"
  | "tomatoes"
  | "apples"
  | "wool"
  | "milk"
  | "eggs"
  | "meat"
  | "fish"
  | "deer_meat"
  | "ore"
  | "tools"
  | "flour"
  | "bread"
  | "clothing";

export const RESOURCE_IDS: ResourceId[] = [
  "wheat",
  "corn",
  "potatoes",
  "tomatoes",
  "apples",
  "wool",
  "milk",
  "eggs",
  "meat",
  "fish",
  "deer_meat",
  "ore",
  "tools",
  "flour",
  "bread",
  "clothing",
];

/** Which resources count as "food" toward feeding the population. */
export const FOOD_RESOURCES: ResourceId[] = [
  "wheat",
  "corn",
  "potatoes",
  "tomatoes",
  "apples",
  "milk",
  "eggs",
  "meat",
  "fish",
  "deer_meat",
  "bread",
];

export function createEmptyResourceMap(): Record<ResourceId, number> {
  const map = {} as Record<ResourceId, number>;
  for (const id of RESOURCE_IDS) map[id] = 0;
  return map;
}
