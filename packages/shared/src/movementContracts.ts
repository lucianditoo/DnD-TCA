/** Leaf type contracts shared by effects and spatial movement. */
export type SqueezingAxis = "horizontal" | "vertical";

export type ConfirmedSpatialTransition =
  | { readonly spatialMode: "natural"; readonly squeezingAxis?: never }
  | { readonly spatialMode: "squeezing"; readonly squeezingAxis: SqueezingAxis };
