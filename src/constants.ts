import { Currency } from "./types";

export const LOGO_URL = "/logo.png";

export const EXCHANGE_RATES: Record<Currency, number> = {
  GHS: 1,
  USD: 0.075,
  GBP: 0.06,
  EUR: 0.07
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GHS: "GH₵",
  USD: "$",
  GBP: "£",
  EUR: "€"
};
