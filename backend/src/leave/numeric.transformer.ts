// Postgres returns DECIMAL columns as strings; convert to numbers.
export const numericTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | number | null) => (v === null || v === undefined ? null : parseFloat(String(v))),
};
