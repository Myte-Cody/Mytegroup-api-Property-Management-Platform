import { Transform } from "class-transformer";

/**
 * Custom decorator to transform string values to lowercase
 */
export function TransformToLowercase() {
  return Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase();
    }
    return value;
  });
}
