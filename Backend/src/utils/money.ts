// The API accepts rupees (what people type) and stores integer paise, so
// arithmetic never meets floating-point rounding.
export const toPaise = (rupees: number) => Math.round(rupees * 100);
