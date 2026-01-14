export type StockQuote = {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  timestamp: string;
};

export type StockTrade = {
  symbol: string;
  price: number;
  size: number;
  timestamp: string;
};
