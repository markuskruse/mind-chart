/** Appearance settings shared by the connection editor, renderer, and document loader. */
export type ConnectionAppearance = {
  color: string;
  lineStyle: "solid" | "dashed";
  thickness: "thin" | "thick";
};

/** The deliberately small, stable palette available to saved documents. */
export const connectionColors = [
  { name: "Black", value: "#111827" },
  { name: "Red", value: "#8f3029" },
  { name: "Orange", value: "#9A4D16" },
  { name: "Gold", value: "#806500" },
  { name: "Green", value: "#28603A" },
  { name: "Teal", value: "#17605C" },
  { name: "Blue", value: "#245487" },
  { name: "Indigo", value: "#443B7A" },
  { name: "Purple", value: "#713B73" },
  { name: "Brown", value: "#69452D" },
] as const;

export const defaultConnectionAppearance: ConnectionAppearance = {
  color: connectionColors[0].value,
  lineStyle: "solid",
  thickness: "thin",
};
